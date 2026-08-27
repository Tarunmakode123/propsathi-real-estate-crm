import { prisma } from '../db';
import { processWebhookEvent } from '../ai-process-worker';

/**
 * Iterates through failed webhook event logs and triggers their reprocessing.
 * Safe to execute as a recurring task (e.g. cron job).
 */
export async function runRetryJob(): Promise<{ processedCount: number; errors: any[] }> {
  const failedEvents = await prisma.webhookEventLog.findMany({
    where: {
      status: 'failed',
      retryCount: { lt: 3 },
    },
    take: 20, // Process in small batches to avoid timeouts
    orderBy: { createdAt: 'asc' },
  });

  let processedCount = 0;
  const errors: any[] = [];

  for (const event of failedEvents) {
    try {
      console.log(`Retrying webhook event log: ${event.id} (Retry #${event.retryCount + 1})`);
      await processWebhookEvent(event.id);
      processedCount++;
    } catch (err: any) {
      console.error(`Retry execution failed for log ${event.id}:`, err);
      errors.push({
        eventId: event.id,
        error: err?.message || String(err),
      });
    }
  }

  return { processedCount, errors };
}
