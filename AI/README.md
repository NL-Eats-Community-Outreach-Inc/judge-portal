# Proposal pre-screening service (optional)

`BGE_M3.py` and `backend/main.py` are a FastAPI service that scores team proposals with a sentence-transformers model. It is optional, is not deployed with the Next.js app (it cannot run on Vercel), and is not wired into CI.

It is only used when both are true: `SUBMISSIONS_ENABLED` in `lib/config.ts` is `true`, and `AI_SCORING_URL` (optionally `AI_SCORING_TIMEOUT_MS`) points at a running instance. With either missing, `POST /api/submissions` returns 404 and no scoring call is made.
