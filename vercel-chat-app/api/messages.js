// api/messages.js
// Ably handles realtime delivery; this endpoint is just the durable-history
// side of things (same Redis TTL model as before) so a client who joins
// mid-conversation, or refreshes, still sees prior messages.
//
// GET  /api/messages?roomId=...&token=...              -> { messages }
// POST /api/messages   { roomId, token, message }       -> { ok }

const { roomExists, addMessage, getMessages } = require('../lib/redis');
const { verifyRoomToken } = require('../lib/auth');

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const { roomId, token } = req.query;
      if (!roomId || !(await roomExists(roomId)) || !verifyRoomToken(roomId, token)) {
        return res.status(403).json({ error: 'invalid room or token' });
      }
      const messages = await getMessages(roomId);
      return res.status(200).json({ messages });
    }

    if (req.method === 'POST') {
      const { roomId, token, message } = req.body || {};
      if (!roomId || !(await roomExists(roomId)) || !verifyRoomToken(roomId, token)) {
        return res.status(403).json({ error: 'invalid room or token' });
      }
      await addMessage(roomId, message);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('messages endpoint failed', err);
    res.status(500).json({ error: 'internal error' });
  }
};
