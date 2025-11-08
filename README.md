# Vestilook

![Node.js](https://img.shields.io/badge/node-22.14.0-339933?logo=node.js) ![Status](https://img.shields.io/badge/status-MVP%20planning-blue)

## Table of Contents
- [1. Project Name](#1-project-name)
- [2. Project Description](#2-project-description)
- [3. Tech Stack](#3-tech-stack)
- [4. Getting Started Locally](#4-getting-started-locally)
- [5. Available Scripts](#5-available-scripts)
- [6. Project Scope](#6-project-scope)
- [7. Project Status](#7-project-status)
- [8. License](#8-license)
- [9. Mobile Responsiveness Testing](#9-mobile-responsiveness-testing)

## 1. Project Name
Vestilook — AI-powered virtual try-on experience.

## 2. Project Description
Vestilook delivers photorealistic virtual try-on previews by combining a user’s base photo with garment images through Google’s Vertex AI Virtual Try-On (VTON) API. The MVP targets everyday shoppers who want a fast, high-fidelity way to visualise outfits they already own or are considering online. Core value props include automated persona management, strict consent handling, image validation, and download-ready outputs while keeping compute costs under control.

## 3. Tech Stack
- **Frontend:** Astro 5, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui, class-variance-authority, clsx, lucide-react, tw-animate-css.
- **Backend, Auth & Storage:** Supabase (PostgreSQL, Auth, Storage life-cycle policies).
- **AI Integration:** Google Cloud Platform with Vertex AI Virtual Try-On API.
- **Tooling & Quality:** ESLint (with Astro/React plugins), Prettier (Astro plugin), TypeScript tooling, Husky + lint-staged, Vitest + React Testing Library + MSW do testów jednostkowych i integracyjnych, Playwright do testów end-to-end.
- **CI/CD & Hosting:** GitHub Actions pipelines and DigitalOcean deployment via Docker images.
- **Runtime:** Node.js 22.14.0 (see `.nvmrc`).

## 4. Getting Started Locally
1. Ensure Node.js 22.14.0 is available (`nvm use` or `nvm install 22.14.0`).
2. Clone the repository and install dependencies:
   ```bash
   git clone <your-repo-url>
   cd vestilook
   npm install
   ```
3. Provision Supabase (Auth, PostgreSQL, Storage) and Google Cloud Vertex AI credentials, then create a local environment file (e.g. `.env`) with the required keys:
   - `SUPABASE_URL`, `SUPABASE_KEY`
   - `GOOGLE_VERTEX_API_KEY`
   - `PRIVATE_VERTEX_PROJECT_ID`, `PRIVATE_VERTEX_LOCATION`, `PRIVATE_VERTEX_VTO_MODEL`
   - `PRIVATE_VTON_GARMENT_BUCKET`, `PRIVATE_VTON_PERSONA_BUCKET`, `PRIVATE_VTON_GENERATION_BUCKET`
   - `PRIVATE_VTON_MAX_GARMENT_BYTES`, `PRIVATE_VTON_MIN_GARMENT_WIDTH`, `PRIVATE_VTON_MIN_GARMENT_HEIGHT`, `PRIVATE_VTON_ALLOWED_GARMENT_MIME`
   - `VITE_VTON_DEFAULT_ETA_SECONDS`
   - `PUBLIC_CONSENT_POLICY_URL` – link do aktualnej polityki przetwarzania wizerunku wyświetlanej w formularzu generacji. Repozytorium dostarcza domyślną stronę pod `/legal/polityka-przetwarzania-wizerunku`, którą możesz podmienić lub rozszerzyć według potrzeb prawnych.
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Build or preview the production bundle when needed:
   ```bash
   npm run build
   npm run preview
   ```

## 5. Available Scripts
- `npm run dev` — Start the Astro development server.
- `npm run build` — Generate a production build.
- `npm run preview` — Preview the production build locally.
- `npm run lint` — Run ESLint over the codebase.
- `npm run lint:fix` — Fix autofixable ESLint issues.
- `npm run format` — Format files with Prettier.
- `npm run test` — Run Vitest in CI mode over unit/integration suites (m.in. walidacja ubrań i formularz generacji).
- `npm run astro` — Run arbitrary Astro CLI commands.

## 6. Project Scope
- **In scope (MVP):** Single-persona VTON flow, Supabase-backed storage/auth, high-resolution downloads, client-side upload validation (format, ≥512×512), explicit consent gating, cost-limiting per user, automated cleanup of garments/results after 2–3 dni.
- **Out of scope (MVP):** Multiple personas, store catalog integrations or URL-based uploads, advanced persona editing, alternative AI models, extended GCP auth hardening.

## 7. Project Status
MVP planning in progress with a six-week timeline. Na etapie frontendu wdrożono widok `/generations/new`, który łączy walidację plików, ponowną zgodę i trigger kolejki VTON. Otwarte działania obejmują nadal implementację twardego ratingu oraz polityki czyszczenia Supabase. Główne ryzyka: walidacja ingestu aktywów z Supabase do Vertex AI i ustalenie progu jakości wygenerowanych stylizacji.

## 8. License
License to be determined. No license file is currently included in the repository.

## 9. Mobile Responsiveness Testing
Playwright ma teraz prekonfigurowane profile urządzeń, które odpalają pełny e2e suite w trybie mobilnym. To szybki sposób na wykrycie regresji layoutu na głównych klasach urządzeń:

- `npx playwright test --project="mobile-chrome"` – symuluje Google Pixel 7 (Chrome/Android).
- `npx playwright test --project="mobile-safari"` – symuluje iPhone 14 Pro (Mobile Safari).

Możesz również uruchomić interaktywne UI testów z tym samym parametrem (`npx playwright test --ui --project="mobile-chrome"`) i obserwować layout wbudowanym emulatorem Playwright.
