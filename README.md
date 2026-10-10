# EarthLens AI

> Find Nature. Discover Yourself.

EarthLens AI combines AI-assisted nature identification, ecological education, personal reflection, and shareable nature memory cards in one application. Built for the Hacktoberfest Week 1 "Touch Grass" challenge.

---

## Local Image Storage (Demo Mode)

To provide a zero-cost, friction-free local development and demo experience without requiring paid cloud object-storage accounts (Cloudflare R2, AWS S3, Cloudinary, etc.), EarthLens AI includes a built-in local filesystem storage provider:

- **Storage Location**: Uploaded photos are stored on the server's filesystem under `public/uploads/discoveries/`.
- **Security & Integrity**:
  - File names are generated using secure UUIDs (`uuidv4()`). Client-supplied filenames and paths are never trusted.
  - Image signatures (magic numbers) are verified for JPEG (`0xFFD8FF`), PNG (`0x89504E47`), WebP (`RIFF...WEBP`), and GIF (`GIF87a`/`GIF89a`).
  - Path traversal is strictly prevented by resolving relative paths against the designated upload directory.
  - Size limit is enforced at 8 MB (`AI_MAX_IMAGE_SIZE_MB`).
  - Empty files and unsupported formats are rejected with HTTP 400.
  - Automatic directory creation when needed.
- **Database Decoupling**: MongoDB only stores relative URLs (e.g. `/uploads/discoveries/[uuid].webp`); raw binary data is never written to the database.
- **Reference-Counted Deletion**: When deleting a discovery, its local file is deleted only if no other discovery document references the same path.
- **Git Safety**: The `public/uploads/*` directory is gitignored, while `public/uploads/discoveries/.gitkeep` preserves directory structure in Git.

---

## Demo Limitations & Deployment Safety

> [!IMPORTANT]
> The `local` storage provider is intended for **local development and live demonstrations**. Please take note of the following architectural considerations:
>
> 1. **Server Storage**: Images are stored directly on the local computer running the Next.js server.
> 2. **Session Persistence**: Photos remain available across browser sessions and page reloads as long as the files remain on disk.
> 3. **Device Access**: Other devices can access uploaded photos only if they have network access to the running Next.js server instance and the application permits access.
> 4. **Ephemeral Serverless Filesystems**: Local uploads will disappear or become unavailable when deployed to serverless hosting environments such as Vercel, AWS Lambda, or Netlify, because their serverless filesystems are ephemeral and read-only/non-persistent.
> 5. **Production Deployments**: For a production cloud deployment, configure durable, persistent object storage (such as Cloudflare R2 or Amazon S3 via `STORAGE_PROVIDER=r2`). There is no automatic fallback or switching to paid services in demo mode.

---

## Environment Configuration

In `.env.local`, set:

```env
STORAGE_PROVIDER=local
```

No Cloudflare R2 credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, etc.) are needed to run EarthLens AI.

---

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Ensure MongoDB is running** (default: `localhost:27017/earthlens`).

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Tests & Verification

- **Run unit tests** (Vitest):
  ```bash
  npx vitest run
  ```
  Runs 30 tests covering authentication, image signature validation, local uploads, reference-aware deletion, path traversal safeguards, and journal APIs.

- **Typecheck & Production Build**:
  ```bash
  npm run build
  ```

- **ESLint**:
  ```bash
  npm run lint
  ```
