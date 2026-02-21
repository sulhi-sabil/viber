import { DatabaseRow } from '../services/supabase';

export interface User extends DatabaseRow {
  email: string;
  password_hash?: string;
  role: 'admin' | 'editor';
  deleted_at?: string;
}

export interface Session extends DatabaseRow {
  user_id: string;
  expires_at: string;
  deleted_at?: string;
}

export interface ContentType extends DatabaseRow {
  slug: string;
  name: string;
  fields_schema: Record<string, unknown>;
  deleted_at?: string;
}

export interface Entry extends DatabaseRow {
  type_slug: string;
  slug?: string;
  title: string;
  data: Record<string, unknown>;
  status: 'published' | 'draft';
  deleted_at?: string;
}

export interface Asset extends DatabaseRow {
  filename: string;
  r2_key: string;
  mime_type?: string;
  public_url?: string;
  entry_id?: string;
  deleted_at?: string;
}

export interface DatabaseSchema {
  users: User;
  sessions: Session;
  content_types: ContentType;
  entries: Entry;
  assets: Asset;
}
