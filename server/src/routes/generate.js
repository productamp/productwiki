import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { generateDocumentation, generatePackagePrompt, generateReimplementPrompt } from '../services/rag.js';
import { logError } from '../services/errorLog.js';
import {
  createJob,
  getJob,
  isJobRunning,
  pushEvent,
  subscribe,
  completeJob,
  failJob,
  getBufferedEvents,
} from '../services/jobRegistry.js';

export const generateRoutes = new Hono();

/**
 * Helper to create a simple content generation handler with job tracking
 * @param {string} type - Generation type (docs, package-prompt, reimplement-prompt)
 * @param {Function} generator - Generator function to use
 */
function createGenerateHandler(type, generator) {
  return async (c) => {
    const { owner, repo } = await c.req.json();

    if (!owner || !repo) {
      return c.json({ error: 'Owner and repo are required' }, 400);
    }

    const jobId = `generate_${type}_${owner}_${repo}`;

    // Check for existing running job
    if (isJobRunning(jobId)) {
      // Reconnect to existing job
      return streamSSE(c, async (stream) => {
        const job = getJob(jobId);

        // Replay buffered events
        const bufferedEvents = getBufferedEvents(jobId);
        for (const event of bufferedEvents) {
          await stream.writeSSE({ data: JSON.stringify(event) });
        }

        // If job already complete, we're done
        if (job.status !== 'running') {
          await stream.writeSSE({ data: '[DONE]' });
          return;
        }

        // Subscribe to new events
        let streamClosed = false;
        const unsubscribe = subscribe(jobId, async (event) => {
          if (streamClosed) return;
          try {
            await stream.writeSSE({ data: JSON.stringify(event) });
          } catch {
            streamClosed = true;
          }
        });

        // Wait for job completion
        await job.promise;
        unsubscribe();

        if (!streamClosed) {
          await stream.writeSSE({ data: '[DONE]' });
        }
      });
    }

    // Create new job
    const job = createJob(jobId);

    const options = {
      preset: c.get('preset'),
      apiKeys: c.get('apiKeys'),
      groqApiKeys: c.get('groqApiKeys'),
      jinaApiKey: c.get('jinaApiKey'),
      lowTpmMode: c.get('lowTpmMode'),
      tpmLimit: c.get('tpmLimit'),
    };

    // Start generation in background
    (async () => {
      try {
        for await (const chunk of generator(owner, repo, options)) {
          pushEvent(jobId, { content: chunk });
        }
        completeJob(jobId);
      } catch (err) {
        logError(`${type} generation error: ${err.message}`);
        console.error(err);
        pushEvent(jobId, { error: err.message });
        failJob(jobId, err.message);
      }
    })();

    // Stream events to this client
    return streamSSE(c, async (stream) => {
      let streamClosed = false;

      // Subscribe to events (including ones generated before we subscribed)
      const processedCount = { value: 0 };

      // First, send any events that were already buffered
      const checkAndSendBuffered = async () => {
        const buffered = getBufferedEvents(jobId);
        while (processedCount.value < buffered.length && !streamClosed) {
          try {
            await stream.writeSSE({ data: JSON.stringify(buffered[processedCount.value]) });
            processedCount.value++;
          } catch {
            streamClosed = true;
          }
        }
      };

      await checkAndSendBuffered();

      // Subscribe to new events
      const unsubscribe = subscribe(jobId, async (event) => {
        if (streamClosed) return;
        try {
          await stream.writeSSE({ data: JSON.stringify(event) });
          processedCount.value++;
        } catch {
          streamClosed = true;
        }
      });

      // Wait for job completion
      await job.promise;
      unsubscribe();

      // Send any remaining buffered events we might have missed
      await checkAndSendBuffered();

      if (!streamClosed) {
        await stream.writeSSE({ data: '[DONE]' });
      }
    });
  };
}

// Generate documentation (SSE streaming)
generateRoutes.post('/generate/docs', createGenerateHandler('docs', generateDocumentation));

// Generate package/migration prompt (SSE streaming)
generateRoutes.post('/generate/package-prompt', createGenerateHandler('package-prompt', generatePackagePrompt));

// Generate reimplement prompt (SSE streaming)
generateRoutes.post('/generate/reimplement-prompt', createGenerateHandler('reimplement-prompt', generateReimplementPrompt));
