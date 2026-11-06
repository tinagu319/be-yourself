import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { hashSessionToken } from "./crypto";
import { AuthSessionModel } from "../models/AuthSession";

export type AuthenticatedRequest = Request & { userId: Types.ObjectId };

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const authorization = request.header("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const session = await AuthSessionModel.findOne({
      tokenHash: hashSessionToken(token),
      expiresAt: { $gt: new Date() },
    }).select("userId expiresAt");

    if (!session) {
      response.status(401).json({ error: "Session is invalid or expired." });
      return;
    }

    (request as AuthenticatedRequest).userId = session.userId;
    next();
  } catch (error) {
    next(error);
  }
}
