import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

const PREFIX = "Bearer ";

export function createAuthMiddleware(secret: string): RequestHandler {
  const secretBuf = Buffer.from(secret);
  return function authMiddleware(req, res, next) {
    const header = req.get("authorization") || "";
    if (!header.startsWith(PREFIX)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const tokenBuf = Buffer.from(header.slice(PREFIX.length));
    if (tokenBuf.length !== secretBuf.length || !timingSafeEqual(tokenBuf, secretBuf)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  };
}
