import { ValidationError } from "./errors";

export interface ValidationRule {
  validate: (value: unknown, fieldName?: string) => void;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SanitizeOptions {
  trim?: boolean;
  escapeHtml?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
}

export class Validator {
  static required(value: unknown, fieldName: string = "field"): void {
    if (value === null || value === undefined || value === "") {
      throw new ValidationError(`${fieldName} is required`);
    }
  }

  static string(value: unknown, fieldName: string = "field"): void {
    if (typeof value !== "string") {
      const actualType = typeof value;
      const valuePreview =
        actualType === "object" && value !== null
          ? "[object]"
          : actualType === "string"
            ? `"${String(value).slice(0, 50)}"`
            : String(value).slice(0, 50);
      throw new ValidationError(
        `${fieldName} must be a string, received: ${actualType} (value: ${valuePreview})`,
      );
    }
  }

  static number(value: unknown, fieldName: string = "field"): void {
    if (typeof value !== "number" || isNaN(value)) {
      const actualType = typeof value;
      const valuePreview =
        actualType === "number"
          ? "NaN"
          : actualType === "object" && value !== null
            ? "[object]"
            : actualType === "string"
              ? `"${String(value).slice(0, 50)}"`
              : String(value).slice(0, 50);
      throw new ValidationError(
        `${fieldName} must be a number, received: ${actualType} (value: ${valuePreview})`,
      );
    }
  }

  static integer(value: unknown, fieldName: string = "field"): void {
    this.number(value, fieldName);
    if (!Number.isInteger(value as number)) {
      throw new ValidationError(
        `${fieldName} must be an integer, received: ${value}`,
      );
    }
  }

  static boolean(value: unknown, fieldName: string = "field"): void {
    if (typeof value !== "boolean") {
      throw new ValidationError(
        `${fieldName} must be a boolean, received: ${typeof value}`,
      );
    }
  }

  static array(value: unknown, fieldName: string = "field"): void {
    if (!Array.isArray(value)) {
      const actualType = value === null ? "null" : typeof value;
      throw new ValidationError(
        `${fieldName} must be an array, received: ${actualType}`,
      );
    }
  }

