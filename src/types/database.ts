import { DatabaseRow } from "../services/supabase";

export interface User extends DatabaseRow {
  email: string;
  password_hash?: string;
  role: "admin" | "editor";
}

export interface Session extends DatabaseRow {
  user_id: string;
  expires_at: number;
}

export interface ContentType extends DatabaseRow {
  slug: string;
  name: string;
  fields_schema: string;
}

export interface Entry extends DatabaseRow {
  type_slug: string;
  slug?: string;
  title: string;
  data: string;
  status: "published" | "draft";
}

export interface Asset extends DatabaseRow {
  filename: string;
  r2_key: string;
  mime_type?: string;
  public_url?: string;
}

export interface DatabaseSchema {
  users: User;
  sessions: Session;
  content_types: ContentType;
  entries: Entry;
  assets: Asset;
}
