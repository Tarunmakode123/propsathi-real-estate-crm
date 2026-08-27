import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET - List all tenants for the workspace selector.
 */
export async function GET() {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(tenants);
  } catch (error) {
    console.error('Failed to retrieve tenants:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
