# Posci App (Poster Builder MVP)

Ticket #1 scaffold implemented with:
- Next.js App Router + React + TypeScript strict
- Turbopack dev server
- Supabase Auth + database integration
- Routes: `/login`, `/dashboard`, `/editor/[id]`

## 1) Prerequisites

- Node.js 20+
- A Supabase project

## 2) Environment Variables

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## 3) Supabase Setup

1. In Supabase SQL Editor, run `/Users/marcespanolconesa/posci-app/supabase/schema.sql`.
2. In Supabase Authentication settings:
- Enable Email/Password provider.
- Disable email confirmation if you want immediate local sign-in after sign-up (optional for development).
3. Create storage bucket:
- Name: `poster-assets`
- Visibility: private
- Object path strategy: `poster-assets/{userId}/{posterId}/{assetId}-{filename}`

## 4) Install and Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 5) Implemented Flow (Ticket #1)

- `/login`: sign up + sign in using Supabase Auth
- `/dashboard`: list current user posters and create new poster
- `/editor/[id]`: loads poster by id and shows current poster JSON
- Auth/session handled with App Router-safe Supabase clients + middleware session refresh

## 6) Notes

- Poster JSON is saved in `posters.doc` and initialized with a typed `PosterDoc` v1 structure.
- UI is intentionally minimal for MVP scaffold.
- Next tickets will introduce TipTap editing, zoom/pan canvas, layout controls, autosave, and export.

## 7) Export (v1)

- Export button opens a print-friendly route: `/editor/[id]/print`.
- v1 export uses browser print (`Print / Save PDF`) to generate PDF.
- This is the practical MVP approach and not a server-rendered true press PDF engine.

Known limitations:
- Fonts and pagination can vary by browser/OS print engine.
- Color profile, bleed, and crop marks are not included in v1.
- Very large/signed image URLs may require re-signing if links expire.
