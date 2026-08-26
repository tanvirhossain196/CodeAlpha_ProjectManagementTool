import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as ctrl from "../controllers/time.controller.js";

export const taskTimeRouter = Router();
taskTimeRouter.use(requireAuth);
taskTimeRouter.get("/:id/time", ctrl.list);
taskTimeRouter.post("/:id/time", ctrl.create);

const router = Router();
router.use(requireAuth);
router.delete("/:id", ctrl.remove);
export default router;
