# Yaqbot CrossFit Timer

React/Vite frontend and Express API in an npm workspace. Use Node.js 22.12 or newer.

## Run locally

1. Run `npm install` at the repository root.
2. Keep the existing `frontend/.env` and `backend/.env` files. If starting from scratch, copy the corresponding `.env.example` files and fill in the values below. Never commit either `.env` file.
3. In Google Cloud, the web OAuth client must allow `http://localhost:5173` as an Authorized JavaScript origin. While the External consent screen is in Testing mode, add each coach account, including `hola@yaqbot.com`, as a test user.
4. In separate terminals, run `npm run dev:backend` and `npm run dev:frontend`.
5. Open `http://localhost:5173/login`, sign in with an authorized `@yaqbot.com` Workspace account, and create a workout on `/dashboard`.

For local development only, `backend/.env` may set `NODE_ENV=development` and `DEV_ALLOWED_EMAIL=gerardfideu24@gmail.com`. This permits that exact verified Google account after normal ID token verification. The exception is disabled in production and for non-local frontend origins, even if `DEV_ALLOWED_EMAIL` is present.

The Vite proxy sends `/api` requests to `API_PROXY_TARGET` (default `http://localhost:3001`). Check `http://localhost:5173/api/health` for the API. `/timer` and valid shared timer links are public. The link contains only workout timing values; it contains no credentials. `GET /api/auth/me` reports the current session, `POST /api/auth/google` signs in, and `POST /api/auth/logout` signs out. The workout share endpoint requires an authorized session.

If sign-in reports that the authentication server cannot be reached, check the backend terminal for `Backend listening on http://localhost:3001` and confirm that both `http://localhost:3001/api/health` and `http://localhost:5173/api/health` return `{"status":"ok"}`. A personal Gmail OAuth test user receives HTTP 403 unless it exactly matches the configured local development exception.

## Environment variables

| Location | Variable | Purpose |
| --- | --- | --- |
| Frontend | `VITE_GOOGLE_CLIENT_ID` | Google web OAuth client ID, embedded in the browser build |
| Frontend development | `API_PROXY_TARGET` | Express origin for Vite's `/api` proxy |
| Backend | `GOOGLE_CLIENT_ID` | Same Google web OAuth client ID; ID token audience |
| Backend | `ALLOWED_GOOGLE_DOMAIN` | Must be `yaqbot.com` |
| Backend | `SESSION_SECRET` | Random secret of at least 32 characters; keep private and stable across restarts |
| Backend | `FRONTEND_ORIGIN` | Exact browser origin, such as `http://localhost:5173` locally |
| Local backend | `SESSION_DIR` | Local session files; defaults to `./sessions` |
| Vercel backend | `REDIS_URL` | Private connection URL for a shared Redis session store (`redis://` or `rediss://`) |
| Backend | `PORT` | Express port, default `3001` |
| Backend development | `NODE_ENV` | Set to `development` to enable the local account exception |
| Backend development | `DEV_ALLOWED_EMAIL` | Exact verified Google email allowed only in local development |

The backend verifies Google's ID token signature, audience, issuer, expiration, verified email, and `hd=yaqbot.com`. It stores only the Google subject and email in a server-side session. The browser gets an HTTP-only, SameSite=Lax cookie that expires after eight hours. Login rotates the session ID. Logout invalidates the session. Mutating API requests require the configured browser `Origin`.

## Vercel deployment

This repository is configured as **one Vercel project**. The Vite build is served from `frontend/dist`. The five existing `/api` paths are Vercel Functions that all use the same Express application. `vercel.json` rewrites `/login`, `/dashboard`, and `/timer` to the SPA entry point on direct visits and refreshes. Leave the Vercel project's Root Directory at the repository root.

### Before deployment

