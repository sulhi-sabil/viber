import {
  getServiceFactory,
  getSupabase,
  getGemini,
  getConfiguredServices,
  resetServices,
} from "./services";

jest.mock("../../src/index", () => ({
  ServiceFactory: {
    getInstance: jest.fn(() => ({
      createSupabaseClient: jest.fn((config) => ({
        config,
        healthCheck: jest.fn(),
      })),
      createGeminiClient: jest.fn((config) => ({
        config,
        healthCheck: jest.fn(),
        getRateLimiterStatus: jest.fn(),
      })),
      resetAllServices: jest.fn(),
    })),
  },
}));

describe("services", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    resetServices();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("getConfiguredServices", () => {
    it("should return false when env vars are not set", () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
      delete process.env.GEMINI_API_KEY;

      const result = getConfiguredServices();

      expect(result).toEqual({
        supabase: false,
        gemini: false,
      });
    });

    it("should return true when Supabase env vars are set", () => {
      process.env.SUPABASE_URL = "https://test.supabase.co";
      process.env.SUPABASE_ANON_KEY = "test-key";

      const result = getConfiguredServices();

      expect(result.supabase).toBe(true);
    });

    it("should return true when Gemini env var is set", () => {
      process.env.GEMINI_API_KEY = "test-api-key";

      const result = getConfiguredServices();

      expect(result.gemini).toBe(true);
    });
  });

  describe("getSupabase", () => {
    it("should return null when env vars are missing", () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      const result = getSupabase();

      expect(result).toBeNull();
    });

    it("should return service when env vars are set", () => {
      process.env.SUPABASE_URL = "https://test.supabase.co";
      process.env.SUPABASE_ANON_KEY = "test-key";

      const result = getSupabase();

      expect(result).not.toBeNull();
    });

    it("should cache the service instance", () => {
      process.env.SUPABASE_URL = "https://test.supabase.co";
      process.env.SUPABASE_ANON_KEY = "test-key";

      const result1 = getSupabase();
      const result2 = getSupabase();

      expect(result1).toBe(result2);
    });
  });

  describe("getGemini", () => {
    it("should return null when env var is missing", () => {
      delete process.env.GEMINI_API_KEY;

      const result = getGemini();

      expect(result).toBeNull();
    });

    it("should return service when env var is set", () => {
      process.env.GEMINI_API_KEY = "test-api-key";

      const result = getGemini();

      expect(result).not.toBeNull();
    });

    it("should use custom model from env", () => {
      process.env.GEMINI_API_KEY = "test-api-key";
      process.env.GEMINI_MODEL = "gemini-2.0-flash";

      const result = getGemini();

      expect(result).not.toBeNull();
    });
  });

  describe("resetServices", () => {
    it("should clear cached service instances", () => {
      process.env.SUPABASE_URL = "https://test.supabase.co";
      process.env.SUPABASE_ANON_KEY = "test-key";
      process.env.GEMINI_API_KEY = "test-api-key";

      const supabase1 = getSupabase();
      const gemini1 = getGemini();

      resetServices();

      const supabase2 = getSupabase();
      const gemini2 = getGemini();

      expect(supabase1).not.toBe(supabase2);
      expect(gemini1).not.toBe(gemini2);
    });
  });
});
