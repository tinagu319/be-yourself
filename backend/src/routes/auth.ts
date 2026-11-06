import { Router } from "express";
import { AuthSessionModel } from "../models/AuthSession";
import { UserModel } from "../models/User";
import { createSession, hashPassword, hashSessionToken, verifyPassword } from "../auth/crypto";
import { AuthenticatedRequest, requireAuth } from "../auth/requireAuth";

const router = Router();

function normalizeNickname(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function publicUser(user: { _id: unknown; nickname: string; registeredAt: Date }) {
  return { id: user._id, nickname: user.nickname, registeredAt: user.registeredAt };
}

router.post("/register", async (request, response, next) => {
  const nickname = normalizeNickname(request.body?.nickname);
  const password = request.body?.password;
  if (nickname.length < 2 || nickname.length > 40) {
    response.status(400).json({ error: "Username must be between 2 and 40 characters." });
    return;
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    response.status(400).json({ error: "Password must be between 8 and 128 characters." });
    return;
  }

  try {
    const nicknameKey = nickname.toLowerCase();
    const credentials = await hashPassword(password);
    const user = await UserModel.create({
      nickname,
      nicknameKey,
      passwordSalt: credentials.salt,
      passwordHash: credentials.hash,
    });
    const session = await createSession(user._id);
    response.status(201).json({ user: publicUser(user), ...session });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      response.status(409).json({ error: "That username is already in use." });
      return;
    }
    next(error);
  }
});

router.post("/login", async (request, response, next) => {
  const nickname = normalizeNickname(request.body?.nickname);
  const password = request.body?.password;
  if (!nickname || typeof password !== "string") {
    response.status(400).json({ error: "Username and password are required." });
    return;
  }

  try {
    const user = await UserModel.findOne({ nicknameKey: nickname.toLowerCase() })
      .select("+passwordSalt +passwordHash");
    if (!user || !(await verifyPassword(password, user.passwordSalt, user.passwordHash))) {
      response.status(401).json({ error: "Username or password is incorrect." });
      return;
    }

    const session = await createSession(user._id);
    response.json({ user: publicUser(user), ...session });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (request, response, next) => {
  try {
    const user = await UserModel.findById((request as AuthenticatedRequest).userId)
      .select("nickname registeredAt");
    if (!user) {
      response.status(401).json({ error: "User account no longer exists." });
      return;
    }
    response.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireAuth, async (request, response, next) => {
  const token = request.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }
  try {
    await AuthSessionModel.deleteOne({ tokenHash: hashSessionToken(token) });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
