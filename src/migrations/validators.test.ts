import {
  validateUser,
  validateSession,
  validateContentType,
  validateEntry,
  validateAsset,
  validateUserRole,
  validateEntryStatus,
  validateUserEmail,
  validateSlug,
} from "./validators";

describe("Database Validators", () => {
  describe("validateUserRole", () => {
    it("should accept valid roles", () => {
      expect(validateUserRole("admin")).toBe(true);
      expect(validateUserRole("editor")).toBe(true);
    });

    it("should reject invalid roles", () => {
      expect(validateUserRole("superadmin")).toBe(false);
      expect(validateUserRole("user")).toBe(false);
      expect(validateUserRole("")).toBe(false);
    });
  });

  describe("validateEntryStatus", () => {
    it("should accept valid statuses", () => {
      expect(validateEntryStatus("published")).toBe(true);
      expect(validateEntryStatus("draft")).toBe(true);
    });

    it("should reject invalid statuses", () => {
      expect(validateEntryStatus("archived")).toBe(false);
      expect(validateEntryStatus("")).toBe(false);
    });
  });

  describe("validateUserEmail", () => {
    it("should accept valid emails", () => {
      expect(validateUserEmail("user@example.com")).toBe(true);
      expect(validateUserEmail("test.email+tag@domain.co.uk")).toBe(true);
    });

    it("should reject invalid emails", () => {
      expect(validateUserEmail("")).toBe(false);
      expect(validateUserEmail("invalid")).toBe(false);
      expect(validateUserEmail("no@atsymbol")).toBe(false);
    });
  });

  describe("validateSlug", () => {
    it("should accept valid slugs", () => {
      expect(validateSlug("blog-posts")).toBe(true);
      expect(validateSlug("test-123")).toBe(true);
      expect(validateSlug("simple")).toBe(true);
    });

    it("should reject invalid slugs", () => {
      expect(validateSlug("")).toBe(false);
      expect(validateSlug("UPPERCASE")).toBe(false);
      expect(validateSlug("with_underscore")).toBe(false);
      expect(validateSlug("with spaces")).toBe(false);
      expect(validateSlug("with.dot")).toBe(false);
    });
  });

  describe("validateUser", () => {
    it("should validate valid user", () => {
      const result = validateUser({
        email: "user@example.com",
        role: "editor",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should detect invalid email", () => {
      const result = validateUser({
        email: "invalid",
        role: "editor",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid email format");
    });

    it("should detect invalid role", () => {
      const result = validateUser({
        email: "user@example.com",
        role: "superadmin",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid role: superadmin");
    });
  });

  describe("validateSession", () => {
    it("should validate valid session", () => {
      const expiryDate = new Date(Date.now() + 3600000).toISOString();
      const result = validateSession({
        user_id: "123",
        expires_at: expiryDate,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should detect expired session", () => {
      const expiryDate = new Date(Date.now() - 3600000).toISOString();
      const result = validateSession({
        user_id: "123",
        expires_at: expiryDate,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Session has expired");
    });
  });

  describe("validateContentType", () => {
    it("should validate valid content type", () => {
      const result = validateContentType({
        slug: "blog-posts",
        name: "Blog Posts",
        fields_schema: { title: "string", body: "text" },
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should detect invalid slug", () => {
      const result = validateContentType({
        slug: "Invalid",
        name: "Test",
        fields_schema: {},
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid slug: Invalid");
    });

    it("should detect invalid name length", () => {
      const result = validateContentType({
        slug: "test",
        name: "a".repeat(256),
        fields_schema: {},
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "name must be between 1 and 255 characters",
      );
    });
  });

  describe("validateEntry", () => {
    it("should validate valid entry", () => {
      const result = validateEntry({
        type_slug: "blog-posts",
        title: "Test Entry",
        data: { content: "test" },
        status: "published",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should detect invalid status", () => {
      const result = validateEntry({
        type_slug: "blog-posts",
        title: "Test",
        data: {},
        status: "archived",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid status: archived");
    });

    it("should detect invalid slug", () => {
      const result = validateEntry({
        type_slug: "blog-posts",
        slug: "Invalid",
        title: "Test",
        data: {},
        status: "published",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid slug: Invalid");
    });
  });

  describe("validateAsset", () => {
    it("should validate valid asset", () => {
      const result = validateAsset({
        filename: "image.png",
        r2_key: "assets/image.png",
        mime_type: "image/png",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should validate asset with entry_id", () => {
      const result = validateAsset({
        filename: "image.png",
        r2_key: "assets/image.png",
        mime_type: "image/png",
        entry_id: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should detect invalid filename", () => {
      const result = validateAsset({
        filename: "file/with/slash",
        r2_key: "test",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid filename: file/with/slash");
    });

    it("should detect invalid mime type", () => {
      const result = validateAsset({
        filename: "test.txt",
        r2_key: "test",
        mime_type: "invalid",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid mime_type: invalid");
    });
  });
});
