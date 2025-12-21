import { Hono } from 'hono';
import { getJob, getBufferedEvents } from '../services/jobRegistry.js';

export const jobsRoutes = new Hono();

/**
 * Get the status of a job
 * Returns: { status: 'running' | 'complete' | 'error' | 'not_found', eventCount?: number }
 */
jobsRoutes.get('/jobs/:jobId/status', (c) => {
  const jobId = c.req.param('jobId');
  const job = getJob(jobId);

  if (!job) {
    return c.json({ status: 'not_found' });
  }

  return c.json({
    status: job.status,
    eventCount: job.events.length,
  });
});

/**
 * Get all buffered events for a job (for initial state recovery)
 * This allows the frontend to rebuild its state from the event history
 */
jobsRoutes.get('/jobs/:jobId/events', (c) => {
  const jobId = c.req.param('jobId');
  const job = getJob(jobId);

  if (!job) {
    return c.json({ status: 'not_found', events: [] });
  }

  return c.json({
    status: job.status,
    events: getBufferedEvents(jobId),
  });
});
