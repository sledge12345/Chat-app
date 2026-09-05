// public/app.js
// The browser talks to Ably directly for realtime (this server never sees
// message traffic) and to our own /api/* functions for room creation,
// token minting, message history, and presigned uploads.

const landing = document.getElementById('landing');
const chatScreen = document.getElementById('chat');
const messagesEl = document.getElementById('messages');
const roomTitleEl = document.getElementById('room-title');
const presenceCountEl = document.getElementById('presence-count');
const composer = document.getElementById('composer');
const messageInput = document.getElementById('message-input');
const fileInput = document.getElementById('file-input');

let roomId, roomToken, username, channel, ably;

const params = new URLSearchParams(location.search);
const pathMatch = location.pathname.match(/^\/join\/([^/]+)/);

document.getElementById('create-room-btn').addEventListener('click', async () => {
  const name = document.getElementById('room-name').value.trim();
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  history.pushState({}, '', data.joinUrl);
  enterRoom(data.roomId, data.token);
});

document.getElementById('share-link-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(location.href);
  const btn = document.getElementById('share-link-btn');
  const original = btn.textContent;
  btn.textContent = 'copied';
  setTimeout(() => (btn.textContent = original), 1200);
});

// Auto-join if the URL already points at a room (e.g. someone opened a shared link).
if (pathMatch) {
  const idFromPath = pathMatch[1];
  const tokenFromQuery = params.get('token');
  enterRoom(idFromPath, tokenFromQuery);
}

async function enterRoom(id, token) {
  const verifyRes = await fetch(`/api/room-verify?roomId=${id}&token=${token}`);
  const { ok } = await verifyRes.json();
  if (!ok) {
    alert('that room link is invalid or has expired');
    return;
  }

  roomId = id;
  roomToken = token;
  username = prompt('pick a display name') || `guest-${Math.random().toString(36).slice(2, 6)}`;

  landing.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  roomTitleEl.textContent = `room ${roomId}`;

  ably = new Ably.Realtime({
    authCallback: async (_tokenParams, callback) => {
      try {
        const res = await fetch('/api/ably-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, token: roomToken, username }),
        });
        const tokenRequest = await res.json();
        callback(null, tokenRequest);
      } catch (err) {
        callback(err, null);
      }
    },
  });

  channel = ably.channels.get(`chat:${roomId}`);

  channel.subscribe('message', (msg) => renderMessage(msg.data));
  channel.presence.subscribe('enter', (m) => renderSystem(`${m.clientId} joined`));
  channel.presence.subscribe('leave', (m) => renderSystem(`${m.clientId} left`));
  channel.presence.subscribe(() => updatePresenceCount());
  await channel.presence.enter();
  updatePresenceCount();

  const historyRes = await fetch(`/api/messages?roomId=${roomId}&token=${roomToken}`);
  const { messages } = await historyRes.json();
  messages.forEach(renderMessage);
}

async function updatePresenceCount() {
  const members = await channel.presence.get();
  presenceCountEl.textContent = `${members.length} online`;
}

composer.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  messageInput.value = '';

  const message = { type: 'text', id: crypto.randomUUID(), username, text, ts: Date.now() };
  await channel.publish('message', message);
  persist(message);
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  fileInput.value = '';

  const presignRes = await fetch('/api/uploads-presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, token: roomToken, filename: file.name, contentType: file.type }),
  });
  const { uploadUrl, downloadUrl } = await presignRes.json();

  // Bytes go straight to storage — this server never touches the file.
  await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });

  const message = {
    type: 'file',
    id: crypto.randomUUID(),
    username,
    filename: file.name,
    size: file.size,
    url: downloadUrl,
    ts: Date.now(),
  };
  await channel.publish('message', message);
  persist(message);
});

function persist(message) {
  fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, token: roomToken, message }),
  }).catch(() => {});
}

function renderMessage(m) {
  const div = document.createElement('div');
  div.className = 'msg' + (m.username === username ? ' me' : '');
  const who = `<div class="who">${escapeHtml(m.username)}</div>`;
  const body =
    m.type === 'file'
      ? `<a href="${m.url}" target="_blank" rel="noopener">📎 ${escapeHtml(m.filename)}</a>`
      : escapeHtml(m.text);
  div.innerHTML = who + body;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderSystem(text) {
  const div = document.createElement('div');
  div.className = 'msg system';
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
