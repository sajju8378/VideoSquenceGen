# Direct Branch Deployment (`main` branch)

This repository is pre-configured and pre-compiled to deploy directly from the **`main`** branch without requiring GitHub Actions.

### What Was Configured:
1. **Pre-compiled Assets in `main`**:
   - `index.html` references `./assets/app.js` and `./assets/app.css` directly.
   - `assets/app.js` and `assets/app.css` are committed directly to the repository.
   - Both `/` (root) and `/docs/` folders are bundled with the exact same files and `.nojekyll`.
2. **Dual-Environment Support**:
   - In live development (`npm run dev` in AI Studio or locally), Vite automatically resolves `/src/main.tsx` dynamically with hot reloading.
   - On GitHub Pages (`main` branch), GitHub Pages serves the static compiled bundle (`assets/app.js`) with the correct MIME type `text/javascript`.
3. **Removed GitHub Actions**:
   - Removed `.github/workflows/` so all deployments come exclusively from your `main` branch.

---

### How to Deploy from `main` on GitHub:
1. Push your changes to the **`main`** branch on GitHub:
   ```bash
   git add .
   git commit -m "Deploy compiled assets for GitHub Pages"
   git push origin main
   ```
2. On GitHub:
   - Go to your repository **Settings** → **Pages** (in the left sidebar).
   - Under **Build and deployment**:
     - **Source**: Select **"Deploy from a branch"**.
     - **Branch**: Select **`main`** and **`/ (root)`** (or `/docs`).
     - Click **Save**.
3. In 1–2 minutes, visit:
   `https://sajju8378.github.io/VideoSquenceGen/`
   The site will load without the `404` or `application/octet-stream` error.