1. Create a GitHub repository. From this directory, review `git status` and `git add` only the project files. Confirm no `.env` file or `.vercel` directory is staged. Then run `git commit -m "Prepare CrossFit Timer for Vercel"`, `git branch -M main`, `git remote add origin <your-GitHub-repository-URL>`, and `git push -u origin main`. If a remote already exists, use it instead of adding another. Pushing a connected production branch may trigger a deployment automatically, so review the Vercel Git settings first.
2. In Vercel, choose **Add New → Project**, import the GitHub repository, and keep **Root Directory: `./` (repository root)**. Use **Framework Preset: Vite**, **Build Command: `npm run build --workspace frontend`**, and **Output Directory: `frontend/dist`**. These values are also fixed in `vercel.json`; leave the Install Command at Vercel's npm default. Choose Node.js 22 or newer.
3. Provision a managed Redis service that offers a standard `redis://` or TLS `rediss://` connection URL. A Redis integration in the Vercel Marketplace is suitable. Map its private connection URL to `REDIS_URL`. The existing local file session store cannot work across Vercel Function instances; production uses Redis through `express-session` and keeps session rotation, expiration, and logout invalidation.
4. Add the following **Production** environment variables in Vercel Project Settings. Do this before the first production build. Redeploy after changing build-time variables.

   | Variable | Value |
   | --- | --- |
   | `VITE_GOOGLE_CLIENT_ID` | Google OAuth **Web application** client ID; this one value is public in the browser bundle |
   | `GOOGLE_CLIENT_ID` | The same client ID, used by the API to verify ID token audience |
   | `ALLOWED_GOOGLE_DOMAIN` | `yaqbot.com` |
   | `SESSION_SECRET` | A new random secret of at least 32 characters; keep private and stable across deployments |
   | `FRONTEND_ORIGIN` | Exact final HTTPS origin, such as `https://your-project.vercel.app`, with no path or trailing slash |
   | `REDIS_URL` | Redis connection URL; server-side secret |

   Do not set `DEV_ALLOWED_EMAIL`, `SESSION_DIR`, `PORT`, or `API_PROXY_TARGET` in Production. Vercel runs the production build and Functions with `NODE_ENV=production`; do not override it. The backend requires `FRONTEND_ORIGIN` to use HTTPS in production. If the final domain is not known yet, decide the Vercel project name/domain before setting this value; update it and redeploy if the domain changes. Preview deployment URLs require their own matching origin and Google OAuth origin if you want to test sign-in there.
5. In Google Cloud Console, open the same OAuth **Web application** client and add the final `https://...` origin under **Authorized JavaScript origins**. This app receives a Google ID token through a JavaScript callback and posts it to `/api/auth/google`; it does not use an OAuth redirect endpoint. Keep any existing local origin. If the consent screen remains in Testing mode, add the authorized `@yaqbot.com` account as a test user. A personal Gmail test user still receives HTTP 403 in Production.
6. Review the settings, then deploy from Vercel. Visit `/api/health` and expect `{"status":"ok"}`. Open `/login`, sign in with a verified `@yaqbot.com` Workspace account, refresh `/dashboard`, create a workout, and open its QR/link on a phone. Check the link uses the deployed HTTPS origin. Test `/login`, `/dashboard`, and `/timer?mode=amrap&durationSeconds=60` by direct URL and browser refresh. Sign out and verify `/dashboard` is protected. A personal Gmail account must be denied. The cookie should be HttpOnly, Secure, and SameSite=Lax.

Production authentication requires a reachable Redis service. If Redis is unavailable, the API responds with a JSON service-unavailable error. Session data is stored server-side; the browser receives only a signed session ID. Timer links remain public because their configuration is encoded in the URL; the API authorizes creation through the dashboard but cannot prevent someone from constructing a valid timer URL manually.

### Local Vercel check

Once the project is linked to a Vercel account, set Development environment variables in a root `.env.local` (or pull them with `vercel env pull`). Use a reachable development Redis URL and `FRONTEND_ORIGIN=http://localhost:3000` for the default `vercel dev` port. Run `vercel dev`, then check `/api/health`, `/login`, and a refreshed `/timer` URL. Google sign-in at this origin requires `http://localhost:3000` in Authorized JavaScript origins. The root `.env.local` and `.vercel` directory are ignored by Git. Ordinary local development continues to use the two npm dev scripts and the file session store.

## Phone and timer testing

For local phone testing, run `npm run dev:frontend -- --host 0.0.0.0` and open the app on the desktop using its LAN address so generated links use an address the phone can reach. Google sign-in from that LAN origin requires adding the origin in Google Cloud; browser and Google security restrictions may make a local HTTPS origin necessary. The simpler complete phone test is the public HTTPS deployment. Keep both devices on the same network for LAN tests.

The timer supports For Time, AMRAP, and EMOM, with optional countdown and Web Audio cues. It offers Fullscreen where supported and requests Screen Wake Lock while running. Wake Lock requires a secure context and browser support. A phone opened over plain HTTP LAN may need its screen timeout adjusted manually. Background execution and screen wake are not guaranteed; the timer recalculates from elapsed time when the page becomes visible again.

Run `npm run typecheck`, `npm run test`, and `npm run build` for TypeScript checks, automated tests, and both builds.
