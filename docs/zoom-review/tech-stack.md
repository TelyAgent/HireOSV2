HireOS Interview is a web app for structured job interviews. Interviewers host the meeting inside HireOS (Zoom Meeting SDK) and get a live transcript (Zoom RTMS) to review and score the interview.

Frontend
- React 19, TypeScript 5.8, Vite 7, Ant Design 5, served as static files by nginx
- Zoom Meeting SDK for Web 6.2.0 (Component View) in a same-origin iframe; joins with a server-signed SDK JWT and, for the host, a short-lived ZAK

Backend
- Node.js 24, NestJS 11, TypeScript 5.8, Prisma 6, PostgreSQL 17
- @zoom/rtms 1.1.0 (official Zoom RTMS SDK) for live transcripts
- Zod / class-validator for input validation; pdf-parse and mammoth for uploaded PDF/DOCX files

Zoom integration
- OAuth 2.0 authorization code flow (user-managed); access/refresh tokens stored encrypted (AES-256-GCM) and refreshed automatically
- REST API: GET users/me, GET users/me/zak, POST users/me/meetings, DELETE meetings/{id}, GET meetings/{uuid}, PATCH live_meetings/{id}/rtms_app/status
- Webhooks: meeting.started, meeting.ended, meeting.rtms_started, meeting.rtms_stopped, endpoint.url_validation; every event is verified with the HMAC-SHA256 x-zm-signature before processing
- SDK signatures are generated server-side (HS256, 30-minute expiry); secrets never reach the browser
- RTMS: transcript only; audio is not stored

Third party
- OpenAI API: transcript text and the evaluation rubric are sent to draft interview summaries and scores, which a person reviews. No Zoom tokens or credentials are sent.

Infrastructure
- Docker Compose on an Ubuntu server in Google Cloud
- https://hireos.aipollo.me via nginx with a Let's Encrypt certificate, then an internal nginx gateway to each container
- PostgreSQL is only reachable inside the private Docker network
- Secrets (Zoom client secret, webhook token, OpenAI key, DB credentials) are kept in env files on the server, outside git and container images
