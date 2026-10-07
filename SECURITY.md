# Security Policy

## Security boundary

Blohsh Blast is a client-side game today. Browser state such as scores, progression, skins, missions, and leaderboard data is **not** a trusted security boundary.

When the database/backend is introduced, all authoritative values must be validated server-side. Never trust score, XP, rank, inventory, permissions, user IDs, or prices received from the browser.

## Secrets

Never commit database connection strings, JWT/session signing keys, payment provider secrets, private API keys, or Render API keys.

Do not use the `VITE_*` prefix for secrets. Vite exposes `VITE_*` variables to browser code.

Use Render environment variables for server-only credentials.

## Frontend security rules

- Keep third-party scripts out of the application unless explicitly reviewed.
- Keep executable resources same-origin unless a documented exception is required.
- Do not add inline event handlers such as `onclick`.
- Treat `localStorage`, query strings, and service-worker caches as untrusted input.
- Escape or avoid HTML sinks when rendering user-controlled data.
- Never cache future `/api/` responses in the service worker.
- Do not place authentication or database authorization logic in client-side JavaScript.

## Database security plan

Before enabling production persistence:
1. Create a separate backend/API service.
2. Keep `DATABASE_URL` server-side only.
3. Use parameterized SQL/ORM queries.
4. Validate and authorize every mutation server-side.
5. Rate-limit score submission and authentication endpoints.
6. Store only the minimum required user data.
7. Add migrations and automated backups.
8. Add security tests for IDOR, auth bypass, injection, replayed score submissions, and privilege escalation.

## Reporting

Report security issues privately before publishing proof-of-concept details.
