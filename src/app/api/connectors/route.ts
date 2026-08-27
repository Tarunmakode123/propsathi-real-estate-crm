import { NextResponse } from 'next/server';
import { prisma, getTenantPrisma } from '@/lib/db';
import { encryptJSON } from '@/lib/encryption';
import { authorizeTenant } from '@/lib/auth-helper';

/**
 * GET - List connectors for a tenant (omits secret credentials).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Server-side tenant authorization check
    try {
      await authorizeTenant(tenantId);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: err.status || 403 });
    }

    const tenantPrisma = getTenantPrisma(tenantId);
    
    // Select specific columns to ensure encryptedCredentials are never returned to client dashboard
    const connectors = await tenantPrisma.connector.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        platform: true,
        name: true,
        externalId: true,
        config: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(connectors);
  } catch (error: any) {
    console.error('Failed to retrieve connectors:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST - Register or update a connector.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      tenantId,
      platform,
      name,
      externalId,
      config,
      credentials,
    } = body;

    if (!tenantId || !platform || !name || !credentials) {
      return NextResponse.json(
        { error: 'tenantId, platform, name, and credentials are required' },
        { status: 400 }
      );
    }

    // Server-side tenant authorization check
    try {
      await authorizeTenant(tenantId);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: err.status || 403 });
    }

    const tenantPrisma = getTenantPrisma(tenantId);
    
    // Encrypt sensitive credential fields using AES-256-GCM helper
    const encryptedCredentials = encryptJSON(credentials);

    // Create entry
    const connector = await tenantPrisma.connector.create({
      data: {
        tenantId,
        platform: platform.toLowerCase(),
        name,
        externalId: externalId || null,
        config: config || {},
        encryptedCredentials,
        status: 'active',
      },
    });

    // Sanitized response
    const { encryptedCredentials: _, ...sanitizedConnector } = connector;

    return NextResponse.json(sanitizedConnector, { status: 201 });
  } catch (error: any) {
    console.error('Failed to register connector:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error?.message }, { status: 500 });
  }
}
