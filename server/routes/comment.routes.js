import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as ctrl from "../controllers/comment.controller.js";

export const taskCommentRouter=Router();
taskCommentRouter.use(requireAuth);
taskCommentRouter.get("/:id/comments",ctrl.list);
taskCommentRouter.post("/:id/comments",ctrl.create);

const router=Router();
router.use(requireAuth);
router.put("/:id",ctrl.update);
router.delete("/:id",ctrl.remove);
export default router;
