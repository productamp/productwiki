import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { generateWiki, generateBriefWiki, generateDetailedWiki, generateProductDocs } from '../services/wikiGenerator.js';
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

export const wikiRoutes = new Hono();

/**
 * Helper to create a wiki generation handler with job tracking
 * @param {string} type - Wiki type (brief, detailed, dynamic, product-docs)
 * @param {Function} generator - Generator function to use
 */
function createWikiHandler(type, generator) {
  return async (c) => {
    const { owner, repo } = await c.req.json();

    if (!owner || !repo) {
      return c.json({ error: 'Owner and repo are required' }, 400);
    }

    const jobId = `wiki_${type}_${owner}_${repo}`;

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
      apiKeys: c.get('apiKeys'),
      provider: c.get('llmProvider'),
      model: c.get('geminiModel'),
    };

    // Start generation in background
    (async () => {
      try {
        for await (const event of generator(owner, repo, options)) {
          pushEvent(jobId, event);
        }
        completeJob(jobId);
      } catch (err) {
        logError(`${type} wiki generation error: ${err.message}`);
        console.error(err);
        pushEvent(jobId, { type: 'error', message: err.message });
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

/**
 * Generate brief wiki documentation (SSE streaming)
 * Uses predefined brief template structure
 */
wikiRoutes.post('/wiki/brief', createWikiHandler('brief', generateBriefWiki));

/**
 * Generate detailed wiki documentation (SSE streaming)
 * Uses predefined detailed template structure
 */
wikiRoutes.post('/wiki/detailed', createWikiHandler('detailed', generateDetailedWiki));

/**
 * Generate wiki with dynamic structure (SSE streaming)
 * LLM analyzes codebase and determines optimal structure
 */
wikiRoutes.post('/wiki/dynamic', createWikiHandler('dynamic', (owner, repo, options) => generateWiki(owner, repo, 'dynamic', options)));

/**
 * Generate product documentation (SSE streaming)
 * End-user focused documentation emphasizing functionality and features
 */
wikiRoutes.post('/wiki/product-docs', createWikiHandler('product-docs', generateProductDocs));
