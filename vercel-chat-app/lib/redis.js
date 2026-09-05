// lib/redis.js
// Upstash's Redis is REST/HTTP-based, which is the one flavor of Redis that
// behaves well from short-lived serverless functions (no connection pool to
// manage, no cold-start handshake). Same room/TTL model as the Railway
// version — just a different transport underneath.

const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ROOM_TTL_SECONDS = parseInt(process.env.ROOM_TTL_SECONDS || '', 10) || 6 * 60 * 60;
const MAX_MESSAGES_PER_ROOM = parseInt(process.env.MAX_MESSAGES_PER_ROOM || '', 10) || 500;

const roomKey = (roomId) => `room:${roomId}`;
const roomMessagesKey = (roomId) => `room:${roomId}:messages`;
const roomUsersKey = (roomId) => `room:${roomId}:users`;

async function touchRoom(roomId) {
  await Promise.all([
    redis.expire(roomKey(roomId), ROOM_TTL_SECONDS),
    redis.expire(roomMessagesKey(roomId), ROOM_TTL_SECONDS),
    redis.expire(roomUsersKey(roomId), ROOM_TTL_SECONDS),
  ]);
}

async function roomExists(roomId) {
  return (await redis.exists(roomKey(roomId))) === 1;
}

async function createRoom(roomId, name) {
  await redis.hset(roomKey(roomId), { name: name || 'unnamed-room', createdAt: Date.now() });
  await touchRoom(roomId);
}

async function addMessage(roomId, message) {
  await redis.rpush(roomMessagesKey(roomId), JSON.stringify(message));
  await redis.ltrim(roomMessagesKey(roomId), -MAX_MESSAGES_PER_ROOM, -1);
  await touchRoom(roomId);
}

async function getMessages(roomId) {
  const raw = await redis.lrange(roomMessagesKey(roomId), 0, -1);
  return raw.map((m) => (typeof m === 'string' ? JSON.parse(m) : m));
}

async function addUser(roomId, connectionId, username) {
  await redis.hset(roomUsersKey(roomId), { [connectionId]: username });
  await touchRoom(roomId);
}

async function removeUser(roomId, connectionId) {
  await redis.hdel(roomUsersKey(roomId), connectionId);
}

async function getUsers(roomId) {
  const map = (await redis.hgetall(roomUsersKey(roomId))) || {};
  return Object.entries(map).map(([connectionId, username]) => ({ connectionId, username }));
}

module.exports = {
  redis,
  roomExists,
  createRoom,
  addMessage,
  getMessages,
  addUser,
  removeUser,
  getUsers,
  ROOM_TTL_SECONDS,
};
