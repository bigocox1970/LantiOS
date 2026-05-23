# Lanti OS — Working Status Document

Last updated: 2026-05-23

---

## What This App Is

A private AI legal assistant platform built for Chris's daughter (a barrister). Originally
called "Mike", rebranded to **Lanti OS**. Runs locally:
- Frontend: Next.js 16 App Router → `http://localhost:3000`
- Backend: Express + TypeScript → `http://localhost:3001`
- Database: Supabase (PostgreSQL + Auth)
- File storage: Cloudflare R2
- Primary AI: Google Gemini API

---

## BIG NEXT TASK: Migrate Express backend → Next.js API Routes

**Goal**: Eliminate the separate Express backend so the whole app deploys as a single
Next.js project to Netlify (or Cloudflare Pages). No separate backend hosting needed.

**Why**: Chris wants to deploy easily. Railway/Render/Fly.io all have painful free tiers.
A single Next.js app deploys to Netlify in one click.

**Approach**:
- Convert every `backend/src/routes/*.ts` file into `frontend/src/app/api/*/route.ts` files
- Move backend `lib/` helpers into `frontend/src/lib/server/` (server-only)
- All env vars move to the frontend `.env.local` (or Netlify env vars)
- Middleware auth pattern → Next.js middleware or inline token checks
- Rate limiting → Upstash or simple in-memory (or skip for now, private app)
- File uploads (multer) → Next.js built-in formData parsing
- After migration, delete the entire `backend/` directory

**Backend routes to migrate** (all in `backend/src/routes/`):
1. `chat.ts` — main assistant chat, streaming SSE
2. `projectChat.ts` — project-scoped chat
3. `documents.ts` — document upload/management
4. `downloads.ts` — authenticated file downloads
5. `projects.ts` — project CRUD
6. `tabular.ts` — tabular review
7. `workflows.ts` — workflow CRUD
8. `user.ts` — user profile, API keys
9. `tts.ts` — MiniMax TTS (just built this session)

**Key backend libs to move**:
- `lib/llm/` — LLM dispatch (gemini, claude, openai, models, types, tools)
- `lib/userApiKeys.ts` — encrypted key storage
- `lib/userSettings.ts`
- `lib/storage.ts` — R2 storage
- `lib/supabase.ts` — server Supabase client
- `lib/access.ts`
- `lib/upload.ts`
- `lib/convert.ts`
- `lib/documentVersions.ts`
- `lib/docxTrackedChanges.ts`
- `lib/downloadTokens.ts`
- `lib/builtinWorkflows.ts`
- `lib/chatTools.ts`
- `middleware/auth.ts` — requireAuth

**Frontend API call pattern**: currently uses `NEXT_PUBLIC_API_BASE_URL` pointing to
`http://localhost:3001`. After migration, all calls go to `/api/...` (same origin).
The file `frontend/src/app/lib/mikeApi.ts` is the main API client — update all paths there.

**After migration, also build**:
1. Voice settings (voice selector, speed/pitch, preview) — store in localStorage
2. Assistant naming (configurable, default "Lanti", stored in Supabase user_profiles)

---

## Starting the App

```bash
# Backend
npm run dev --prefix /Users/chriscox/Documents/apps/Lanti-OS/backend

# Frontend
cd /Users/chriscox/Documents/apps/Lanti-OS/frontend && npm run dev
```

---

## Environment Files

### `backend/.env`
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=...
R2_ENDPOINT_URL=https://your-account.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=your-bucket-name
GEMINI_API_KEY=...
USER_API_KEYS_ENCRYPTION_SECRET=...
MINIMAX_API_KEY=        ← needs to be filled in by user
MINIMAX_GROUP_ID=       ← NOT NEEDED (legacy, ignore)
```

### `frontend/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

---

## Theme & Design

- **Primary font**: Fraunces (all UI — headings, nav, buttons, labels)
- **Body text font**: Inter (`p`, `li`, `td`, `th`, `textarea`, `input`, `label`)
- **Colour palette**: Anthropic-inspired warm terracotta (OKLCH)
  - Light mode background: `oklch(0.96 0.012 75)` (warm cream)
  - Dark mode background: `oklch(0.14 0.01 55)` (dark charcoal)
  - Primary accent: `oklch(0.60 0.148 41)` (terracotta)
- **Dark mode**: toggled via `.dark` class on `<html>`, persisted in localStorage as `lanti-theme`
- **Toggle button**: in the sidebar (Sun/Moon icon)

### Key CSS files
- `frontend/src/app/globals.css` — all CSS variables and base rules
- `frontend/src/contexts/ThemeContext.tsx` — theme state and toggle
- `frontend/src/app/layout.tsx` — loads Fraunces (`--font-fraunces-font`), Inter (`--font-inter`), EB Garamond (`--font-eb-garamond`)

---

## Branding

