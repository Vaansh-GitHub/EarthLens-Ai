# EarthLens AI

> **Find Nature. Discover Yourself.**  
> *An AI to link you to nature.*

EarthLens AI combines AI-assisted nature identification, ecological education, personal reflection, and shareable nature memory cards into an elegant web application.

---

## Table of Contents

- [Features](#features)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Storage & Privacy Architecture](#storage--privacy-architecture)
- [Prerequisites](#prerequisites)
- [Clean Setup Guide](#clean-setup-guide)
- [Environment Configuration](#environment-configuration)
- [Database Seeding (Optional)](#database-seeding-optional)
- [Running the Application](#running-the-application)
- [Running Tests & Quality Assurance](#running-tests--quality-assurance)
- [Project Structure](#project-structure)
- [License](#license)

---

## Features

- 🌿 **AI Nature Identification & Analysis (`/discover`)**:
  - Upload photos of plants, animals, insects, fungi, or birds for deep ecological identification.
  - Powered by Cloudflare Workers AI (`@cf/meta/llama-3.2-11b-vision-instruct`) with structured Zod schema validation and iNaturalist taxonomy enrichment.
  - **Duplicate Photo Detection**: Client-side cryptographic (SHA-256) and perceptual hashing (dHash) detect duplicate images *before* invoking the AI provider, saving tokens and providing an option to remake and replace existing records.

- 📖 **Private Nature Journal (`/journal`)**:
  - 100% private, zero-cost device-local storage via **IndexedDB** (`earthlens-local`).
  - Photos and observations stay entirely on the user's device—no third-party cloud photo costs or privacy exposure.
  - **Duplicate Photo Scanner**: Automatically scans device storage for duplicate images and frees space with one click.
  - **Data Portability**: Full backup export and restore (JSON bundle with image blobs), persistent storage request, and quota monitoring.

- 💡 **Metaphorical Life Lessons & Daily Quests (`/insight`)**:
  - Extends standard plant/animal identification into mindfulness by extracting ecological adaptations and personal reflection questions.
  - AI-generated daily nature quests with automated semantic matching (70–100%), celebratory confetti, and bonus XP.

- 🎨 **Nature Memory Card Studio (`/studio`)**:
  - Generates downloadable, high-resolution PNG observation cards with AI metaphorical lessons, specimen details, and nature branding.

- 🏆 **Explorer Progression & Profile (`/` & `/profile`)**:
  - Gamified XP, levels, and naturalist rank titles (e.g., *Novice Observer*, *Wilderness Scout*, *Ecology Master*).
  - Seamless two-way synchronization between client IndexedDB discoveries and cloud user statistics via `/api/user/sync`.

---

## Architecture & Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router) + [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **Database & Storage**:
  - **MongoDB**: User profiles, progression XP, and authentication.
  - **IndexedDB**: High-performance, zero-cost, private client-side journal and image blob storage.
  - **Local Filesystem / Cloudflare R2**: Optional server-side image persistence via decoupled storage interface.
- **Authentication**: Stateless JWT session tokens stored in secure `httpOnly` cookies (`jose`), password hashing with `bcryptjs`.
- **AI & Data Enrichment**: Cloudflare Workers AI + iNaturalist REST API.
- **Testing**: [Vitest](https://vitest.dev/) with in-memory MongoDB (`mongodb-memory-server`).

---

## Storage & Privacy Architecture

EarthLens AI utilizes a privacy-first hybrid architecture:

1. **User Identity & XP**: MongoDB securely stores user accounts, authentication credentials, and gamified progress metrics (XP, level).
2. **Observation Photos & Journal**: Stored directly in the user's browser device using IndexedDB. This ensures that personal photos are never stored on external cloud buckets without explicit user action, eliminating ongoing hosting costs.
3. **Demo Local Server Storage**: When server-side storage is used (`STORAGE_PROVIDER=local`), files are stored safely in `public/uploads/discoveries/` with content verification, magic number inspection, and path traversal guards.

---

## Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: `v20.x` or later (Node 22 LTS recommended)
- **npm**: `v10.x` or later
- **MongoDB**: A running instance (local MongoDB Community Server, Docker container, or MongoDB Atlas URI)

---

## Clean Setup Guide

### 1. Clone the Repository

```bash
git clone <repository-url>
cd earthlens-ai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment configuration:

```bash
cp .env.example .env.local
```

Open `.env.local` and configure your environment settings (see [Environment Configuration](#environment-configuration) below).

---

## Environment Configuration

Here are the required and optional variables for `.env.local`:

```env
# ----------------------------------------
# 1. Database & Authentication (Required)
# ----------------------------------------
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=earthlens
JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long
JWT_EXPIRES_IN=1d
AUTH_COOKIE_NAME=earthlens_token
AUTH_COOKIE_SECURE=false # Set to true in production with HTTPS
AUTH_COOKIE_SAME_SITE=lax
AUTH_COOKIE_PATH=/
BCRYPT_ROUNDS=12
APP_BASE_URL=http://localhost:3000

# ----------------------------------------
# 2. Storage Provider
# ----------------------------------------
STORAGE_PROVIDER=local # Options: 'local' (zero-cost) or 'r2' (Cloudflare R2)

# Cloudflare R2 (Only required if STORAGE_PROVIDER=r2)
# R2_ACCOUNT_ID=
# R2_ACCESS_KEY_ID=
# R2_SECRET_ACCESS_KEY=
# R2_BUCKET_NAME=
# R2_PUBLIC_BASE_URL=

# ----------------------------------------
# 3. AI Provider (Cloudflare Workers AI)
# ----------------------------------------
AI_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_AI_BASE_URL=https://api.cloudflare.com/client/v4
CLOUDFLARE_AI_MODEL=@cf/meta/llama-3.2-11b-vision-instruct
AI_REQUEST_TIMEOUT_MS=60000
AI_MAX_IMAGE_SIZE_MB=8
AI_MAX_OUTPUT_TOKENS=1200

# ----------------------------------------
# 4. iNaturalist Integration
# ----------------------------------------
INATURALIST_BASE_URL=https://api.inaturalist.org/v1
INATURALIST_TIMEOUT_MS=10000
INATURALIST_MAX_RESULTS=5

# ----------------------------------------
# 5. Rate Limiting & Safety
# ----------------------------------------
API_RATE_LIMIT_WINDOW_MS=60000
ANALYZE_RATE_LIMIT_MAX=5
JOURNAL_RATE_LIMIT_MAX=30
MAX_JSON_BODY_SIZE_MB=2
```

> [!TIP]
> For local development and testing, you can leave `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` blank if running automated tests, as unit tests mock provider calls.

---

## Database Seeding (Optional)

To populate MongoDB with a test user and sample discoveries:

```bash
node seed.mjs
```

**Default Test Credentials:**
- **Email:** `test@example.com`
- **Password:** `password123`

---

## Running the Application

### Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm run start
```

---

## Running Tests & Quality Assurance

- **Run all unit & integration tests** (Vitest):
  ```bash
  npx vitest run
  ```
  Runs 38 tests covering duplicate detection, cryptographic/perceptual hashing, authentication, image validation, rate limiting, and journal database operations.

- **Typecheck without emitting**:
  ```bash
  npx tsc --noEmit
  ```

- **Linting**:
  ```bash
  npm run lint
  ```

---

## Project Structure

```text
earthlens-ai/
├── app/
│   ├── api/               # Next.js API Routes (auth, analyze, quest, sync, journal)
│   ├── discover/          # Specimen upload, duplicate detection & analysis client
│   ├── insight/           # Metaphorical lessons, daily quest matching & reflections
│   ├── journal/           # Local device journal with filter & duplicate scanner
│   ├── profile/           # User achievements, stats & synchronization
│   ├── studio/            # Nature Memory Card generator & PNG export
│   └── page.tsx           # Explorer home dashboard & quest status
├── components/            # Reusable UI components & dialogs
├── lib/
│   ├── client/
│   │   └── journal-db.ts  # IndexedDB manager, image hashing & duplicate detection
│   └── server/
│       ├── ai.ts          # Cloudflare Vision AI provider & Zod parser
│       ├── auth.ts        # JWT cookie authentication & sessions
│       ├── mongodb.ts     # MongoDB connection pooling & collections
│       ├── quests.ts      # Daily AI quest generator & evaluation
│       └── storage.ts     # Decoupled image storage (local filesystem & R2)
├── public/                # Static assets and local upload directory
├── seed.mjs               # Test database seeding script
└── vitest.config.ts       # Test configuration
```

---

## License

This project is licensed under the MIT License.
