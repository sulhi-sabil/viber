Blueprint: Universal Serverless Framework on Cloudflare Pages
Versi Dokumen: 1.0
Target Platform: Cloudflare Pages (Full Stack)
Tujuan: Membangun kerangka kerja website fleksibel (Multi-purpose) dengan Admin Dashboard terintegrasi, biaya rendah (Serverless), dan performa tinggi (Edge).
1. Ringkasan Eksekutif
Proyek ini bertujuan membuat "Engine" website yang di-host sepenuhnya di Cloudflare. Engine ini memisahkan Logic (Code) dan Content (Data).
Frontend Public: Merender konten berdasarkan data yang diambil dari DB.
Admin Dashboard: Interface untuk mengelola konten dan struktur data.
Backend: Berjalan di Cloudflare Pages Functions (Workers) untuk API dan rendering.
2. Arsitektur Sistem
Sistem menggunakan pendekatan Monorepo Full-Stack. Frontend dan Backend berada dalam satu repositori git dan dideploy bersamaan.
Diagram Alur Data
graph TD
    User[Visitor] -->|Request URL| CDN[Cloudflare Edge Network]
    Admin[Admin User] -->|Manage Content| Dashboard[Admin Dashboard /admin]
    
    subgraph Cloudflare Ecosystem
        CDN -->|Static Assets| Assets[HTML/CSS/JS]
        CDN -->|Dynamic Request| SSR[Pages Functions / Workers]
        
        SSR -->|Auth & Logic| AuthLogic
        SSR -->|Query Data| D1[Cloudflare D1 SQL Database]
        SSR -->|Media Upload/Get| R2[Cloudflare R2 Storage]
        
        Dashboard --> SSR
    end


Stack Teknologi (Rekomendasi)
Komponen
Teknologi
Alasan Pemilihan
Framework Utama
SvelteKit (atau Next.js)
Adapter Cloudflare terbaik, ringan, mendukung SSR di Edge.
Runtime
Cloudflare Pages Functions
Latency rendah (0ms cold start), terintegrasi langsung.
Database
Cloudflare D1 (SQLite)
SQL Relasional, Serverless, murah, replikasi global.
ORM
Drizzle ORM
Ringan, Type-safe, performa query terbaik untuk D1.
File Storage
Cloudflare R2
Kompatibel S3, Tanpa biaya bandwidth (egress).
Authentication
Lucia Auth
Auth library modern yang menyimpan session di DB sendiri (D1).
Styling
Tailwind CSS
Utilitas styling cepat untuk Admin & Public theme.

3. Desain Database (Flexible Schema)
Agar framework ini bisa digunakan untuk jenis website apa saja (E-commerce, Blog, Portfolio), kita tidak membuat tabel kaku. Kita menggunakan pendekatan Hybrid Relational + JSON.
Skema Inti (D1 SQL)
-- 1. USERS & AUTH
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    role TEXT DEFAULT 'editor', -- 'admin', 'editor'
    created_at INTEGER
);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at INTEGER NOT NULL
);

-- 2. CONTENT TYPES (Mendefinisikan Struktur)
-- Contoh: slug='products', name='Produk', schema_json='{"price": "number", "sku": "text"}'
CREATE TABLE content_types (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fields_schema TEXT NOT NULL -- JSON Definition untuk Admin UI Builder
);

-- 3. ENTRIES (Konten Dinamis)
CREATE TABLE entries (
    id TEXT PRIMARY KEY,
    type_slug TEXT NOT NULL REFERENCES content_types(slug),
    slug TEXT UNIQUE,     -- URL akses (misal: /produk/sepatu-merah)
    title TEXT NOT NULL,
    data TEXT,            -- JSON BLOB: Menyimpan custom fields (harga, gambar, dll)
    status TEXT DEFAULT 'draft', -- 'published', 'draft'
    created_at INTEGER,
    updated_at INTEGER
);

-- 4. MEDIA ASSETS
CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    filename TEXT,
    r2_key TEXT NOT NULL,
    mime_type TEXT,
    public_url TEXT,
    created_at INTEGER
);


