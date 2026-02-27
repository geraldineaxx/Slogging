# Slogging — Claude Code Instructions

## Project Location
`~/Documents/Zvita - Open Working/Apps/Slogging/`

## Stack
- React 19 + TypeScript + Vite (port 3000)
- Tailwind CSS with dark glass aesthetic (`#0a0a0a` background)
- Supabase (auth + Postgres) via `@supabase/supabase-js`
- `lucide-react` for icons

## Commands
```bash
npm run dev      # Dev server on http://localhost:3000
npm run build    # Production build
npm run lint     # TypeScript type-check only (tsc --noEmit)
```

## Environment
Requires `.env.local` with:
```
VITE_SUPABASE_URL=https://pgolfhngzsoprbbbgtoj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_VQfGKc6o5u5iq0RCSFyw3g_yJtVoaUn
```

## Architecture
- `App.tsx` — Root component, all views rendered inline (no router)
- `types.ts` — `TimeSession` interface + `User` re-export from supabase
- `components/Button.tsx` — Shared button (variants: primary, secondary, danger, ghost)
- `components/Card.tsx` — Shared card wrapper
- `components/AuthScreen.tsx` — Auth gate (email/password + magic link)
- `lib/supabase.ts` — Supabase client singleton
- `utils/formatTime.ts` — Time formatting helpers

## Views (AppView enum)
- `LANDING` — Project name input + quick-start buttons
- `TIMER` — Active session with live elapsed time
- `LOG` — Session history table with filters/sort
- `PROJECTS` — Aggregated stats per project (card/list view)

## Database (Supabase)
Table: `public.sessions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, RLS enforced |
| project_name | text | max 30 chars |
| start_time | bigint | Unix ms |
| end_time | bigint | Unix ms, nullable |
| duration_ms | bigint | |
| created_at | timestamptz | default now() |

RLS: users can only select/insert/update/delete their own rows.

## Auth Flow
- `supabase.auth.onAuthStateChange` drives `user` state in App.tsx
- No user → `<AuthScreen />` is shown
- Sign-out via User icon in navbar → clears state, shows AuthScreen

## Key Decisions
- No React Router — views controlled by `AppView` enum state
- No Redux/Zustand — all state in App.tsx
- Sessions saved optimistically (state update first, then Supabase async)
- Timer sessions only save if elapsed ≥ 10 minutes
