import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("hashes a password to something other than the plaintext", async () => {
    const hash = await hashPassword("correcthorsebattery");
    expect(hash).not.toBe("correcthorsebattery");
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correcthorsebattery");
    await expect(verifyPassword("correcthorsebattery", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password against a hash", async () => {
    const hash = await hashPassword("correcthorsebattery");
    await expect(verifyPassword("wrongpassword", hash)).resolves.toBe(false);
  });
});
