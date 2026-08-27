import { NextResponse } from 'next/server';
import { prisma, getTenantPrisma } from '@/lib/db';
import { generateEmbedding } from '@/lib/ai';
import { authorizeTenant } from '@/lib/auth-helper';

/**
 * GET - Retrieve listings for a tenant.
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
    const listings = await tenantPrisma.listing.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(listings);
  } catch (error: any) {
    console.error('Failed to get listings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST - Create a new listing and generate its vector embedding.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      tenantId,
      title,
      description,
      price,
      location,
      bedrooms,
      bathrooms,
      propertyType,
    } = body;

    if (!tenantId || !title || !price || !location) {
      return NextResponse.json(
        { error: 'tenantId, title, price, and location are required' },
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

    // 1. Insert metadata to database (embedding column is nullable unsupported type)
    const listing = await tenantPrisma.listing.create({
      data: {
        tenantId,
        title,
        description: description || '',
        price: Number(price),
        location,
        bedrooms: Number(bedrooms || 0),
        bathrooms: Number(bathrooms || 0),
        propertyType: propertyType || 'apartment',
      },
    });

    // 2. Generate text description for the embedding vector
    const embeddingText = `${title}. ${description || ''}. Location: ${location}. Price: $${price}. Bedrooms: ${bedrooms || 0}. Bathrooms: ${bathrooms || 0}. Type: ${propertyType || 'apartment'}.`;

    try {
      const vector = await generateEmbedding(embeddingText);
      const vectorStr = `[${vector.join(',')}]`;

      // 3. Update the unsupported vector field using raw SQL cast
      await prisma.$executeRawUnsafe(
        `UPDATE "Listing" SET embedding = $1::vector WHERE id = $2`,
        vectorStr,
        listing.id
      );
    } catch (embErr) {
      console.error('Failed to generate/save listing vector embedding:', embErr);
      // We don't fail the whole request; the listing is still created, but logs warning
    }

    // Retrieve the newly created listing to verify
    const updatedListing = await tenantPrisma.listing.findUnique({
      where: { id: listing.id },
    });

    return NextResponse.json(updatedListing, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create listing:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error?.message }, { status: 500 });
  }
}
