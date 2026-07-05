import { describe, it, expect, beforeEach } from "vitest";
import type { PrismaClient, User } from "@prisma/client";
import { signup, login } from "./service.js";
import { EmailAlreadyExistsError, InvalidCredentialsError } from "./errors.js";

function createFakePrisma() {
  const users: User[] = [];
  let nextId = 1;

  const fakePrisma = {
    user: {
      async findUnique({ where }: { where: { email?: string } }) {
        return users.find((u) => u.email === where.email) ?? null;
      },
      async create({ data }: { data: { email: string; passwordHash: string; displayName: string } }) {
        const user: User = {
          id: String(nextId++),
          email: data.email,
          passwordHash: data.passwordHash,
          displayName: data.displayName,
          createdAt: new Date(),
        };
        users.push(user);
        return user;
      },
    },
  };

  return fakePrisma as unknown as PrismaClient;
}

describe("auth service", () => {
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = createFakePrisma();
  });

  it("signs up a new user with a hashed password", async () => {
    const user = await signup(prisma, {
      email: "a@example.com",
      password: "correcthorsebattery",
      displayName: "Alice",
    });
    expect(user.email).toBe("a@example.com");
    expect(user.passwordHash).not.toBe("correcthorsebattery");
  });

  it("rejects signup with a duplicate email", async () => {
    await signup(prisma, { email: "a@example.com", password: "correcthorsebattery", displayName: "Alice" });
    await expect(
      signup(prisma, { email: "a@example.com", password: "anotherpassword", displayName: "Alice2" }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it("logs in with correct credentials", async () => {
    await signup(prisma, { email: "a@example.com", password: "correcthorsebattery", displayName: "Alice" });
    const user = await login(prisma, { email: "a@example.com", password: "correcthorsebattery" });
    expect(user.email).toBe("a@example.com");
  });

  it("rejects login with an unknown email", async () => {
    await expect(
      login(prisma, { email: "nobody@example.com", password: "whatever" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("rejects login with the wrong password", async () => {
    await signup(prisma, { email: "a@example.com", password: "correcthorsebattery", displayName: "Alice" });
    await expect(
      login(prisma, { email: "a@example.com", password: "wrongpassword" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
