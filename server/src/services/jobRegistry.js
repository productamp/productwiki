/**
 * In-memory job registry for SSE stream reconnection
 * Allows clients to reconnect to running jobs and receive buffered + live events
 */

// Map of jobId -> Job
const jobs = new Map();

// Cleanup interval (5 minutes after completion)
const CLEANUP_DELAY_MS = 5 * 60 * 1000;

/**
 * @typedef {Object} Job
 * @property {string} id - Job identifier
 * @property {'running' | 'complete' | 'error'} status - Job status
 * @property {Array} events - Buffered events
 * @property {Set<Function>} subscribers - Active SSE subscribers
 * @property {Promise} promise - Resolves when job completes
 * @property {Function} resolve - Resolve the promise
 * @property {number} completedAt - Timestamp when job completed
 */

/**
 * Create a new job
 * @param {string} jobId - Unique job identifier
 * @returns {Job}
 */
export function createJob(jobId) {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });

  const job = {
    id: jobId,
    status: 'running',
    events: [],
    subscribers: new Set(),
    promise,
    resolve,
    completedAt: null,
  };

  jobs.set(jobId, job);
  return job;
}

/**
 * Get an existing job
 * @param {string} jobId
 * @returns {Job|undefined}
 */
export function getJob(jobId) {
  return jobs.get(jobId);
}

/**
 * Check if a job is currently running
 * @param {string} jobId
 * @returns {boolean}
 */
export function isJobRunning(jobId) {
  const job = jobs.get(jobId);
  return job && job.status === 'running';
}

/**
 * Push an event to a job (buffers and notifies subscribers)
 * @param {string} jobId
 * @param {Object} event
 */
export function pushEvent(jobId, event) {
  const job = jobs.get(jobId);
  if (!job) return;

  // Buffer the event
  job.events.push(event);

  // Notify all subscribers
  for (const callback of job.subscribers) {
    try {
      callback(event);
    } catch (err) {
      // Subscriber failed, remove it
      job.subscribers.delete(callback);
    }
  }
}

/**
 * Subscribe to job events
 * @param {string} jobId
 * @param {Function} callback - Called for each new event
 * @returns {Function} Unsubscribe function
 */
export function subscribe(jobId, callback) {
  const job = jobs.get(jobId);
  if (!job) return () => {};

  job.subscribers.add(callback);

  return () => {
    job.subscribers.delete(callback);
  };
}

/**
 * Mark a job as complete
 * @param {string} jobId
 */
export function completeJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'complete';
  job.completedAt = Date.now();
  job.resolve();

  // Schedule cleanup
  setTimeout(() => {
    const currentJob = jobs.get(jobId);
    if (currentJob && currentJob.completedAt === job.completedAt) {
      jobs.delete(jobId);
    }
  }, CLEANUP_DELAY_MS);
}

/**
 * Mark a job as failed
 * @param {string} jobId
 * @param {string} error
 */
export function failJob(jobId, error) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'error';
  job.error = error;
  job.completedAt = Date.now();
  job.resolve();

  // Schedule cleanup
  setTimeout(() => {
    const currentJob = jobs.get(jobId);
    if (currentJob && currentJob.completedAt === job.completedAt) {
      jobs.delete(jobId);
    }
  }, CLEANUP_DELAY_MS);
}

/**
 * Get all buffered events for a job
 * @param {string} jobId
 * @returns {Array}
 */
export function getBufferedEvents(jobId) {
  const job = jobs.get(jobId);
  return job ? [...job.events] : [];
}

/**
 * Delete a job (for manual cleanup)
 * @param {string} jobId
 */
export function deleteJob(jobId) {
  jobs.delete(jobId);
}

/**
 * Get job count (for debugging)
 * @returns {number}
 */
export function getJobCount() {
  return jobs.size;
}