4. Struktur Folder (Monorepo)
Struktur ini memisahkan logika publik (yang dilihat pengunjung) dan logika admin, namun tetap berbagi library yang sama.
/
├── .wrangler/                  # Local dev artifacts
├── src/
│   ├── lib/
│   │   ├── server/
│   │   │   ├── db.ts           # Koneksi Drizzle ke D1
│   │   │   ├── auth.ts         # Logic Lucia Auth
│   │   │   └── r2_helper.ts    # Logic Upload/Delete R2
│   │   ├── components/         # UI Components (Button, Card, dll)
│   │   └── utils/
│   ├── routes/
│   │   ├── (public)/           # HALAMAN WEBSITE (Front-facing)
│   │   │   ├── +layout.svelte
│   │   │   ├── +page.svelte    # Homepage
│   │   │   └── [slug]/         # Dynamic Route (Blog/Product)
│   │   │       └── +page.server.ts # Load data from 'entries' table
│   │   ├── (admin)/            # ADMIN DASHBOARD (Protected)
│   │   │   ├── login/
│   │   │   ├── dashboard/
│   │   │   │   ├── content-types/ # Builder Schema
│   │   │   │   ├── entries/       # CRUD Content
│   │   │   │   └── media/         # File Manager
│   │   │   └── +layout.server.ts  # Cek Session/Auth Gate
│   │   └── api/                # REST API (Optional untuk external apps)
├── drizzle/                    # File migrasi SQL
├── static/                     # Aset statis (favicon, robots.txt)
├── wrangler.toml               # Konfigurasi Cloudflare
└── package.json


5. Implementasi Teknis & Code Snippets
A. Konfigurasi wrangler.toml
File ini wajib ada untuk menghubungkan kode dengan resource Cloudflare.
name = "my-universal-framework"
pages_build_output_dir = ".svelte-kit/cloudflare"
compatibility_date = "2024-01-01"

# Database Binding
[[d1_databases]]
binding = "DB" 
database_name = "prod-db"
database_id = "xxxx-xxxx-xxxx"

# Storage Binding
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "prod-media"

[vars]
PUBLIC_SITE_NAME = "My Awesome Site"


B. Koneksi Database (Drizzle ORM)
Lokasi: src/lib/server/db.ts
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema'; // Definisi tabel

export const createDb = (env: App.Platform['env']) => {
    return drizzle(env.DB, { schema });
};


C. Logic Routing Dinamis (Public Frontend)
Lokasi: src/routes/(public)/[slug]/+page.server.ts
Bagian ini membuat website fleksibel. Ia mencari konten berdasarkan URL slug di database.
export const load = async ({ params, platform, error }) => {
    const db = createDb(platform.env);
    
    // Cari entry berdasarkan URL slug
    const entry = await db.query.entries.findFirst({
        where: (entries, { eq }) => eq(entries.slug, params.slug),
        with: {
            contentType: true // Ambil juga metadata tipenya
        }
    });

    if (!entry || entry.status !== 'published') {
        throw error(404, 'Halaman tidak ditemukan');
    }

    // Parse JSON data string kembali ke Object
    const dynamicData = JSON.parse(entry.data);

    return {
        title: entry.title,
        type: entry.type_slug,
        content: dynamicData
    };
};


6. Fitur Admin Dashboard
Dashboard harus bersifat "Schema Driven".
Content Type Builder:
Admin bisa membuat tipe konten baru (misal: "Portfolio").
Admin menambah field: Client Name (Text), Project Image (Media), Year (Number).
Sistem menyimpan definisi ini ke kolom fields_schema di tabel content_types.
Content Editor:
Saat Admin membuat Portfolio baru, UI membaca schema tadi.
Jika tipe field = 'Media', tampilkan tombol "Upload to R2".
Jika tipe field = 'Rich Text', tampilkan WYSIWYG editor.
7. Strategi Deployment & CI/CD
Karena menggunakan Cloudflare Pages, pipeline CI/CD sudah otomatis.
Repository: Kode disimpan di GitHub/GitLab.
Trigger: Setiap push ke branch main memicu build.
Build Command: npm run build (SvelteKit/NextJS build process).
Database Migration: * Opsional Otomatis: Tambahkan script migrasi di pipeline.
Manual: Jalankan npx wrangler d1 migrations apply prod-db --remote dari lokal komputer developer saat ada perubahan struktur tabel.
8. Rencana Pengembangan (Roadmap)
Fase 1: Core Foundation
Setup Repository & Wrangler.
Setup Auth (Login/Logout).
Setup DB Connection.
Fase 2: Admin Dashboard Basic
CRUD Content Types.
CRUD Entries (Basic Text Fields).
Fase 3: Media & Storage
Integrasi R2 Upload.
Gallery Picker di Admin.
Fase 4: Public Frontend Engine
Dynamic Routing [slug].
SSR Rendering untuk SEO.
