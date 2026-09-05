// api/ably-token.js — POST /api/ably-token { roomId, token, username }
// Mints an Ably TokenRequest scoped to a single channel (chat:<roomId>) and
// tagged with a clientId. The browser connects to Ably directly with this
// token — this function's only job is proving the caller actually has a
// valid room token before handing out realtime access.

const Ably = require('ably');
const { roomExists } = require('../lib/redis');
const { verifyRoomToken } = require('../lib/auth');

const ably = new Ably.Rest(process.env.ABLY_API_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  try {
    const { roomId, token, username } = req.body || {};
    if (!roomId || !(await roomExists(roomId)) || !verifyRoomToken(roomId, token)) {
      return res.status(403).json({ error: 'invalid room or token' });
    }

    const clientId = username || `guest-${Math.random().toString(36).slice(2, 8)}`;
    const channelName = `chat:${roomId}`;

    const tokenRequest = await ably.auth.createTokenRequest({
      clientId,
      // Scoped to exactly this room's channel — a token for one room can't
      // be replayed to subscribe to or publish into another.
      capability: { [channelName]: ['publish', 'subscribe', 'presence'] },
      ttl: 60 * 60 * 1000, // 1 hour; client re-requests as needed
    });

    res.status(200).json(tokenRequest);
  } catch (err) {
    console.error('ably token mint failed', err);
    res.status(500).json({ error: 'failed to mint token' });
  }
};
