import { Validator } from "../utils/validator";
import {
  MAX_R2_KEY_LENGTH,
  MAX_FILENAME_LENGTH,
  MAX_CONTENT_TYPE_NAME_LENGTH,
  MAX_ENTRY_TITLE_LENGTH,
} from "../config/constants";

export const userRoleValues = ["admin", "editor"] as const;

export const entryStatusValues = ["published", "draft"] as const;

export function validateUserRole(role: string): boolean {
  return userRoleValues.includes(role as (typeof userRoleValues)[number]);
}

export function validateEntryStatus(status: string): boolean {
  return entryStatusValues.includes(
    status as (typeof entryStatusValues)[number],
  );
}

export function validateUserEmail(email: string): boolean {
  if (!email) {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateSlug(slug: string): boolean {
  if (!slug) {
    return false;
  }

  const slugRegex = /^[a-z0-9-]+$/;
  return slugRegex.test(slug);
}

export function validateContentTypeSchema(
  schema: Record<string, unknown>,
): boolean {
  if (!schema || typeof schema !== "object") {
    return false;
  }

  return true;
}

export function validateEntryData(data: Record<string, unknown>): boolean {
  if (!data || typeof data !== "object") {
    return false;
  }

  return true;
}

export function validateR2Key(key: string): boolean {
  if (!key) {
    return false;
  }

  return key.length > 0 && key.length <= MAX_R2_KEY_LENGTH;
}

export function validateMimeTypes(mimeType: string): boolean {
  if (!mimeType) {
    return true;
  }

  const mimeRegex = /^[a-z]+\/[a-z0-9.+\\-]+$/i;
  return mimeRegex.test(mimeType);
}

export function validateFilename(filename: string): boolean {
  if (!filename) {
    return false;
  }

  const filenameRegex = /^[^\\/:*?"<>|]+$/;
  return filenameRegex.test(filename) && filename.length <= MAX_FILENAME_LENGTH;
}

export function validateUser(user: {
  email: string;
  password_hash?: string;
  role: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!validateUserEmail(user.email)) {
    errors.push("Invalid email format");
  }

  if (!validateUserRole(user.role)) {
    errors.push(`Invalid role: ${user.role}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateSession(session: {
  user_id: string;
  expires_at: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  Validator.string(session.user_id, "user_id");

  if (typeof session.expires_at !== "string") {
    errors.push("expires_at must be a string");
  } else {
    const expiryDate = new Date(session.expires_at);
    if (isNaN(expiryDate.getTime())) {
      errors.push("expires_at must be a valid ISO timestamp");
    } else if (expiryDate < new Date()) {
      errors.push("Session has expired");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateContentType(contentType: {
  slug: string;
  name: string;
  fields_schema: Record<string, unknown>;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!validateSlug(contentType.slug)) {
    errors.push(`Invalid slug: ${contentType.slug}`);
  }

  if (
    !contentType.name ||
    contentType.name.length > MAX_CONTENT_TYPE_NAME_LENGTH
  ) {
    errors.push(
      `name must be between 1 and ${MAX_CONTENT_TYPE_NAME_LENGTH} characters`,
    );
  }

  if (!validateContentTypeSchema(contentType.fields_schema)) {
    errors.push("fields_schema must be a valid object");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateEntry(entry: {
  type_slug: string;
  slug?: string;
  title: string;
  data: Record<string, unknown>;
  status: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!validateSlug(entry.type_slug)) {
    errors.push(`Invalid type_slug: ${entry.type_slug}`);
  }

  if (entry.slug && !validateSlug(entry.slug)) {
    errors.push(`Invalid slug: ${entry.slug}`);
  }

  if (!entry.title || entry.title.length > MAX_ENTRY_TITLE_LENGTH) {
    errors.push(
      `title must be between 1 and ${MAX_ENTRY_TITLE_LENGTH} characters`,
    );
  }

  if (!validateEntryData(entry.data)) {
    errors.push("data must be a valid object");
  }

  if (!validateEntryStatus(entry.status)) {
    errors.push(`Invalid status: ${entry.status}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateAsset(asset: {
  filename: string;
  r2_key: string;
  mime_type?: string;
  public_url?: string;
  entry_id?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!validateFilename(asset.filename)) {
    errors.push(`Invalid filename: ${asset.filename}`);
  }

  if (!validateR2Key(asset.r2_key)) {
    errors.push(`Invalid r2_key: ${asset.r2_key}`);
  }

  if (asset.mime_type && !validateMimeTypes(asset.mime_type)) {
    errors.push(`Invalid mime_type: ${asset.mime_type}`);
  }

  if (asset.entry_id) {
    Validator.uuid(asset.entry_id, "entry_id");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
