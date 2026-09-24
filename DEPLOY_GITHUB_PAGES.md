# GitHub Pages Deployment Guide

This repository supports both **Automatic GitHub Actions deployment** (recommended) and **Direct Branch deployment** (`main` branch).

---

### Option 1: Automatic GitHub Actions Deployment (Recommended)

A workflow file is configured at `.github/workflows/deploy.yml`.

1. In your GitHub repository (`sajju8378/VideoSquenceGen`):
   - Go to **Settings** → **Pages** (in the left sidebar).
   - Under **Build and deployment**:
     - **Source**: Select **"GitHub Actions"**.
2. Whenever changes are pushed to `main`, GitHub Actions will automatically:
   - Install dependencies
   - Run `npm run build`
   - Deploy the fresh 3-choice video generation UI to GitHub Pages.
3. You can also manually trigger a deployment at any time:
   - Go to the **Actions** tab in your repository.
   - Click **Deploy to GitHub Pages** in the left sidebar.
   - Click **Run workflow** → **Run workflow**.

---

### Option 2: Direct Branch Deployment (`main` branch)

If you prefer deploying directly from the `main` branch without GitHub Actions:

1. Assets are pre-compiled and committed to:
   - `/assets/app.js` and `/assets/app.css` (Root)
   - `/docs/assets/app.js` and `/docs/assets/app.css` (`/docs` directory)
2. In GitHub repository **Settings** → **Pages**:
   - **Source**: Select **"Deploy from a branch"**.
   - **Branch**: Select **`main`** and **`/docs`** (or `/root`).
   - Click **Save**.
3. In 1–2 minutes, visit:
   `https://sajju8378.github.io/VideoSquenceGen/`