- App name: **Lanti OS** (was "Mike")
- Logo in sidebar header: `public/favicon-96x96.png` (user's custom icon)
- Favicon: `public/favicon.svg`, `public/favicon-96x96.png`, `public/favicon.ico`
- Sidebar "Lanti OS" text: Fraunces font, normal weight, "Lanti" is italic
- Chat greeting icon (InitialView): `public/favicon-96x96.png`
- Chat reply icon (AssistantMessage): `public/favicon-96x96.png` (spins while loading, green dot when done, red dot on error)

---

## Pages & Key Components

| Page | Component | Notes |
|------|-----------|-------|
| `/assistant` | `InitialView` → `ChatView` | Main chat. Icon uses favicon PNG. |
| `/projects` | `ProjectsOverview` | bg-background (warm cream) |
| `/tabular-reviews` | `TRTable` | bg-background |
| `/workflows` | `WorkflowList` | Type badges: text-primary / text-muted-foreground (no blue/purple) |
| `/account` | account/page.tsx | Settings |
| `/account/models` | models/page.tsx | API key management |
| `/support` | support/page.tsx | Feedback form |

---

## AI Models

Defined in `backend/src/lib/llm/models.ts`:

```typescript
GEMINI_MAIN_MODELS = ["gemini-3.1-pro-preview", "gemini-3-flash-preview"]
DEFAULT_MAIN_MODEL = "gemini-3-flash-preview"   // cheap & fast
DEFAULT_TABULAR_MODEL = "gemini-3-flash-preview"
DEFAULT_TITLE_MODEL = "gemini-3.1-flash-lite-preview"  // cheapest
```

Also supports OpenAI and Claude via user-supplied API keys in Settings > Models.

---

## Pending Work (Next Session)

### 1. Cost Guard
**Problem**: Users can switch to the expensive Pro model in the chat UI and forget to switch back.

**Plan**:
- Auto-reset model to Flash (cheap) at the start of each new conversation
- Show an amber banner in the chat when on an expensive model with a "switch back" button
- The model picker in the chat input is in `ChatInput.tsx` — look for the "Gemini 3 Flash" dropdown

### 2. MiniMax Integration

**IMPORTANT — MiniMax API facts** (verified from docs):
- **Authentication**: API key only (`Authorization: Bearer YOUR_API_KEY`). NO Group ID needed — that was a legacy requirement, now removed.
- **Base URL**: `https://api.minimax.io`
- **TTS endpoint**: `POST https://api.minimax.io/v1/t2a_v2`
- **Chat endpoint**: `POST https://api.minimax.io/v1/chat/completions` (OpenAI-compatible)
- **Anthropic-compatible**: `POST https://api.minimax.io/anthropic/v1/messages`
- **Current text models**: MiniMax-M2.7 (best), MiniMax-M2.5 — both max at 204,800 tokens context (NOT 1M — the 1M model MiniMax-Text-01 has been retired from the commercial API)
- **Best TTS model**: `speech-2.8-hd`
- **TTS voice IDs (English)**: `English_Graceful_Lady`, `English_Trustworthy_Man`, `English_Whispering_girl`, `English_Aussie_Bloke`, `English_Insightful_Speaker`, `English_radiant_girl`, `English_Persuasive_Man`
- **TTS audio output format**: hex-encoded by default, or `"url"` for a 24h URL
- **TTS request body example**:
```json
{
  "model": "speech-2.8-hd",
  "text": "Hello",
  "stream": false,
  "output_format": "hex",
  "voice_setting": {
    "voice_id": "English_Graceful_Lady",
    "speed": 1.0,
    "vol": 1.0,
    "pitch": 0
  },
  "audio_setting": {
    "sample_rate": 32000,
    "bitrate": 128000,
    "format": "mp3",
    "channel": 1
  }
}
```
- Response: `data.audio` = hex string of MP3 audio

**Build plan**:

#### 2a. Backend TTS route
- Create `backend/src/routes/tts.ts`
- `POST /tts` — accepts `{ text: string, voiceId?: string }`, calls MiniMax, returns MP3 audio stream
- Add `MINIMAX_API_KEY` to env (already added, user needs to fill it in)
- Register route in `backend/src/index.ts`

#### 2b. Frontend TTS
- Speaker icon on completed assistant messages (in `ChatView.tsx` or `AssistantMessage.tsx`)
- Clicking speaker → calls `/api/tts` → plays MP3 via Web Audio API
- Show "playing" state while audio plays
- Stop button to cancel

#### 2c. Voice input (Speech-to-Text)
- Microphone button in `ChatInput.tsx` next to the send button
- Use browser Web Speech API (`window.SpeechRecognition`) — free, no extra key
- Transcribed text populates the input field
- User reviews and hits send (or auto-submit after pause)

#### 2d. Settings UI
- Add MiniMax API key field to `frontend/src/app/(pages)/account/models/page.tsx`
- Optional: voice selector (choose from available English voices)

### 3. Remove MINIMAX_GROUP_ID from .env
The `MINIMAX_GROUP_ID=` line added to `backend/.env` is not needed — remove it when tidying up.

---

## Architecture Notes

- Tailwind v4 with `@theme inline` — semantic CSS variables, no `dark:` prefixes needed
- Dark mode via `.dark` class on `<html>` element
- `@custom-variant dark (&:is(.dark *))` in globals.css for any explicit `dark:` overrides
- All page-level containers use `bg-background` (not `bg-card`) so warm cream shows through
- `bg-card` reserved for floating panels, modals, dropdowns
- Sticky table header cells match `bg-background` to avoid ghost strips when scrolling

---

## Files Changed This Session (Key Ones)

- `frontend/src/app/globals.css` — theme vars, font vars, base CSS rules
- `frontend/src/app/layout.tsx` — Fraunces + Inter fonts loaded
- `frontend/src/app/components/shared/AppSidebar.tsx` — logo, font, theme toggle
- `frontend/src/app/components/assistant/InitialView.tsx` — favicon icon
- `frontend/src/app/components/assistant/AssistantMessage.tsx` — favicon icon with states
- `frontend/src/app/components/assistant/ChatView.tsx` — removed bg-card bleed on input wrapper
- `frontend/src/app/components/workflows/WorkflowList.tsx` — type badge colours fixed
- 25+ files — `bg-foreground text-white` buttons → `bg-primary text-primary-foreground`
- 6 files — page-level `bg-card` → `bg-background`
