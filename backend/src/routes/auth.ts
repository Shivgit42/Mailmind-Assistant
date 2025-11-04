import { Router } from "express";
import { status, start, callback, logout } from "../controllers/authController.js";

const router = Router();

router.get("/auth/status", status);
router.get("/auth/gmail", start);
router.get("/auth/callback", callback);
router.post("/auth/logout", logout);

export default router;


