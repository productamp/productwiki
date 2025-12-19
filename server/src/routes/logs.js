import { Hono } from 'hono';
import { getErrorLogs, clearErrorLogs } from '../services/errorLog.js';

export const logsRoutes = new Hono();

// Get error logs
logsRoutes.get('/logs', (c) => {
  return c.json({ logs: getErrorLogs() });
});

// Clear error logs
logsRoutes.delete('/logs', (c) => {
  clearErrorLogs();
  return c.json({ success: true });
});
