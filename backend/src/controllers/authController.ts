import { Request, Response } from "express";
import { google } from "googleapis";
import { oauth2Client } from "../config/clients.js";

export function status(req: Request, res: Response) {
  res.json({ authenticated: !!req.session.tokens, email: req.session.email });
}

export function start(req: Request, res: Response) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });
  res.redirect(authUrl);
}

export async function callback(req: Request, res: Response) {
  const { code } = req.query;
  if (!code || typeof code !== "string") {
    return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}?error=no_code`);
  }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    req.session.email = userInfo.data.email || undefined;
    res.redirect(process.env.FRONTEND_URL || "http://localhost:5173");
  } catch (error) {
    console.error("Error during OAuth callback:", error);
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}?error=auth_failed`);
  }
}

export function logout(req: Request, res: Response) {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).json({ error: "Failed to logout" });
    }
    res.json({ success: true });
  });
}


