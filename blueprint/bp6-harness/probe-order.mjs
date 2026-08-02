// Does the HubBroadcaster deliver a broadcast that a client raised *itself* via HTTP, and how
// long does it take? The two failing specs both fail on window 1 not seeing its OWN change,
// which the UI learns only from SignalR. Two candidate causes:
//   (a) the broadcast is lost/dropped -- but the API logged no drops or timeouts; or
//   (b) it is delivered, just later than the spec's window under load, because the fan-out is now
//       queued and dispatched by a single background reader.
// This measures the HTTP-write -> frame-received latency for a reading client.
import net from 'node:net';
import crypto from 'node:crypto';

const API = process.argv[2] ?? 'http://localhost:4724';
const TOKEN = process.argv[3];
const ROUNDS = Number(process.argv[4] ?? 20);
const RS = '\x1e';
const url = new URL(API);
const HOST = url.hostname, PORT = Number(url.port || 80);
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

function frame(text) {
  const p = Buffer.from(text, 'utf8');
  const mask = crypto.randomBytes(4);
  const masked = Buffer.from(p.map((b, i) => b ^ mask[i % 4]));
  let h;
  if (p.length < 126) h = Buffer.from([0x81, 0x80 | p.length]);
  else { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 0xfe; h.writeUInt16BE(p.length, 2); }
  return Buffer.concat([h, mask, masked]);
}
function parseFrames(buf) {
  const out = []; let off = 0;
  while (off + 2 <= buf.length) {
    const opcode = buf[off] & 0x0f;
    let len = buf[off + 1] & 0x7f, hdr = 2;
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
sock.write(`GET /hubs/main?id=${encodeURIComponent(connectionToken)} HTTP/1.1\r\nHost: ${HOST}:${PORT}\r\n` +
  `Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\n` +
  `Sec-WebSocket-Version: 13\r\nAuthorization: Bearer ${TOKEN}\r\n\r\n`);

const received = [];
let buf = Buffer.alloc(0), upgraded = false;
sock.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  if (!upgraded) {
    const i = buf.indexOf('\r\n\r\n');
    if (i < 0) return;
    upgraded = true; buf = buf.subarray(i + 4);
  }
  const { frames, rest } = parseFrames(buf); buf = rest;
  for (const f of frames) for (const m of f.split(RS).filter(Boolean)) received.push({ at: performance.now(), m });
});

await new Promise((r) => setTimeout(r, 400));
sock.write(frame(`{"protocol":"json","version":1}${RS}`));
await new Promise((r) => setTimeout(r, 300));
sock.write(frame(`{"type":1,"target":"JoinAdmin","arguments":[]}${RS}`));
await new Promise((r) => setTimeout(r, 1200));

console.log(`measuring HTTP-write -> SignalR-frame latency over ${ROUNDS} rounds\n`);
const lats = [];
let missed = 0;
for (let i = 0; i < ROUNDS; i++) {
  const id = crypto.randomUUID();
  const before = received.length;
  const t0 = performance.now();
  const res = await fetch(`${API}/api/users`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ id, name: `OrderProbe-${id}` }),
  });
  if (!res.ok) { console.log(`  round ${i}: POST ${res.status}`); continue; }

  // wait up to 20s for the matching UserCreated frame
  let found = null;
  const deadline = performance.now() + 20000;
  while (performance.now() < deadline) {
    for (let k = before; k < received.length; k++) {
      if (received[k].m.includes('UserCreated') && received[k].m.includes(id)) { found = received[k]; break; }
    }
    if (found) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  if (found) lats.push(found.at - t0);
  else { missed++; console.log(`  round ${i}: NO FRAME within 20s`); }

  await fetch(`${API}/api/users/${id}`, { method: 'DELETE', headers: auth });
}

const sorted = [...lats].sort((a, b) => a - b);
const pct = (p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : NaN;
console.log(`\ndelivered ${lats.length}/${ROUNDS}, missed ${missed}`);
if (lats.length) {
  console.log(`  median ${pct(50).toFixed(0)}ms  p95 ${pct(95).toFixed(0)}ms  max ${Math.max(...lats).toFixed(0)}ms`);
}
sock.destroy();
process.exit(0);
