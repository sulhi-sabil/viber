import { sleep } from "./timing";

describe("timing", () => {
  describe("sleep", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("should resolve after specified time", async () => {
      jest.useFakeTimers();

      const promise = sleep(1000);
      await jest.advanceTimersByTimeAsync(1000);

      await expect(promise).resolves.toBeUndefined();
    });

    it("should resolve with undefined", async () => {
      jest.useFakeTimers();

      const promise = sleep(500);
      await jest.advanceTimersByTimeAsync(500);

      const result = await promise;
      expect(result).toBeUndefined();
    });

    it("should not resolve before time elapses", async () => {
      jest.useFakeTimers();

      const promise = sleep(1000);
      await jest.advanceTimersByTimeAsync(500);

      // Promise should still be pending
      let resolved = false;
      promise.then(() => {
        resolved = true;
      });

      await Promise.resolve();
      expect(resolved).toBe(false);

      // Now advance to completion
      await jest.advanceTimersByTimeAsync(500);
      expect(resolved).toBe(true);
    });

    it("should work with zero delay", async () => {
      jest.useFakeTimers();

      const promise = sleep(0);
      await jest.advanceTimersByTimeAsync(0);

      await expect(promise).resolves.toBeUndefined();
    });

    it("should handle large delays", async () => {
      jest.useFakeTimers();

      const promise = sleep(60000);
      await jest.advanceTimersByTimeAsync(60000);

      await expect(promise).resolves.toBeUndefined();
    });
  });
});
