// api/uploads-presign.js — POST /api/uploads-presign { roomId, token, filename, contentType }
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { customAlphabet } = require('nanoid');
const { roomExists, ROOM_TTL_SECONDS } = require('../lib/redis');
const { verifyRoomToken } = require('../lib/auth');

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);

const s3 = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT || undefined,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: !!process.env.S3_ENDPOINT,
});
const BUCKET = process.env.S3_BUCKET;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  try {
    const { roomId, token, filename, contentType } = req.body || {};
    if (!roomId || !(await roomExists(roomId)) || !verifyRoomToken(roomId, token)) {
      return res.status(403).json({ error: 'invalid room or token' });
    }
    const key = `${roomId}/${nanoid()}-${filename}`.replace(/\s+/g, '_');

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType || 'application/octet-stream' }),
      { expiresIn: 60 * 5 }
    );
    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: Math.min(ROOM_TTL_SECONDS, 7 * 24 * 60 * 60) }
    );

    res.status(200).json({ uploadUrl, downloadUrl, key });
  } catch (err) {
    console.error('presign failed', err);
    res.status(500).json({ error: 'failed to presign upload' });
  }
};
