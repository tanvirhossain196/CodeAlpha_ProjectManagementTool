import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as ctrl from "../controllers/checklist.controller.js";

export const taskChecklistRouter = Router();
taskChecklistRouter.use(requireAuth);
taskChecklistRouter.get("/:id/checklist", ctrl.list);
taskChecklistRouter.post("/:id/checklist", ctrl.create);

const router = Router();
router.use(requireAuth);
router.patch("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);
export default router;
