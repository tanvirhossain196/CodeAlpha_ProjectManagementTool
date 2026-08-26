import { Router } from "express";
import { authLimiter } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/auth.js";
import * as auth from "../controllers/auth.controller.js";

const router = Router();
router.post("/register", authLimiter, auth.register);
router.post("/login", authLimiter, auth.login);
router.post("/logout", requireAuth, auth.logout);
router.get("/me", requireAuth, auth.me);
export default router;
