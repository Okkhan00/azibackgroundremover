# BACKGROUND REMOVER by AZI CREATION
**AIZAZ BACKGROUND REMOVER PRO** – free AI background remover that runs entirely on the user's device (web, installable PWA, Android APK). No server, no API key, no login. Photos are never uploaded.

## What is verified and what is not
| Item | Status |
|---|---|
| Single-image removal, transparent PNG, original resolution kept (12 MP test) | **Tested** in real Chrome |
| Batch with a corrupted file (others still finish), ZIP download | **Tested** |
| Colour / custom-image backgrounds, before/after slider, zoom, reset | **Tested** |
| JPG, PNG, WEBP input; GIF rejected with a message | **Tested** |
| Fully offline use after first load (PWA) | **Tested** (browser set offline) |
| Mobile layout (412 px wide) | **Tested** by screenshot, not on a real phone |
| 20 unit tests (mask maths, ZIP, file names) | **Passing** |
| **Android APK build** | **NOT verified.** The build sandbox could not reach Google/Gradle servers. The Android project and workflow are written against the versions Capacitor generated, but the first GitHub Actions run is the real test. |
| Android file picker, saving to Documents, sharing, back button | **NOT verified** on a device |

## 1. Install (once)
1. Install **Node.js 22 LTS** from https://nodejs.org.
2. Unzip the project. Open a terminal inside the folder that contains `package.json`.
3. Run `npm install`.

## 2. Run locally
`npm run dev`, then open the address it prints (usually http://localhost:5173).

## 3. How the AI models work
- Two open-source models are included in `public/models/`: **Quality (Silueta, 44 MB)** and **Fast (U²-Net-P, 4.6 MB)**.
- Nothing is loaded at start-up. When you first process an image, a background worker downloads the chosen model from *your own site*, checks its SHA-256 checksum, and runs it with ONNX Runtime Web (WebAssembly). The browser caches it, so later runs and offline use are instant.
- The Quality model is split into three `.bin` parts only because Cloudflare Pages rejects single files over 25 MB. The app joins them automatically.
- To keep this download small, the ZIP ships only the 4.6 MB Fast model. The 44 MB Quality model is downloaded automatically (and checksum-verified) the first time you run `npm install` + `npm run dev` or `npm run build`, including on GitHub Actions and Cloudflare/Vercel builds. This needs internet access to github.com. You can also run `npm run models` yourself.
- After the AI mask is made, the app sharpens it to your photo's real edges (guided filter) to keep hair and fur detail, then writes it as the PNG alpha channel.
- Low-memory phones: choose **Fast** in Settings and lower *Maximum image size*.

## 4. Build the web app
`npm run build` creates the `dist/` folder (about 76 MB including models).

## 5. Deploy
**Cloudflare Pages (recommended):** Workers & Pages → Create → Pages → connect your GitHub repo → Build command `npm run build` → Output directory `dist` → Save and Deploy.
**Vercel:** Add New Project → import the repo → Framework "Vite" → Deploy.
HTTPS is required for the PWA install button and offline mode (both hosts provide it).

## 6. Upload to GitHub
1. Create an account at https://github.com and click **New repository** (name e.g. `background-remover`, keep it empty).
2. Easiest: on the new repo page click **uploading an existing file** and drag in the *contents* of the unzipped folder (including the hidden `.github` folder and `android` folder). The model files are downloaded during the build, so they do not need uploading. If the browser upload refuses anything, use Git instead:
```
git init
git add .
git commit -m "Background Remover by AZI CREATION"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/background-remover.git
git push -u origin main
```
3. Check that `.github/workflows/build-android.yml` is visible in the repo.

## 7. Build the Android APK with GitHub Actions
1. Repo → **Actions** tab → "Build Android APK" → **Run workflow** (tick *Also publish a GitHub Release* if wanted) → Run.
2. Wait about 8–15 minutes for a green tick.

## 8. Download the APK
Open the finished run → scroll to **Artifacts** → click `BackgroundRemover-AZI-CREATION-apk` → unzip → copy the `.apk` to your phone → open it (allow "Install unknown apps" when asked).

## 9. Releases and a permanent signing key
- **Release:** push a tag: `git tag v1.0.0 && git push origin v1.0.0`. The workflow builds and attaches the APK under the repo's **Releases**.
- **Signing:** without secrets the workflow creates a *temporary* key, so every build has a different signature and you must uninstall the old app before installing a new one. For a permanent key, create one once:
`keytool -genkeypair -v -keystore release.jks -alias azi -keyalg RSA -keysize 2048 -validity 10000`
then add repo secrets (Settings → Secrets and variables → Actions): `ANDROID_KEYSTORE_BASE64` (output of `base64 -w0 release.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. **Back up release.jks; losing it means you can never update the app.** Never commit it.

## 10. Troubleshooting
| Problem | Fix |
|---|---|
| Build says it could not download the AI models | Check internet, then run `npm run models` |
| "AI model failed its integrity check" | Host served a wrong file. Redeploy, then clear site data. |
| Actions fails at *Build release APK* | Open the step log; paste the first red error when asking for help. |
| App closes on a big photo (Android) | Settings → Maximum image size → 8 or 12 MP; choose Fast model. |
| Cutout misses a thin part | Try the other model; lower *Edge sharpness*. |
| PWA not installable | Must be on HTTPS; reload once so the service worker installs. |
| Old version still showing | Close all tabs and reopen (PWA updates on next load). |

## Project map
`src/lib` pipeline (`removeBackground.ts`, `mask.ts`, `segmenter.ts`, `zip.ts`, `db.ts`, `platform.ts`) · `src/workers/inference.worker.ts` ONNX runtime · `src/pages` the 7 screens · `android/` Capacitor project (`com.Azi.backgroundremover`) · `e2e/` browser tests (`npm run build` first) · `LICENSES.md`.
