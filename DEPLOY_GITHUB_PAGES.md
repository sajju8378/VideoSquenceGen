# GitHub Pages Deployment Guide

If you saw the error:
`Failed to load resource: the server responded with a status of 404 () main.tsx:1`

### Why this happens
1. **GitHub Pages only serves static compiled HTML/JS/CSS.** It does not execute TypeScript (`.tsx`) files directly in the browser.
2. The default `index.html` referenced `/src/main.tsx`, which on a repository subpath like `https://sajju8378.github.io/VideoSquenceGen/` resolves to the root domain (`https://sajju8378.github.io/src/main.tsx`) resulting in a 404.

---

### How to Fix in 1 Minute (Automated via GitHub Actions)

We have added `.github/workflows/deploy.yml` to this repository, which automatically builds the project and deploys it to GitHub Pages.

1. On your GitHub repository page:
   - Go to **Settings** → **Pages** (under "Code and automation" in the left sidebar).
2. Under **Build and deployment**:
   - Change **Source** from *"Deploy from a branch"* to **"GitHub Actions"**.
3. Push any commit (or go to **Actions** tab → click **"Deploy to GitHub Pages"** → click **"Run workflow"**).
4. GitHub will automatically run `npm run build` and publish your site at:
   `https://sajju8378.github.io/VideoSquenceGen/`

---

### Alternative: Manual Deployment via `gh-pages` branch

If you prefer building locally and pushing the `dist` folder:

```bash
# 1. Build the production files
npm run build

# 2. Deploy the dist folder to the gh-pages branch
npx gh-pages -d dist
```

Then in **Settings** → **Pages**, select the `gh-pages` branch.
