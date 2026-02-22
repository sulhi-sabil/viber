/**
 * Tests for parseEnvInt utility function
 */
import { parseEnvInt } from "../../utils/validator";

describe("parseEnvInt", () => {
  describe("valid inputs", () => {
    it("should parse valid numeric string", () => {
      expect(parseEnvInt("100", 0)).toBe(100);
    });

    it("should parse negative numbers", () => {
      expect(parseEnvInt("-50", 0)).toBe(-50);
    });

    it("should parse zero", () => {
      expect(parseEnvInt("0", 10)).toBe(0);
    });

    it("should truncate decimal values", () => {
      expect(parseEnvInt("100.5", 0)).toBe(100);
    });
  });

  describe("undefined or empty inputs", () => {
    it("should return default for undefined", () => {
      expect(parseEnvInt(undefined, 42)).toBe(42);
    });

    it("should return default for empty string", () => {
      expect(parseEnvInt("", 42)).toBe(42);
    });
  });

  describe("invalid inputs", () => {
    it("should return default for non-numeric string", () => {
      expect(parseEnvInt("abc", 10)).toBe(10);
    });

    it("should return default for mixed string", () => {
      expect(parseEnvInt("123abc", 0)).toBe(123); // parseInt parses up to first non-numeric char
    });

    it("should return default for special characters", () => {
      expect(parseEnvInt("!@#$", 10)).toBe(10);
    });

    it("should return default for whitespace only", () => {
      expect(parseEnvInt("   ", 10)).toBe(10);
    });
  });

  describe("edge cases", () => {
    it("should handle very large numbers", () => {
      expect(parseEnvInt("2147483647", 0)).toBe(2147483647);
    });

    it("should ignore leading/trailing whitespace", () => {
      // parseInt ignores leading/trailing whitespace
      expect(parseEnvInt("  42  ", 0)).toBe(42);
    });

    it("should handle string with leading zeros", () => {
      expect(parseEnvInt("007", 0)).toBe(7);
    });
  });
});
