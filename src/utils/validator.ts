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
      throw new ValidationError(`${fieldName} must be a string`);
    }
  }

  static number(value: unknown, fieldName: string = "field"): void {
    if (typeof value !== "number" || isNaN(value)) {
      throw new ValidationError(`${fieldName} must be a number`);
    }
  }

  static integer(value: unknown, fieldName: string = "field"): void {
    this.number(value, fieldName);
    if (!Number.isInteger(value as number)) {
      throw new ValidationError(`${fieldName} must be an integer`);
    }
  }

  static boolean(value: unknown, fieldName: string = "field"): void {
    if (typeof value !== "boolean") {
      throw new ValidationError(`${fieldName} must be a boolean`);
    }
  }

  static array(value: unknown, fieldName: string = "field"): void {
    if (!Array.isArray(value)) {
      throw new ValidationError(`${fieldName} must be an array`);
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
    if ((value as string).length < min) {
      throw new ValidationError(
        `${fieldName} must be at least ${min} characters long`,
      );
    }
  }

  static maxLength(
    value: unknown,
    max: number,
    fieldName: string = "field",
  ): void {
    this.string(value, fieldName);
    if ((value as string).length > max) {
      throw new ValidationError(
        `${fieldName} must be no more than ${max} characters long`,
      );
    }
  }

  static min(value: unknown, min: number, fieldName: string = "field"): void {
    this.number(value, fieldName);
    if ((value as number) < min) {
      throw new ValidationError(`${fieldName} must be at least ${min}`);
    }
  }

  static max(value: unknown, max: number, fieldName: string = "field"): void {
    this.number(value, fieldName);
    if ((value as number) > max) {
      throw new ValidationError(`${fieldName} must be no more than ${max}`);
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
      throw new ValidationError(`${fieldName} does not match required pattern`);
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
