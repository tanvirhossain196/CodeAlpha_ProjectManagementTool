import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectRole } from "../middleware/projectAccess.js";
import * as ctrl from "../controllers/task.controller.js";

export const projectTaskRouter=Router();
projectTaskRouter.use(requireAuth);
projectTaskRouter.get("/:id/tasks",requireProjectRole("MEMBER"),ctrl.list);
projectTaskRouter.post("/:id/tasks",requireProjectRole("MEMBER"),ctrl.create);

const router=Router();
router.use(requireAuth);
router.get("/",ctrl.myList);
router.get("/:id",ctrl.get);
router.put("/:id",ctrl.update);
router.delete("/:id",ctrl.remove);
router.patch("/:id/status",ctrl.move);
router.patch("/:id/assignee",ctrl.assign);
router.get("/:id/activity",ctrl.activity);
export default router;
