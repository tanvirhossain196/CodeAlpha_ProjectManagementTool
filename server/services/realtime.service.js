export function emitProject(io, projectId, event, payload) {
  if (io && projectId) io.to(`project:${projectId}`).emit(event, payload);
}
export function emitUser(io, userId, event, payload) {
  if (io && userId) io.to(`user:${userId}`).emit(event, payload);
}
