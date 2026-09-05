# Ephemeral chat — Vercel edition

Same product as the Railway version — TTL'd rooms, signed join links,
presigned direct-to-storage file sharing — with the realtime layer swapped
so it actually runs on Vercel's serverless functions.

## Why this shape

Vercel functions are short-lived; they can't hold the persistent connection
Socket.io needs. So the split is:

- **Ably** holds the actual realtime connection. The browser connects to
  Ably directly — this server's only involvement is minting a short-lived,
  channel-scoped token (`/api/ably-token`) so the real Ably API key never
  reaches the client.
- **Upstash Redis (REST)** replaces the TCP `redis://` client from the
  Railway version. Same TTL'd hash/list model, just reachable over plain
  HTTP, which is what a function that might cold-start every invocation
  actually wants.
- **Presigned S3/R2 uploads** are unchanged — that part was already
  serverless-friendly.
- A small `/api/messages` endpoint persists messages to Redis alongside
  Ably's delivery, so someone who joins mid-conversation (or refreshes) gets
  history. Ably's own history feature would also work here, but it needs a
  paid plan for retention beyond 2 minutes — Redis keeps this on Ably's free
  tier.

## Setup

1. `npm install`
2. Create a free [Upstash](https://console.upstash.com) Redis database, copy
   its REST URL + token into `.env`.
3. Create a free [Ably](https://ably.com) app, copy the API key into `.env`.
4. Set up an S3 bucket or Cloudflare R2 bucket (see the Railway version's
   notes — identical here) and fill in the `S3_*` vars.
5. `vercel dev` to run locally, or just `vercel` to deploy.

No `vercel.json` needed — the `api/*.js` files are picked up as serverless
functions automatically, and `public/` is served as static files.

## Request flow

1. `POST /api/rooms` — creates a room in Redis, returns a signed join link.
2. Client opens `/join/:roomId?token=...` → `GET /api/room-verify` confirms
   the token before anything else happens.
3. `POST /api/ably-token` — mints an Ably token scoped to exactly
   `chat:<roomId>`, so it can't be replayed against a different room.
4. Client connects to Ably directly with that token, subscribes to the
   channel, and joins presence.
5. `GET /api/messages` — loads prior history from Redis.
6. New messages: client publishes to Ably (instant delivery to everyone in
   the room) *and* `POST`s to `/api/messages` (durable copy, same TTL as the
   room).
7. Files: `POST /api/uploads-presign` → client `PUT`s the file straight to
   S3/R2 → client publishes a `file`-type message pointing at the presigned
   download URL.

## What you lose vs. the Socket.io version

- One more third-party dependency (Ably) instead of owning the whole
  transport. Ably's free tier (6M messages/month) comfortably covers a small
  chat app, but it is a vendor to depend on.
- Slightly more round-trips per message (publish to Ably + a separate POST
  to persist) instead of one socket emit that did both.

If you'd rather not add a realtime vendor at all, the other option
discussed was Server-Sent Events backed by Upstash's Redis pub/sub — works,
but you own reconnect logic yourself and it's a worse experience than a
real WebSocket. This Ably approach is the smaller, more robust change for
what you already have.
