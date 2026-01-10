const crypto = require("crypto");

jest.mock("uuid", () => {
  const mockV4 = () => crypto.randomUUID();

  return {
    v4: mockV4,
  };
});
