import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as ctrl from "../controllers/user.controller.js";
const router=Router(); router.use(requireAuth);
router.get("/",ctrl.list);
router.get("/search",ctrl.search);
router.patch("/me",ctrl.updateProfile);
router.get("/:id",ctrl.get);
export default router;
