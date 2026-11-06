import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Types } from "mongoose";
import { AuthSessionModel } from "../models/AuthSession";

const PASSWORD_HASH_BYTES = 64;
export const SESSION_LENGTH_DAYS = 7;

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return new Promise<{ salt: string; hash: string }>((resolve, reject) => {
    scrypt(password, salt, PASSWORD_HASH_BYTES, (error, derivedKey) => {
      if (error) return reject(error);
      resolve({ salt, hash: derivedKey.toString("hex") });
    });
  });
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const { hash } = await hashPassword(password, salt);
  const actual = Buffer.from(hash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: Types.ObjectId) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LENGTH_DAYS * 24 * 60 * 60 * 1000);
  await AuthSessionModel.create({ userId, tokenHash: hashSessionToken(token), expiresAt });
  return { token, expiresAt };
}
