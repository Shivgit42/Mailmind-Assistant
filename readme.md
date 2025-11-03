# Smart Gmail Assistant

A full-stack app that connects to your Gmail, summarizes and searches emails, and chats with AI.

## Tech Stack
- Frontend: React (Vite), Tailwind CSS, `lucide-react`
- Backend: Node.js, Express, TypeScript, Groq API, Google Gmail API, Redis (cache), express-session

## Monorepo Structure
```
smart-gmail-assistant/
├─ frontend/              # React app (Vite)
├─ backend/               # Express + TypeScript API
├─ .gitignore
├─ README.md
```

## Prerequisites
- Node.js 18+
- Redis server (local or hosted)
- Google Cloud project with OAuth 2.0 credentials
- Groq API key

## Environment Variables
Create a `.env` file in `backend/` with:
```
PORT=3000
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=replace-with-a-strong-secret
REDIS_URL=redis://localhost:6379

# Groq
GROQ_API_KEY=your_groq_api_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

Notes:
- Add the redirect URI to your Google OAuth client.
- Frontend typically doesn’t need secrets; if you add any public config, use `frontend/.env` and prefix with `VITE_`.

## Install & Run (Dev)
Open two terminals.

Terminal 1 (backend):
```
cd backend
npm install
npm run dev
```

Terminal 2 (frontend):
```
cd frontend
npm install
npm run dev
```

Backend will default to `http://localhost:3000`, frontend to `http://localhost:5173`.

## Usage
1. Open the frontend in your browser.
2. Click “Connect Gmail” to sign in. Approve Gmail read-only permissions.
3. Chat and ask things like “Summarize my unread emails this week” or “Find emails from Google.”

## Production Notes
- Configure production `SESSION_SECRET`, `FRONTEND_URL`, and `REDIS_URL`.
- Use HTTPS and secure cookies (`NODE_ENV=production`).
- Build frontend and serve via your preferred host/CDN; run backend behind a reverse proxy.

## License
MIT


