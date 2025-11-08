import express from "express";
import cors from "cors";
import session from "express-session";
import dotenv from "dotenv";
import { Credentials } from "google-auth-library";

// routes
import authRoutes from "./src/routes/auth.js";
import chatRoutes from "./src/routes/chat.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Extend Express Session types
declare module "express-session" {
  interface SessionData {
    tokens?: Credentials;
    email?: string;
    chatHistory?: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;
  }
}

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.set("trust proxy", 1);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "keepitsecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Routes
app.use("/api", authRoutes);
app.use("/api", chatRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Server error:", err);
    res.status(500).json({
      error:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
    });
  }
);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
