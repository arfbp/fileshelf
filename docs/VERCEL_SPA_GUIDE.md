# Vercel SPA Configuration Guide (FileShelf)

A complete guide for configuring [Vercel](https://vercel.com) to deploy and host **FileShelf** (or any Vite + React application) as a **Single Page Application (SPA)** with client-side routing fallback and static asset preservation.

---

## 1. Why `vercel.json` Is Required for SPAs

In a Single Page Application:
- The entire application runs inside the user's browser using a single HTML file (`index.html`) and bundled JavaScript.
- When users navigate within the app (e.g., clicking to `/admin`, `/category/linux`, `/downloads`), the browser's History API changes the address bar without making a full server request.
- **The Problem:** If a user bookmarks or refreshes a client-side route like `https://your-domain.vercel.app/admin`, Vercel will look for a physical file named `dist/admin/index.html` or `dist/admin`. Because that file does not exist, Vercel will return a **`404: NOT_FOUND`** error.
- **The Solution:** A `vercel.json` rewrite rule intercepts non-asset HTTP requests and serves `index.html` with an **HTTP 200** status, allowing React to parse the URL and render the correct view.

---

## 2. Production `vercel.json` Configuration

Create or update `vercel.json` in the root of your project:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "installCommand": "npm install --include=dev",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/((?!assets/|upload/).*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/upload/index.json",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=60, stale-while-revalidate=300"
        }
      ]
    }
  ]
}
```

---

## 3. Deep Dive: Key Configuration Properties

### A. Route Rewriting (`rewrites`)

#### The Safe Repository Pattern (Recommended for FileShelf):
```json
"rewrites": [
  {
    "source": "/((?!assets/|upload/).*)",
    "destination": "/index.html"
  }
]
```
- **Negative Lookahead `(?!assets/|upload/)`:** Prevents requests to `/assets/...` (CSS/JS chunks) and `/upload/...` (actual installer files like `.exe`, `.dmg`, `.zip`) from falling back to `index.html`.
- **Why this matters for a file server:** If a user or automated tool (`curl`, `wget`, `aria2`) requests a missing download file (e.g., `/upload/missing.iso`), this rule ensures Vercel returns an actual **404 error** rather than sending a 900KB `index.html` webpage masquerading as an ISO file.

#### The Standard SPA Pattern (Alternative):
If your application does not host direct public downloads:
```json
"rewrites": [
  {
    "source": "/(.*)",
    "destination": "/index.html"
  }
]
```
*Note: In Vercel, static files existing in the output directory take precedence over rewrites by default.*

---

### B. Build & Framework Settings

| Field | Value | Purpose |
| :--- | :--- | :--- |
| `framework` | `"vite"` | Tells Vercel to optimize for the Vite build pipeline. |
| `installCommand` | `"npm install --include=dev"` | Ensures all dependencies (including devDependencies like Tailwind, Vite plugins, TypeScript) are installed even if `NODE_ENV=production` is set in Vercel. |
| `buildCommand` | `"npm run build"` | Executes `vite build` to compile the app into `./dist`. |
| `outputDirectory` | `"dist"` | Specifies where compiled assets are located. |

---

### C. Performance & Caching Headers (`headers`)

- **`/assets/(.*)`**: Vite appends unique content hashes to production CSS/JS chunks (`index-D0EnVyCb.js`). Setting `max-age=31536000, immutable` enables aggressive browser and edge CDN caching.
- **`/upload/index.json`**: The file manifest uses `stale-while-revalidate` so users see instant catalog loads while background revalidation keeps file lists fresh.

---

## 4. Deploying to Vercel

### Method 1: Git Integration (Recommended)
1. Push your code to your GitHub / GitLab repository:
   ```bash
   git add vercel.json package.json
   git commit -m "Configure Vercel SPA routing and build settings"
   git push origin main
   ```
2. In the [Vercel Dashboard](https://vercel.com):
   - Click **Add New Project**.
   - Import your repository.
   - Vercel will automatically detect `vercel.json` and set the Framework Preset to **Vite**.
   - Click **Deploy**.

### Method 2: Vercel CLI
If deploying directly from your terminal:
```bash
# 1. Install Vercel CLI if needed
npm install -g vercel

# 2. Deploy preview
vercel

# 3. Deploy to production
vercel --prod
```

---

## 5. Verification Checklist

After deployment, test the following to confirm correct SPA behavior:

- [ ] **Direct Navigation:** Open your browser and navigate directly to `https://your-domain.vercel.app/` (should load Public view).
- [ ] **Client-Side Switch:** Click the **Admin** tab. The URL updates to `/admin` without a full page reload.
- [ ] **Hard Refresh Test:** Press `Ctrl + Shift + R` (or `Cmd + Shift + R` on Mac) while on the `/admin` view. The page should refresh and stay on `/admin` without showing a Vercel 404 error.
- [ ] **File Download Integrity:** Click any download link or run `curl -I https://your-domain.vercel.app/upload/index.json`. It should return `HTTP/2 200` with `application/json` Content-Type, not `text/html`.
- [ ] **Missing Download 404:** Run `curl -I https://your-domain.vercel.app/upload/non-existent-file.zip`. It should return `HTTP/2 404 Not Found`.
