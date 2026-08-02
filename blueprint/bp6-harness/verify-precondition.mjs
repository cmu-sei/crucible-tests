// Precondition check for the BP-6 harness.
//
// The harness concluded "NOT wedged", but that conclusion is only meaningful if the silent
// connection was actually a *target* of the broadcasts. If `JoinAdmin` silently failed, or
// if User writes don't fan out to that group, then nothing was ever sent to the silent
// socket and the negative result says nothing about the defect.
//
// So: connect a WebSocket that DOES read, join the same groups the harness joins, perform a
// write, and print every frame received. If `UserCreated` arrives, the group join works and
// User writes do fan out to it -- the precondition holds.

import net from 'node:net';
import crypto from 'node:crypto';

const API = process.argv[2] ?? 'http://localhost:4724';
const TOKEN = process.argv[3];
const RS = '\x1e';
const url = new URL(API);
const HOST = url.hostname, PORT = Number(url.port || 80);
const auth = { Authorization: `Bearer ${TOKEN}` };

function frame(text) {
  const payload = Buffer.from(text, 'utf8');
  const mask = crypto.randomBytes(4);
  const masked = Buffer.from(payload.map((b, i) => b ^ mask[i % 4]));
  let header;
  if (payload.length < 126) header = Buffer.from([0x81, 0x80 | payload.length]);
  else { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0xfe; header.writeUInt16BE(payload.length, 2); }
  return Buffer.concat([header, mask, masked]);
}

/** Server->client frames are unmasked; enough of a parser to read text payloads. */
function parseFrames(buf) {
  const out = [];
  let off = 0;
  while (off + 2 <= buf.length) {
    const opcode = buf[off] & 0x0f;
    let len = buf[off + 1] & 0x7f;
    let hdr = 2;
    if (len === 126) { if (off + 4 > buf.length) break; len = buf.readUInt16BE(off + 2); hdr = 4; }
    else if (len === 127) { if (off + 10 > buf.length) break; len = Number(buf.readBigUInt64BE(off + 2)); hdr = 10; }
    if (off + hdr + len > buf.length) break;
    if (opcode === 1) out.push(buf.toString('utf8', off + hdr, off + hdr + len));
    off += hdr + len;
  }
  return { frames: out, rest: buf.subarray(off) };
}

const neg = await fetch(`${API}/hubs/main/negotiate?negotiateVersion=1`, { method: 'POST', headers: auth });
const { connectionToken } = await neg.json();
const sock = net.connect({ host: HOST, port: PORT });
sock.setNoDelay(true);
await new Promise((res, rej) => { sock.once('connect', res); sock.once('error', rej); });

const key = crypto.randomBytes(16).toString('base64');
sock.write(
  `GET /hubs/main?id=${encodeURIComponent(connectionToken)} HTTP/1.1\r\nHost: ${HOST}:${PORT}\r\n` +
  `Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\n` +
  `Sec-WebSocket-Version: 13\r\nAuthorization: Bearer ${TOKEN}\r\n\r\n`,
);

const received = [];
let buf = Buffer.alloc(0), upgraded = false;
sock.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  if (!upgraded) {
    const i = buf.indexOf('\r\n\r\n');
    if (i < 0) return;
    console.log('upgrade:', buf.toString('latin1', 0, buf.indexOf('\r\n')));
    upgraded = true;
    buf = buf.subarray(i + 4);
  }
  const { frames, rest } = parseFrames(buf);
  buf = rest;
  for (const f of frames) for (const m of f.split(RS).filter(Boolean)) received.push(m);
});

await new Promise((r) => setTimeout(r, 500));
sock.write(frame(`{"protocol":"json","version":1}${RS}`));
await new Promise((r) => setTimeout(r, 400));
sock.write(frame(`{"type":1,"target":"JoinAdmin","arguments":[]}${RS}`));
sock.write(frame(`{"type":1,"target":"Join","arguments":[]}${RS}`));
await new Promise((r) => setTimeout(r, 1500));

console.log(`\nframes received before the write: ${received.length}`);
received.forEach((m) => console.log('  <-', m.slice(0, 160)));

const id = crypto.randomUUID();
const before = received.length;
const res = await fetch(`${API}/api/users`, {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ id, name: `BP6Precond-${id}` }),
});
console.log(`\nPOST /api/users -> ${res.status}`);
await new Promise((r) => setTimeout(r, 2000));

const after = received.slice(before);
console.log(`\nframes received after the write: ${after.length}`);
after.forEach((m) => console.log('  <-', m.slice(0, 200)));

const gotUserCreated = after.some((m) => m.includes('UserCreated'));
console.log('\n--- PRECONDITION ---');
console.log(gotUserCreated
  ? 'HOLDS: this connection is in the broadcast group and User writes fan out to it.'
  : 'FAILS: no UserCreated frame arrived -- the silent-subscriber result proves nothing.');

await fetch(`${API}/api/users/${id}`, { method: 'DELETE', headers: auth });
sock.destroy();
process.exit(gotUserCreated ? 0 : 1);
