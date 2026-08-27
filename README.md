# PropSathi — AI-Powered Multi-Tenant Real Estate CRM

PropSathi is a modern, multi-tenant real estate CRM built from scratch. It automatically triages, classifies, and drafts responses for incoming leads and messages from WhatsApp Business, Telegram, Facebook Messenger, Instagram, and other lead-generation portals, presenting a unified dashboard inbox for human-in-the-loop review.

---

## 🛠️ Tech Stack & Architecture

* **Frontend & Backend**: Next.js App Router (React 19, TypeScript, Tailwind CSS, Lucide Icons)
* **Database & ORM**: PostgreSQL with `pgvector` extension for semantic property search, mapped via Prisma ORM (v7.10.0)
* **Data Security & Multi-Tenancy**:
  * **Application-Level Isolation**: Custom Prisma Client Query Extensions (`prisma.$extends`) that dynamically inject tenant-isolation query boundaries per request, fully compatible with PgBouncer connection pooling.
  * **AES-256-GCM Cryptography**: Encrypted storage of platform credential tokens and keys.
* **AI Processing Layer**:
  * **Intent & Scoring Model**: Google Gemini Flash (`gemini-2.5-flash`) for real-time lead intent scoring (Hot, Warm, Cold).
  * **Semantic Match Embeddings**: Google `text-embedding-004` (768-dimensional model) to search properties.
  * **Asynchronous Webhook Queue**: Decoupled ingestion layer that logs raw webhook events to `WebhookEventLog` and processes them in the background (with 3-attempt automated retry resiliency).

---

## 📁 Project Directory Structure

```text
├── prisma/
│   ├── schema.prisma       # Prisma ORM schema models
│   └── seed.ts             # Seed script for tenants, connectors, and properties
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── connectors/
│   │   │   │   └── route.ts     # Manage integration connectors (tokens encrypted on write)
│   │   │   ├── jobs/
│   │   │   │   └── retry-failed # Cron handler for failed webhook retries
│   │   │   ├── leads/
│   │   │   │   └── route.ts     # Leads fetching and triage updates
│   │   │   ├── listings/
│   │   │   │   └── route.ts     # Property inventory CRUD and auto-vectorization
│   │   │   ├── messages/
│   │   │   │   └── route.ts     # Outbound message sending and AI draft approval
│   │   │   ├── tenants/
│   │   │   │   └── route.ts     # Tenant accounts listing
│   │   │   └── webhooks/
│   │   │       └── [platform]/  # Unified webhook signature handlers (Meta, Telegram, Generic)
│   │   ├── inbox/
│   │   │   └── page.tsx         # Unified Inbox UI, review queue, and interactive tester
│   │   ├── listings/
│   │   │   └── page.tsx         # Property catalog dashboard
│   │   ├── settings/
│   │   │   └── page.tsx         # Integrations settings panel
│   │   └── page.tsx             # Tenant Selector page
│   ├── components/
│   │   └── navigation.tsx       # Workspace nav bar
│   └── lib/
│       ├── ai.ts                # Gemini API client wrapper
│       ├── ai-process-worker.ts # Asynchronous AI analysis flow
│       ├── db.ts                # Prisma client with query-level tenant isolation extension
│       ├── encryption.ts        # Cryptographic utility class (AES-256-GCM)
│       └── connectors/          # Modules (WhatsApp, Telegram, Messenger, Instagram, Generic)
```

---

## 🚀 Getting Started

### 1. Environment Configuration (`.env`)
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"
GEMINI_API_KEY="AIzaSyYourGeminiApiKeyHere"
ENCRYPTION_KEY="your-32-byte-master-encryption-key"
META_VERIFY_TOKEN="propsathi_meta_secret_2026"
CRON_SECRET="propsathi_cron_secret_2026"
```

### 2. Install & Generate client
```bash
npm install
npx prisma generate
```

### 3. Database Push & Seeding
Ensure your Postgres database has the `pgvector` extension installed (`CREATE EXTENSION IF NOT EXISTS vector;` in your SQL console), then push the schema and seed sample data:
```bash
npx prisma db push
npx prisma db seed
```

### 4. Run Locally
```bash
npm run dev
```
Open `http://localhost:3000` to pick your test workspace, manage property inventories, setup API channels, and trigger sandbox webhook simulations.
