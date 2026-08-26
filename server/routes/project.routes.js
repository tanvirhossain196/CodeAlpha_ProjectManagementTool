import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectRole } from "../middleware/projectAccess.js";
import * as ctrl from "../controllers/project.controller.js";

const router=Router();
router.use(requireAuth);
router.get("/",ctrl.list);
router.post("/",ctrl.create);
router.patch("/:id/star",requireProjectRole("MEMBER"),ctrl.star);
router.get("/:id",requireProjectRole("MEMBER"),ctrl.get);
router.put("/:id",requireProjectRole("ADMIN"),ctrl.update);
router.delete("/:id",requireProjectRole("OWNER"),ctrl.remove);
router.get("/:id/members",requireProjectRole("MEMBER"),ctrl.members);
router.post("/:id/members",requireProjectRole("ADMIN"),ctrl.addMember);
router.put("/:id/members/:userId",requireProjectRole("OWNER"),ctrl.updateMember);
router.delete("/:id/members/:userId",requireProjectRole("ADMIN"),ctrl.removeMember);
export default router;
