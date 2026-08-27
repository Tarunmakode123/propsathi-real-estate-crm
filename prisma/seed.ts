import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { hashPassword } from '../src/lib/auth';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || 'default_super_secret_dev_encryption_key_propsathi';
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptJSON(obj: Record<string, any>): string {
  const text = JSON.stringify(obj);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with multi-tenant data...');

  // 1. Clean up existing records
  await prisma.webhookEventLog.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.listing.deleteMany({});
  await prisma.connector.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  // 2. Create Tenants
  const tenant1 = await prisma.tenant.create({
    data: {
      name: 'Propsathi Elite Realty',
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      name: 'Apex Homes & Rentals',
    },
  });

  console.log(`Created tenants: \n- ${tenant1.name} (${tenant1.id})\n- ${tenant2.name} (${tenant2.id})`);

  // 3. Create Users
  const user1 = await prisma.user.create({
    data: {
      tenantId: tenant1.id,
      name: 'Agent Tarun',
      email: 'tarun@propsathielite.com',
      role: 'agent',
      passwordHash: hashPassword('tarun123'),
    },
  });

  const user2 = await prisma.user.create({
    data: {
      tenantId: tenant2.id,
      name: 'Agent Sarah',
      email: 'sarah@apexhomes.com',
      role: 'agent',
      passwordHash: hashPassword('sarah123'),
    },
  });

  console.log('Created workspace users with hashed passwords.');

  // 4. Create Connectors for Tenant 1 (WhatsApp and Telegram)
  const waCreds = {
    accessToken: 'EAAG38910sjahsd891has9d8has8dh9as8dhy83ha9d8has9d8hasdh',
    appSecret: '8a8291048hasd89ha98sdy8a892ha91b',
  };
  const tgCreds = {
    botToken: '738291047:AAHdfy983yhad8h9has8dhy83ha9d8',
    secretToken: 'propsathi_tg_secret',
  };

  const waConnector = await prisma.connector.create({
    data: {
      tenantId: tenant1.id,
      platform: 'whatsapp',
      name: 'Official WhatsApp Cloud API',
      externalId: '103982392830239', // WhatsApp Phone Number ID
      config: {
        phoneNumberId: '103982392830239',
        wabaId: '298382918239283',
        autoRespond: true,
        tone: 'professional, courteous, and precise',
      },
      encryptedCredentials: encryptJSON(waCreds),
      status: 'active',
    },
  });

  const tgConnector = await prisma.connector.create({
    data: {
      tenantId: tenant1.id,
      platform: 'telegram',
      name: 'PropSathi Support Bot',
      externalId: 'PropSathiDemoBot',
      config: {
        botUsername: 'PropSathiDemoBot',
        autoRespond: true,
        tone: 'friendly, conversational, and energetic',
      },
      encryptedCredentials: encryptJSON(tgCreds),
      status: 'active',
    },
  });

  console.log('Created tenant integration connectors.');

  // 5. Create Listings with Mock Vector Embeddings
  const listingsData = [
    {
      tenantId: tenant1.id,
      title: 'Luxury 3 BHK Flat in Indiranagar',
      description: 'A spacious 1800 sqft apartment featuring modular kitchen, marble flooring, private balcony, and 2 dedicated parking spots. Close to metro station and restaurants.',
      price: 125000.00, // Monthly Rent
      location: 'Indiranagar, Bangalore',
      bedrooms: 3,
      bathrooms: 3,
      propertyType: 'apartment',
    },
    {
      tenantId: tenant1.id,
      title: 'Cozy 2 BHK Flat near ITPL Whitefield',
      description: 'Fully furnished apartment in a gated society with security, swimming pool, and gym. Ideal for tech professionals working in Whitefield.',
      price: 45000.00,
      location: 'Whitefield, Bangalore',
      bedrooms: 2,
      bathrooms: 2,
      propertyType: 'apartment',
    },
    {
      tenantId: tenant1.id,
      title: 'Premium 4 BHK Villa in Electronic City',
      description: 'Gated community villa with private garden, smart home automation, and security. Features standard amenities and close proximity to corporate hubs.',
      price: 320000.00,
      location: 'Electronic City, Bangalore',
      bedrooms: 4,
      bathrooms: 4,
      propertyType: 'villa',
    },
  ];

  // Insert listings and set mock vectors (768 dimensions)
  for (const item of listingsData) {
    const listing = await prisma.listing.create({
      data: {
        tenantId: item.tenantId,
        title: item.title,
        description: item.description,
        price: item.price,
        location: item.location,
        bedrooms: item.bedrooms,
        bathrooms: item.bathrooms,
        propertyType: item.propertyType,
      },
    });

    // Create a mock 768-dimensional normalized float vector (e.g. alternating positive and negative values)
    const mockVector: number[] = [];
    const seedVal = item.bedrooms / 10;
    for (let i = 0; i < 768; i++) {
      mockVector.push(Math.sin(i + seedVal) / 10.0);
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(mockVector.reduce((sum, val) => sum + val * val, 0));
    const normalizedVector = mockVector.map(val => val / (magnitude || 1));
    const vectorStr = `[${normalizedVector.join(',')}]`;

    // Apply vector updates directly using pgvector cast
    await prisma.$executeRawUnsafe(
      `UPDATE "Listing" SET embedding = $1::vector WHERE id = $2`,
      vectorStr,
      listing.id
    );
  }

  console.log('Created sample property listings and generated vector index data.');
  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding process failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
