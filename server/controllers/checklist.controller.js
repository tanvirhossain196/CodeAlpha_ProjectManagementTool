import { asyncHandler, ok } from "../utils/api.js";
import * as checklist from "../services/checklist.service.js";
import { emitProject } from "../services/realtime.service.js";

export const list = asyncHandler(async (req, res) => {
  const data = await checklist.listItems(req.user.id, req.params.id);
  ok(res, data.items, "Checklist loaded.");
});

export const create = asyncHandler(async (req, res) => {
  const data = await checklist.createItem(req.user.id, req.params.id, req.body);
  emitProject(req.app.get("io"), data.projectId, "checklist:updated", data.item);
  ok(res, data.item, "Checklist item added.", 201);
});

export const update = asyncHandler(async (req, res) => {
  const data = await checklist.updateItem(req.user.id, req.params.id, req.body);
  emitProject(req.app.get("io"), data.projectId, "checklist:updated", data.item);
  ok(res, data.item, "Checklist item updated.");
});

export const remove = asyncHandler(async (req, res) => {
  const data = await checklist.deleteItem(req.user.id, req.params.id);
  emitProject(req.app.get("io"), data.projectId, "checklist:updated", { id: data.id, deleted: true });
  ok(res, data, "Checklist item removed.");
});
