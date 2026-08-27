import { NextResponse } from 'next/server';
import { runRetryJob } from '@/lib/jobs/retry-failed';

/**
 * Endpoint to trigger failed webhook retries.
 * Typically invoked by a platform cron service (e.g. Vercel Cron, Supabase PG Cron).
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // Simple token authentication
    const token = searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '');
    const expectedToken = process.env.CRON_SECRET || 'propsathi_cron_secret_2026';

    if (token !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = await runRetryJob();
    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    console.error('Cron retry job execution error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error?.message || String(error) },
      { status: 500 }
    ) ;
  }
}
export async function GET(request: Request) {
  // Let GET requests work the same way for easy testing in browser/Postman
  return POST(request);
}
