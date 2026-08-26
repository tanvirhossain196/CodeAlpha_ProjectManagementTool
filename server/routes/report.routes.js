import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { overview } from "../controllers/report.controller.js";

const router = Router();
router.use(requireAuth);
router.get("/", overview);
export default router;
