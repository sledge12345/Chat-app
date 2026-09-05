// api/room-verify.js — GET /api/room-verify?roomId=...&token=...
const { roomExists } = require('../lib/redis');
const { verifyRoomToken } = require('../lib/auth');

module.exports = async (req, res) => {
  const { roomId, token } = req.query;
  const ok = roomId && (await roomExists(roomId)) && verifyRoomToken(roomId, token);
  res.status(200).json({ ok: !!ok });
};