  static email(value: unknown, fieldName: string = "field"): void {
    this.string(value, fieldName);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value as string)) {
      throw new ValidationError(`${fieldName} must be a valid email address`);
    }
  }

  static url(value: unknown, fieldName: string = "field"): void {
    this.string(value, fieldName);
    try {
      new URL(value as string);
    } catch {
      throw new ValidationError(`${fieldName} must be a valid URL`);
    }
  }

  static httpsUrl(value: unknown, fieldName: string = "field"): void {
    this.string(value, fieldName);
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(value as string);
    } catch {
      throw new ValidationError(`${fieldName} must be a valid URL`);
    }

    const isLocalhost =
      parsedUrl.hostname === "localhost" ||
      parsedUrl.hostname === "127.0.0.1" ||
      parsedUrl.hostname === "[::1]" ||
      parsedUrl.hostname.endsWith(".localhost");

    if (parsedUrl.protocol !== "https:" && !isLocalhost) {
      throw new ValidationError(
        `${fieldName} must use HTTPS (got: ${parsedUrl.protocol})`,
      );
    }
  }

  static uuid(value: unknown, fieldName: string = "field"): void {
    this.string(value, fieldName);
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value as string)) {
      throw new ValidationError(`${fieldName} must be a valid UUID`);
    }
  }

  static minLength(
    value: unknown,
    min: number,
    fieldName: string = "field",
  ): void {
    this.string(value, fieldName);
    const strValue = value as string;
    if (strValue.length < min) {
      throw new ValidationError(
        `${fieldName} must be at least ${min} characters long (got: ${strValue.length})`,
      );
    }
  }

  static maxLength(
    value: unknown,
    max: number,
    fieldName: string = "field",
  ): void {
    this.string(value, fieldName);
    const strValue = value as string;
    if (strValue.length > max) {
      throw new ValidationError(
        `${fieldName} must be no more than ${max} characters long (got: ${strValue.length})`,
      );
    }
  }

  static min(value: unknown, min: number, fieldName: string = "field"): void {
    this.number(value, fieldName);
    const numValue = value as number;
    if (numValue < min) {
      throw new ValidationError(
        `${fieldName} must be at least ${min} (got: ${numValue})`,
      );
    }
  }

  static max(value: unknown, max: number, fieldName: string = "field"): void {
    this.number(value, fieldName);
    const numValue = value as number;
    if (numValue > max) {
      throw new ValidationError(
        `${fieldName} must be no more than ${max} (got: ${numValue})`,
      );
    }
  }

  static enum<T extends string>(
    value: unknown,
    allowedValues: readonly T[],
    fieldName: string = "field",
  ): void {
    this.string(value, fieldName);
    if (!allowedValues.includes(value as T)) {
      throw new ValidationError(
        `${fieldName} must be one of: ${allowedValues.join(", ")}`,
      );
    }
  }

  static pattern(
    value: unknown,
    regex: RegExp,
    fieldName: string = "field",
  ): void {
    this.string(value, fieldName);
    if (!regex.test(value as string)) {
      throw new ValidationError(
        `${fieldName} does not match required pattern: ${regex.source}`,
      );
    }
  }

  static sanitize(value: unknown, options: SanitizeOptions = {}): unknown {
    if (typeof value !== "string") {
      return value;
    }

    let result = value as string;

    if (options.trim) {
      result = result.trim();
    }

    if (options.lowercase) {
      result = result.toLowerCase();
    }

    if (options.uppercase) {
      result = result.toUpperCase();
    }

    if (options.escapeHtml) {
      result = result
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    return result;
  }

  static sanitizeObject(
    obj: Record<string, unknown>,
    fieldSanitizers: Record<string, SanitizeOptions>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const options = fieldSanitizers[key];
      result[key] = options ? this.sanitize(value, options) : value;
    }

    return result;
  }

  static validateAll(validations: Array<() => void>): ValidationResult {
    const errors: string[] = [];

    for (const validation of validations) {
      try {
        validation();
      } catch (error) {
        if (error instanceof ValidationError) {
          errors.push(error.message);
        } else {
          errors.push(String(error));
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export class SchemaValidator<T extends Record<string, unknown>> {
  private rules: Map<keyof T, ValidationRule[]> = new Map();

  addField<K extends keyof T>(
    field: K,
    ...rules: ValidationRule[]
  ): SchemaValidator<T> {
    this.rules.set(field, rules);
    return this;
  }

  validate(data: Partial<T>): T {
    const result = { ...data } as T;
    const errors: string[] = [];

    for (const [field, rules] of this.rules.entries()) {
      const value = data[field];

      try {
        for (const rule of rules) {
          rule.validate(value, field as string);
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          errors.push(error.message);
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError("Validation failed", {
        errors,
      });
    }

    return result;
  }

  validatePartial(data: Partial<T>): ValidationResult {
    const errors: string[] = [];

    for (const [field, rules] of this.rules.entries()) {
      const value = data[field];

      if (value === undefined || value === null) {
        continue;
      }

      try {
        for (const rule of rules) {
          rule.validate(value, field as string);
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          errors.push(error.message);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export function createValidator(): SchemaValidator<Record<string, unknown>> {
  return new SchemaValidator<Record<string, unknown>>();
}

export function validateEmail(email: unknown): boolean {
  try {
    Validator.email(email);
    return true;
  } catch {
    return false;
  }
}

export function validateUrl(url: unknown): boolean {
  try {
    Validator.url(url);
    return true;
  } catch {
    return false;
  }
}

export function validateUuid(uuid: unknown): boolean {
  try {
    Validator.uuid(uuid);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeInput(
  input: unknown,
  escapeHtml: boolean = true,
): unknown {
  return Validator.sanitize(input, { trim: true, escapeHtml });
}
