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

## 1. Project Name
Vestilook — AI-powered virtual try-on experience.

## 2. Project Description
Vestilook delivers photorealistic virtual try-on previews by combining a user’s base photo with garment images through Google’s Vertex AI Virtual Try-On (VTON) API. The MVP targets everyday shoppers who want a fast, high-fidelity way to visualise outfits they already own or are considering online. Core value props include automated persona management, strict consent handling, image validation, and download-ready outputs while keeping compute costs under control.

## 3. Tech Stack
- **Frontend:** Astro 5, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui, class-variance-authority, clsx, lucide-react, tw-animate-css.
- **Backend, Auth & Storage:** Supabase (PostgreSQL, Auth, Storage life-cycle policies).
- **AI Integration:** Google Cloud Platform with Vertex AI Virtual Try-On API.
- **Tooling & Quality:** ESLint (with Astro/React plugins), Prettier (Astro plugin), TypeScript tooling, Husky + lint-staged.
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
3. Provision Supabase (Auth, PostgreSQL, Storage) and Google Cloud Vertex AI credentials, then create a local environment file (e.g. `.env`) with required keys such as Supabase URL/keys, storage bucket references, and VTON API access tokens. (Exact variable names are pending definition.)
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
- `npm run astro` — Run arbitrary Astro CLI commands.

## 6. Project Scope
- **In scope (MVP):** Single-persona VTON flow, Supabase-backed storage/auth, high-resolution downloads, client-side upload validation (format, ≥1024×1024), explicit consent gating, cost-limiting per user, automated cleanup of garments/results after 2–3 days.
- **Out of scope (MVP):** Multiple personas, store catalog integrations or URL-based uploads, advanced persona editing, alternative AI models, extended GCP auth hardening.

## 7. Project Status
MVP planning in progress with a six-week timeline. Immediate priorities include implementing the core VTON pipeline, hard qualitative rating loop, and Supabase life-cycle policies. Open risks: validating direct Supabase-to-Vertex AI asset ingestion and establishing the final success threshold for generated image quality.

## 8. License
License to be determined. No license file is currently included in the repository.
