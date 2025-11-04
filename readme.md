# Smart Gmail Assistant

A full‑stack Gmail assistant that connects to your Google account, fetches recent or queried emails, and uses an LLM to summarize and answer questions about them. The project includes:

- Frontend (Vite + React) — deployed on Vercel
- Backend (Node + Express + TypeScript) — deployable on Render
- Gmail integration via Google OAuth2
- Caching via Upstash Redis
- LLM via Groq (llama-3.3-70b-versatile), with large‑context chunked summarization

## Table of contents

- Features
- Architecture
- Requirements
- Local development
- Environment variables
- Google Cloud OAuth setup

## Features

- Connect Gmail with OAuth 2.0 (read‑only scope)
- Query emails (recent, unread, by sender/keywords/time) and get concise summaries
- Chunked summarization for large mailboxes to avoid TPM/token errors while preserving context
- Intelligent caching in Redis with keys scoped by user, query, and desired count
- Cross‑site cookie/session support for separate frontend and backend domains
- Conversation memory: remembers recent turns (last 10 messages) to keep context and continuity across questions
- Adaptive prompting: adjusts between summary, search, status, and trends modes based on user intent
- Targeted Gmail search derivation: extracts senders/keywords/dates from natural language to build precise Gmail queries
- Local-time formatting: shows email dates in your local timezone for readability
- Safe fallbacks: if Gmail context isn’t relevant, answers normally; if ambiguous, asks a brief clarification

## Architecture

- `frontend/` — Vite + React app
  - Reads API base from `VITE_API_BASE`
  - Calls `/api/auth/gmail` and `/api/chat`
- `backend/` — Express + TypeScript
  - Gmail OAuth flow and email fetching
  - LLM prompt assembly and chunking/merging
  - Session stored in signed cookie (SameSite=None; Secure in production)
  - Redis cache via Upstash REST client

## Requirements

- Node.js 18+ (dev), Render uses Node 22 by default
- Yarn or npm
- A Google Cloud project with OAuth Client ID (Web application)
- Upstash Redis database (REST URL + token)
- Groq API key

## Local development

1. Install deps

```bash
cd backend && yarn && cd ..
cd frontend && yarn && cd ..
```

2. Create env files

Create `backend/.env`:

```bash
PORT=3000
NODE_ENV=development

GROQ_API_KEY=your_groq_key

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
# Local redirect for development
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback

# When running locally, point directly to local frontend
FRONTEND_URL=http://localhost:5173

# Upstash
UPSTASH_REDIS_REST_URL=your_upstash_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token

SESSION_SECRET=change_me
```

Create `frontend/.env`:

```bash
VITE_API_BASE=http://localhost:3000/api
```

3. Run locally

```bash
# Terminal 1
cd backend
yarn dev

# Terminal 2
cd frontend
yarn dev
```

Open http://localhost:5173 and click “Connect Gmail”.

## Environment variables

Backend (Render/Local):

- `PORT` — server port (Render provides automatically)
- `NODE_ENV` — `production` in Render
- `SESSION_SECRET` — any long random string
- `FRONTEND_URL` — e.g., `https://mailmind.shivamte.me` (prod) or `http://localhost:5173` (dev)
- `GROQ_API_KEY` — Groq key
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — OAuth client
- `GOOGLE_REDIRECT_URI` — must exactly match one of Google’s Authorized Redirect URIs
  - Prod: `https://<your-backend-domain>/api/auth/callback`
  - Dev: `http://localhost:3000/api/auth/callback`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST credentials

Frontend (Vercel/Local):

- `VITE_API_BASE` — e.g., `https://mailmind-api.shivamte.me/api` (prod) or `http://localhost:3000/api` (dev)

## Google Cloud OAuth setup

1. In Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).

2. Authorized redirect URIs (add both):

- `http://localhost:3000/api/auth/callback` (for local dev)
- `https://<your-backend-domain>/api/auth/callback` (prod)

3. Authorized JavaScript origins (optional but recommended):

- `http://localhost:5173`
- `https://<your-frontend-domain>`

4. OAuth Consent Screen:

- User type: External (Testing) unless you have a Workspace domain
- Add required scopes:
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/userinfo.email`
  - `openid`
- Add Test users (up to 100) while in Testing
- To allow public Gmail users, submit for Google verification (restricted scopes may require an external security assessment)
