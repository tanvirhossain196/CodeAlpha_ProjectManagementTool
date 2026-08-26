import { asyncHandler, ok } from "../utils/api.js";
import * as time from "../services/time.service.js";
import { emitProject } from "../services/realtime.service.js";

export const list = asyncHandler(async (req, res) => {
  const data = await time.listEntries(req.user.id, req.params.id);
  ok(res, data.entries, "Time entries loaded.");
});

export const create = asyncHandler(async (req, res) => {
  const data = await time.createEntry(req.user.id, req.params.id, req.body);
  emitProject(req.app.get("io"), data.projectId, "time:updated", data.entry);
  ok(res, data.entry, "Work time logged.", 201);
});

export const remove = asyncHandler(async (req, res) => {
  const data = await time.deleteEntry(req.user.id, req.params.id);
  emitProject(req.app.get("io"), data.projectId, "time:updated", { id: data.id, deleted: true });
  ok(res, data, "Time entry removed.");
});
