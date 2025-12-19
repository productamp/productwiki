import { getErrorLogs, clearErrorLogs } from '../services/errorLog.js';

export async function logsRoutes(fastify) {
  // Get error logs
  fastify.get('/logs', async () => {
    return { logs: getErrorLogs() };
  });

  // Clear error logs
  fastify.delete('/logs', async () => {
    clearErrorLogs();
    return { success: true };
  });
}
