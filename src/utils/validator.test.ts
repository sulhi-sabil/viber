import {
  Validator,
  createValidator,
  validateEmail,
  validateUrl,
  validateUuid,
  sanitizeInput,
} from "../utils/validator";
import { ValidationError } from "../utils/errors";

describe("Validator", () => {
  describe("required", () => {
    it("should pass for non-empty values", () => {
      expect(() => Validator.required("test")).not.toThrow();
      expect(() => Validator.required(0)).not.toThrow();
      expect(() => Validator.required(false)).not.toThrow();
    });

    it("should throw for null, undefined, or empty string", () => {
      expect(() => Validator.required(null)).toThrow(ValidationError);
      expect(() => Validator.required(undefined)).toThrow(ValidationError);
      expect(() => Validator.required("")).toThrow(ValidationError);
    });

    it("should include field name in error message", () => {
      expect(() => Validator.required(null, "email")).toThrow(
        "email is required",
      );
    });
  });

  describe("string", () => {
    it("should pass for strings", () => {
      expect(() => Validator.string("test")).not.toThrow();
    });

    it("should throw for non-strings", () => {
      expect(() => Validator.string(123)).toThrow(ValidationError);
      expect(() => Validator.string(null)).toThrow(ValidationError);
      expect(() => Validator.string(undefined)).toThrow(ValidationError);
    });
  });

  describe("number", () => {
    it("should pass for numbers", () => {
      expect(() => Validator.number(123)).not.toThrow();
      expect(() => Validator.number(0)).not.toThrow();
      expect(() => Validator.number(-1)).not.toThrow();
      expect(() => Validator.number(1.5)).not.toThrow();
    });

    it("should throw for non-numbers and NaN", () => {
      expect(() => Validator.number("123")).toThrow(ValidationError);
      expect(() => Validator.number(null)).toThrow(ValidationError);
      expect(() => Validator.number(NaN)).toThrow(ValidationError);
    });
  });

  describe("integer", () => {
    it("should pass for integers", () => {
      expect(() => Validator.integer(123)).not.toThrow();
      expect(() => Validator.integer(0)).not.toThrow();
      expect(() => Validator.integer(-1)).not.toThrow();
    });

    it("should throw for non-integers", () => {
      expect(() => Validator.integer(1.5)).toThrow(ValidationError);
      expect(() => Validator.integer("123")).toThrow(ValidationError);
    });
  });

  describe("boolean", () => {
    it("should pass for booleans", () => {
      expect(() => Validator.boolean(true)).not.toThrow();
      expect(() => Validator.boolean(false)).not.toThrow();
    });

    it("should throw for non-booleans", () => {
      expect(() => Validator.boolean("true")).toThrow(ValidationError);
      expect(() => Validator.boolean(1)).toThrow(ValidationError);
    });
  });

  describe("array", () => {
    it("should pass for arrays", () => {
      expect(() => Validator.array([])).not.toThrow();
      expect(() => Validator.array([1, 2, 3])).not.toThrow();
    });

    it("should throw for non-arrays", () => {
      expect(() => Validator.array({})).toThrow(ValidationError);
      expect(() => Validator.array("test")).toThrow(ValidationError);
    });
  });

  describe("email", () => {
    it("should pass for valid emails", () => {
      expect(() => Validator.email("test@example.com")).not.toThrow();
      expect(() => Validator.email("user.name@domain.co.uk")).not.toThrow();
      expect(() => Validator.email("user+tag@example.com")).not.toThrow();
    });

    it("should throw for invalid emails", () => {
      expect(() => Validator.email("invalid")).toThrow(ValidationError);
      expect(() => Validator.email("@example.com")).toThrow(ValidationError);
      expect(() => Validator.email("test@")).toThrow(ValidationError);
      expect(() => Validator.email("test@.com")).toThrow(ValidationError);
    });
  });

  describe("url", () => {
    it("should pass for valid URLs", () => {
      expect(() => Validator.url("https://example.com")).not.toThrow();
      expect(() => Validator.url("http://localhost:3000")).not.toThrow();
      expect(() =>
        Validator.url("https://example.com/path?query=value"),
      ).not.toThrow();
    });

    it("should throw for invalid URLs", () => {
      expect(() => Validator.url("not-a-url")).toThrow(ValidationError);
      expect(() => Validator.url("example.com")).toThrow(ValidationError);
    });
  });

  describe("uuid", () => {
    it("should pass for valid UUIDs", () => {
      expect(() =>
        Validator.uuid("550e8400-e29b-41d4-a716-446655440000"),
      ).not.toThrow();
      expect(() =>
        Validator.uuid("f47ac10b-58cc-4372-a567-0e02b2c3d479"),
      ).not.toThrow();
    });

    it("should throw for invalid UUIDs", () => {
      expect(() => Validator.uuid("not-a-uuid")).toThrow(ValidationError);
      expect(() => Validator.uuid("12345")).toThrow(ValidationError);
      expect(() =>
        Validator.uuid("00000000-0000-0000-0000-000000000000"),
      ).toThrow(ValidationError);
    });
  });

  describe("minLength", () => {
    it("should pass for strings meeting minimum length", () => {
      expect(() => Validator.minLength("test", 3)).not.toThrow();
      expect(() => Validator.minLength("test", 4)).not.toThrow();
    });

    it("should throw for strings below minimum length", () => {
      expect(() => Validator.minLength("test", 5)).toThrow(ValidationError);
    });
  });

  describe("maxLength", () => {
    it("should pass for strings within maximum length", () => {
      expect(() => Validator.maxLength("test", 4)).not.toThrow();
      expect(() => Validator.maxLength("test", 5)).not.toThrow();
    });

    it("should throw for strings exceeding maximum length", () => {
      expect(() => Validator.maxLength("test", 3)).toThrow(ValidationError);
    });
  });

  describe("min", () => {
    it("should pass for numbers meeting minimum", () => {
      expect(() => Validator.min(5, 5)).not.toThrow();
      expect(() => Validator.min(10, 5)).not.toThrow();
    });

    it("should throw for numbers below minimum", () => {
      expect(() => Validator.min(3, 5)).toThrow(ValidationError);
    });
  });

  describe("max", () => {
    it("should pass for numbers within maximum", () => {
      expect(() => Validator.max(5, 5)).not.toThrow();
      expect(() => Validator.max(3, 5)).not.toThrow();
    });

    it("should throw for numbers exceeding maximum", () => {
      expect(() => Validator.max(10, 5)).toThrow(ValidationError);
    });
  });

  describe("enum", () => {
    const allowedValues = ["admin", "editor", "viewer"] as const;

    it("should pass for valid enum values", () => {
      expect(() => Validator.enum("admin", allowedValues)).not.toThrow();
      expect(() => Validator.enum("viewer", allowedValues)).not.toThrow();
    });

    it("should throw for invalid enum values", () => {
      expect(() => Validator.enum("unknown", allowedValues)).toThrow(
        ValidationError,
      );
    });

    it("should include allowed values in error message", () => {
      expect(() => Validator.enum("unknown", allowedValues, "role")).toThrow(
        /admin, editor, viewer/,
      );
    });
  });

  describe("pattern", () => {
    it("should pass for strings matching pattern", () => {
      expect(() => Validator.pattern("abc123", /^[a-z0-9]+$/)).not.toThrow();
    });

    it("should throw for strings not matching pattern", () => {
      expect(() => Validator.pattern("abc-123", /^[a-z0-9]+$/)).toThrow(
        ValidationError,
      );
    });
  });

  describe("sanitize", () => {
    it("should trim string when trim option is true", () => {
      expect(Validator.sanitize("  test  ", { trim: true })).toBe("test");
    });

    it("should convert to lowercase when lowercase option is true", () => {
      expect(Validator.sanitize("TEST", { lowercase: true })).toBe("test");
    });

    it("should convert to uppercase when uppercase option is true", () => {
      expect(Validator.sanitize("test", { uppercase: true })).toBe("TEST");
    });

    it("should escape HTML when escapeHtml option is true", () => {
      expect(
        Validator.sanitize("<script>alert('xss')</script>", {
          escapeHtml: true,
        }),
      ).toBe("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
    });

    it("should apply multiple sanitization options", () => {
      expect(
        Validator.sanitize("  <TEST>  ", {
          trim: true,
          escapeHtml: true,
          lowercase: true,
        }),
      ).toBe("&lt;test&gt;");
    });

    it("should return non-string values unchanged", () => {
      expect(Validator.sanitize(123, { trim: true })).toBe(123);
      expect(Validator.sanitize(null, { trim: true })).toBe(null);
    });

    it("should return string unchanged when no options provided", () => {
      expect(Validator.sanitize("  test  ", {})).toBe("  test  ");
    });
  });

  describe("sanitizeObject", () => {
    it("should sanitize specified fields", () => {
      const obj = {
        email: "  TEST@EXAMPLE.COM  ",
        username: "test",
        bio: "  Hello World  ",
      };
      const fieldSanitizers = {
        email: { trim: true, lowercase: true },
        username: { trim: true },
      };

      const result = Validator.sanitizeObject(obj, fieldSanitizers);

      expect(result).toEqual({
        email: "test@example.com",
        username: "test",
        bio: "  Hello World  ",
      });
    });

    it("should escape HTML when specified", () => {
      const obj = {
        content: "<script>alert('xss')</script>",
      };
      const fieldSanitizers = {
        content: { escapeHtml: true },
      };

      const result = Validator.sanitizeObject(obj, fieldSanitizers);

      expect(result.content).toBe(
        "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
      );
    });
  });
});

describe("SchemaValidator", () => {
  it("should validate valid data", () => {
    const schema = createValidator()
      .addField("email", { validate: (v) => Validator.email(v, "email") })
      .addField("username", {
        validate: (v) => {
          Validator.required(v, "username");
          Validator.minLength(v, 3, "username");
        },
      })
      .addField("age", { validate: (v) => Validator.integer(v, "age") })
      .addField("role", {
        validate: (v) =>
          Validator.enum(v, ["admin", "editor", "viewer"] as const, "role"),
      });

    const data = {
      email: "test@example.com",
      username: "john_doe",
      age: 30,
      role: "editor" as const,
    };

    expect(() => schema.validate(data)).not.toThrow();
  });

  it("should throw ValidationError for invalid data", () => {
    const schema = createValidator()
      .addField("email", { validate: (v) => Validator.email(v, "email") })
      .addField("username", {
        validate: (v) => {
          Validator.required(v, "username");
          Validator.minLength(v, 3, "username");
        },
      })
      .addField("age", { validate: (v) => Validator.integer(v, "age") })
      .addField("role", {
        validate: (v) =>
          Validator.enum(v, ["admin", "editor", "viewer"] as const, "role"),
      });

    const data = {
      email: "invalid-email",
      username: "ab",
      age: "thirty" as unknown as number,
      role: "unknown" as const,
    };

    expect(() => schema.validate(data)).toThrow(ValidationError);
  });

  it("should validate partial data with validatePartial", () => {
    const schema = createValidator()
      .addField("email", { validate: (v) => Validator.email(v, "email") })
      .addField("username", {
        validate: (v) => {
          Validator.required(v, "username");
          Validator.minLength(v, 3, "username");
        },
      })
      .addField("age", { validate: (v) => Validator.integer(v, "age") })
      .addField("role", {
        validate: (v) =>
          Validator.enum(v, ["admin", "editor", "viewer"] as const, "role"),
      });

    const partialData = {
      email: "test@example.com",
      username: "john",
    };

    const result = schema.validatePartial(partialData);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("should return errors for invalid partial data", () => {
    const schema = createValidator()
      .addField("email", { validate: (v) => Validator.email(v, "email") })
      .addField("username", {
        validate: (v) => {
          Validator.required(v, "username");
          Validator.minLength(v, 3, "username");
        },
      });

    const partialData = {
      email: "invalid-email",
      username: "ab",
    };

    const result = schema.validatePartial(partialData);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should skip undefined fields in validatePartial", () => {
    const schema = createValidator()
      .addField("email", { validate: (v) => Validator.email(v, "email") })
      .addField("username", {
        validate: (v) => {
          Validator.required(v, "username");
          Validator.minLength(v, 3, "username");
        },
      });

    const partialData = {
      email: "test@example.com",
    };

    const result = schema.validatePartial(partialData);

    expect(result.valid).toBe(true);
  });
});

describe("Helper functions", () => {
  describe("validateEmail", () => {
    it("should return true for valid emails", () => {
      expect(validateEmail("test@example.com")).toBe(true);
    });

    it("should return false for invalid emails", () => {
      expect(validateEmail("invalid")).toBe(false);
    });
  });

  describe("validateUrl", () => {
    it("should return true for valid URLs", () => {
      expect(validateUrl("https://example.com")).toBe(true);
    });

    it("should return false for invalid URLs", () => {
      expect(validateUrl("not-a-url")).toBe(false);
    });
  });

  describe("validateUuid", () => {
    it("should return true for valid UUIDs", () => {
      expect(validateUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    });

    it("should return false for invalid UUIDs", () => {
      expect(validateUuid("not-a-uuid")).toBe(false);
    });
  });

  describe("sanitizeInput", () => {
    it("should trim and escape HTML by default", () => {
      expect(sanitizeInput("  <script>alert('xss')</script>  ")).toBe(
        "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
      );
    });

    it("should only trim when escapeHtml is false", () => {
      expect(sanitizeInput("  <test>  ", false)).toBe("<test>");
    });
  });
});
