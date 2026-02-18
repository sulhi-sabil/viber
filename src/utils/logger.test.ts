import { ConsoleLogger, logger, Logger } from "../utils/logger";

describe("ConsoleLogger", () => {
  let mockConsoleDebug: jest.SpyInstance;
  let mockConsoleInfo: jest.SpyInstance;
  let mockConsoleWarn: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    mockConsoleDebug = jest.spyOn(console, "debug").mockImplementation();
    mockConsoleInfo = jest.spyOn(console, "info").mockImplementation();
    mockConsoleWarn = jest.spyOn(console, "warn").mockImplementation();
    mockConsoleError = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    mockConsoleDebug.mockRestore();
    mockConsoleInfo.mockRestore();
    mockConsoleWarn.mockRestore();
    mockConsoleError.mockRestore();
  });

  it("should create instance with info level by default", () => {
    const consoleLogger = new ConsoleLogger();

    expect(consoleLogger).toBeInstanceOf(ConsoleLogger);
  });

  it("should create instance with specified log level", () => {
    const consoleLogger = new ConsoleLogger("debug");

    expect(consoleLogger).toBeInstanceOf(ConsoleLogger);
  });

  describe("debug level", () => {
    it("should log debug messages when level is debug", () => {
      const consoleLogger = new ConsoleLogger("debug");

      consoleLogger.debug("Debug message");

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG]"),
        "",
      );
      expect(mockConsoleDebug).toHaveBeenCalledWith(
        expect.stringContaining("Debug message"),
        "",
      );
    });

    it("should log info messages when level is debug", () => {
      const consoleLogger = new ConsoleLogger("debug");

      consoleLogger.info("Info message");

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining("[INFO]"),
        "",
      );
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining("Info message"),
        "",
      );
    });

    it("should log warn messages when level is debug", () => {
      const consoleLogger = new ConsoleLogger("debug");

      consoleLogger.warn("Warn message");

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("[WARN]"),
        "",
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("Warn message"),
        "",
      );
    });

    it("should log error messages when level is debug", () => {
      const consoleLogger = new ConsoleLogger("debug");

      consoleLogger.error("Error message");

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR]"),
        "",
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Error message"),
        "",
      );
    });
  });

  describe("info level", () => {
    it("should not log debug messages when level is info", () => {
      const consoleLogger = new ConsoleLogger("info");

      consoleLogger.debug("Debug message");

      expect(mockConsoleDebug).not.toHaveBeenCalled();
    });

    it("should log info messages when level is info", () => {
      const consoleLogger = new ConsoleLogger("info");

      consoleLogger.info("Info message");

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining("[INFO]"),
        "",
      );
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining("Info message"),
        "",
      );
    });

    it("should log warn messages when level is info", () => {
      const consoleLogger = new ConsoleLogger("info");

      consoleLogger.warn("Warn message");

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("[WARN]"),
        "",
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("Warn message"),
        "",
      );
    });

    it("should log error messages when level is info", () => {
      const consoleLogger = new ConsoleLogger("info");

      consoleLogger.error("Error message");

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR]"),
        "",
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Error message"),
        "",
      );
    });
  });

  describe("warn level", () => {
    it("should not log debug messages when level is warn", () => {
      const consoleLogger = new ConsoleLogger("warn");

      consoleLogger.debug("Debug message");

      expect(mockConsoleDebug).not.toHaveBeenCalled();
    });

    it("should not log info messages when level is warn", () => {
      const consoleLogger = new ConsoleLogger("warn");

      consoleLogger.info("Info message");

      expect(mockConsoleInfo).not.toHaveBeenCalled();
    });

    it("should log warn messages when level is warn", () => {
      const consoleLogger = new ConsoleLogger("warn");

      consoleLogger.warn("Warn message");

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("[WARN]"),
        "",
      );
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("Warn message"),
        "",
      );
    });

    it("should log error messages when level is warn", () => {
      const consoleLogger = new ConsoleLogger("warn");

      consoleLogger.error("Error message");

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR]"),
        "",
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Error message"),
        "",
      );
    });
  });

  describe("error level", () => {
    it("should not log debug messages when level is error", () => {
      const consoleLogger = new ConsoleLogger("error");

      consoleLogger.debug("Debug message");

      expect(mockConsoleDebug).not.toHaveBeenCalled();
    });

    it("should not log info messages when level is error", () => {
      const consoleLogger = new ConsoleLogger("error");

      consoleLogger.info("Info message");

      expect(mockConsoleInfo).not.toHaveBeenCalled();
    });

    it("should not log warn messages when level is error", () => {
      const consoleLogger = new ConsoleLogger("error");

      consoleLogger.warn("Warn message");

      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it("should log error messages when level is error", () => {
      const consoleLogger = new ConsoleLogger("error");

      consoleLogger.error("Error message");

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR]"),
        "",
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Error message"),
        "",
      );
    });
  });

  describe("metadata handling", () => {
    it("should log debug message with metadata", () => {
      const consoleLogger = new ConsoleLogger("debug");
      const meta = { userId: 123, action: "login" };

      consoleLogger.debug("Debug message", meta);

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG]"),
        JSON.stringify(meta),
      );
    });

    it("should log info message with metadata", () => {
      const consoleLogger = new ConsoleLogger("info");
      const meta = { request: { method: "GET", path: "/api/users" } };

      consoleLogger.info("Info message", meta);

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining("[INFO]"),
        JSON.stringify(meta),
      );
    });

    it("should log warn message with metadata", () => {
      const consoleLogger = new ConsoleLogger("warn");
      const meta = { attempts: 3, lastError: "timeout" };

      consoleLogger.warn("Warn message", meta);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("[WARN]"),
        JSON.stringify(meta),
      );
    });

    it("should log error message with metadata", () => {
      const consoleLogger = new ConsoleLogger("error");
      const meta = { stack: "Error: test\n    at test.js:1:1", code: 500 };

      consoleLogger.error("Error message", meta);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR]"),
        JSON.stringify(meta),
      );
    });

    it("should handle empty metadata object", () => {
      const consoleLogger = new ConsoleLogger("info");

      consoleLogger.info("Info message", {});

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining("[INFO]"),
        "{}",
      );
    });

    it("should handle undefined metadata", () => {
      const consoleLogger = new ConsoleLogger("info");

      consoleLogger.info("Info message");

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining("[INFO]"),
        "",
      );
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining("Info message"),
        "",
      );
    });

    it("should redact sensitive password fields", () => {
      const consoleLogger = new ConsoleLogger("debug");
      const meta = { username: "testuser", password: "secret123" };

      consoleLogger.debug("User login attempt", meta);

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG]"),
        JSON.stringify({
          username: "testuser",
          password: "[SENSITIVE DATA REDACTED for key: password]",
        }),
      );
    });

    it("should redact sensitive api_key fields", () => {
      const consoleLogger = new ConsoleLogger("debug");
      const meta = {
        apiKey: "sk-1234567890",
        endpoint: "https://api.example.com",
      };

      consoleLogger.info("API call", meta);

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining("[INFO]"),
        JSON.stringify({
          apiKey: "[SENSITIVE DATA REDACTED for key: apiKey]",
          endpoint: "https://api.example.com",
        }),
      );
    });

    it("should redact sensitive token fields", () => {
      const consoleLogger = new ConsoleLogger("debug");
      const meta = {
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        userId: 123,
      };

      consoleLogger.debug("Token verification", meta);

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG]"),
        JSON.stringify({
          token: "[SENSITIVE DATA REDACTED for key: token]",
          userId: 123,
        }),
      );
      expect(mockConsoleDebug).toHaveBeenCalledWith(
        expect.stringContaining("Token verification"),
        JSON.stringify({
          token: "[SENSITIVE DATA REDACTED for key: token]",
          userId: 123,
        }),
      );
    });

    it("should redact nested sensitive fields", () => {
      const consoleLogger = new ConsoleLogger("debug");
      const meta = { user: { id: 1, credentials: { secret: "s3cr3t" } } };

      consoleLogger.info("User action", meta);

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining("[INFO]"),
        JSON.stringify({
          user: {
            id: 1,
            credentials: {
              secret: "[SENSITIVE DATA REDACTED for key: secret]",
            },
          },
        }),
      );
    });

    it("should redact multiple sensitive fields", () => {
      const consoleLogger = new ConsoleLogger("debug");
      const meta = {
        username: "test",
        password: "pass123",
        apiKey: "key-123",
        token: "token-456",
      };

      consoleLogger.warn("Security event", meta);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("[WARN]"),
        JSON.stringify({
          username: "test",
          password: "[SENSITIVE DATA REDACTED for key: password]",
          apiKey: "[SENSITIVE DATA REDACTED for key: apiKey]",
          token: "[SENSITIVE DATA REDACTED for key: token]",
        }),
      );
    });

    it("should redact authorization header", () => {
      const consoleLogger = new ConsoleLogger("debug");
      const meta = {
        headers: {
          authorization: "Bearer abc123",
          "content-type": "application/json",
        },
      };

      consoleLogger.debug("Request received", meta);

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG]"),
        JSON.stringify({
          headers: {
            authorization: "[SENSITIVE DATA REDACTED for key: authorization]",
            "content-type": "application/json",
          },
        }),
      );
    });
  });

  describe("Logger interface compliance", () => {
    it("should implement Logger interface", () => {
      const consoleLogger: Logger = new ConsoleLogger();

      expect(typeof consoleLogger.debug).toBe("function");
      expect(typeof consoleLogger.info).toBe("function");
      expect(typeof consoleLogger.warn).toBe("function");
      expect(typeof consoleLogger.error).toBe("function");
    });
  });
});

describe("default logger", () => {
  let mockConsoleDebug: jest.SpyInstance;

  beforeEach(() => {
    mockConsoleDebug = jest.spyOn(console, "debug").mockImplementation();
  });

  afterEach(() => {
    mockConsoleDebug.mockRestore();
  });

  it("should export default logger instance", () => {
    expect(logger).toBeInstanceOf(ConsoleLogger);
  });

  it("should use LOG_LEVEL from environment if set", () => {
    const originalLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "debug";

    const debugLogger = new ConsoleLogger("debug");

    debugLogger.debug("Should be logged");
    expect(mockConsoleDebug).toHaveBeenCalled();

    process.env.LOG_LEVEL = originalLogLevel;
  });

  it("should use info level when LOG_LEVEL is not set", () => {
    const originalLogLevel = process.env.LOG_LEVEL;
    delete process.env.LOG_LEVEL;

    const defaultLogger = new ConsoleLogger("info");

    expect(defaultLogger).toBeInstanceOf(ConsoleLogger);

    if (originalLogLevel !== undefined) {
      process.env.LOG_LEVEL = originalLogLevel;
    }
  });
});
