import { NextResponse } from 'next/server';
import { prisma, getTenantPrisma } from '@/lib/db';
import { authorizeTenant } from '@/lib/auth-helper';

/**
 * GET - Retrieve leads list or detailed lead record.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const leadId = searchParams.get('leadId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId query parameter is required' }, { status: 400 });
    }

    // Server-side tenant authorization check
    try {
      await authorizeTenant(tenantId);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: err.status || 403 });
    }

    const tenantPrisma = getTenantPrisma(tenantId);

    if (leadId) {
      // Detailed single lead view with messages history
      const lead = await tenantPrisma.lead.findUnique({
        where: { id: leadId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      return NextResponse.json(lead);
    }

    // List view of all leads
    const leads = await tenantPrisma.lead.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(leads);
  } catch (error: any) {
    console.error('GET leads endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH - Update lead attributes (pipeline status, score assignment).
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { tenantId, leadId, status, score, assignedTo } = body;

    if (!tenantId || !leadId) {
      return NextResponse.json({ error: 'tenantId and leadId are required in body' }, { status: 400 });
    }

    // Server-side tenant authorization check
    try {
      await authorizeTenant(tenantId);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: err.status || 403 });
    }

    const tenantPrisma = getTenantPrisma(tenantId);

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (score !== undefined) updateData.score = score;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    
    // Update data is updated_at tracked automatically
    const lead = await tenantPrisma.lead.update({
      where: { id: leadId },
      data: updateData,
    });

    return NextResponse.json(lead);
  } catch (error: any) {
    console.error('PATCH lead endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error?.message }, { status: 500 });
  }
}
