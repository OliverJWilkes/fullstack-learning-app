import type { PrismaClient, User } from "@prisma/client";
import { hashPassword, verifyPassword } from "./password.js";
import { EmailAlreadyExistsError, InvalidCredentialsError } from "./errors.js";
import type { SignupInput, LoginInput } from "./schemas.js";

export async function signup(prisma: PrismaClient, input: SignupInput): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new EmailAlreadyExistsError();
  }

  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      displayName: input.displayName,
    },
  });
}

export async function login(prisma: PrismaClient, input: LoginInput): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new InvalidCredentialsError();
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new InvalidCredentialsError();
  }

  return user;
}
