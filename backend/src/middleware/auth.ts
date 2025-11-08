import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.tokens) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}
