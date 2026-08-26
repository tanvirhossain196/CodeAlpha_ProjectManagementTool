import { asyncHandler, ok } from "../utils/api.js";
import * as authService from "../services/auth.service.js";

export const register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body);
  ok(res, data, "Account created successfully.", 201);
});

export const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body.identifier, req.body.password);
  ok(res, data, "Login successful.");
});

export const logout = asyncHandler(async (_req, res) => {
  ok(res, null, "Logout successful. Remove the local bearer token.");
});

export const me = asyncHandler(async (req, res) => ok(res, req.user, "Current user loaded."));
