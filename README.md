# Ephemeral chat

A no-account chat app. Create a room, share the link, chat, share files.
Rooms and messages auto-delete after a period of inactivity.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - **Upstash Redis** — free account at upstash.com, copy the REST URL + token
   - **Ably** — free account at ably.com, copy the API key
   - **S3 or Cloudflare R2 bucket** — for file uploads
3. Run locally: `vercel dev`
4. Deploy: push to GitHub, import the repo in Vercel, add the same env vars there.

## Using it

- Open the site, type a room name (optional), click "create a room."
- Copy the invite link and send it to whoever you're chatting with.
- Type messages, or click the paperclip to share a file.
- The room disappears on its own after it's been quiet for a while
  (`ROOM_TTL_SECONDS` in `.env`, default 6 hours).

## Project layout

```
api/       serverless functions (create room, tokens, messages, uploads)
lib/       shared helpers (redis, room-link signing)
public/    the actual website (html/css/js)
```# Chat-app
