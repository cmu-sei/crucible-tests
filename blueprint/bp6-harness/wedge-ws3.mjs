// BP-6 reproduction, attempt 4: log EVERY stalled write, not just sampled ones.
//
// Attempt 3 reported "NOT wedged in 300 writes" -- but its slowest write was 11004ms while
// every sampled write printed 9-11ms. So one un-sampled write stalled for 11 seconds and
// then recovered. That is the defect, caught mid-act: 11s is not "slow", it is a write
// parked behind a SignalR send to a client that isn't draining. It matches the 12s figure in
// the original BP-6 report, where a hard `curl --max-time` cap made the same stall look like
// a permanent hang.
//
// This run prints every write over a threshold so the stalls can be counted and located
// rather than hidden by sampling.
//
// Usage: node wedge-ws3.mjs <apiBase> <token> [writes] [nameBytes] [conns] [stallMs]

import net from 'node:net';
import crypto from 'node:crypto';

const API = process.argv[2] ?? 'http://localhost:4724';
const TOKEN = process.argv[3];
const WRITES = Number(process.argv[4] ?? 200);
const NAME_BYTES = Number(process.argv[5] ?? 60000);
const CONNS = Number(process.argv[6] ?? 4);
const STALL_MS = Number(process.argv[7] ?? 150);
const RS = '\x1e';
const url = new URL(API);
const HOST = url.hostname, PORT = Number(url.port || 80);
const auth = { Authorization: `Bearer ${TOKEN}` };

// Deliberately generous: we want to measure how long a stall lasts, not cut it off. A hard
// cap is what made this look like a permanent hang in the original report.
const CAP_MS = 120000;

async function timed(label, fn) {
  const t0 = performance.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), CAP_MS);
  try {
    const res = await fn(ac.signal);
    return { label, ok: res.ok, status: res.status, ms: performance.now() - t0 };
  } catch (e) {
    return { label, ok: false, status: e.name === 'AbortError' ? `TIMEOUT>${CAP_MS}ms` : `ERR(${e.name})`, ms: performance.now() - t0 };
  } finally { clearTimeout(timer); }
}

function frame(text) {
  const p = Buffer.from(text, 'utf8');
  const mask = crypto.randomBytes(4);
  const masked = Buffer.from(p.map((b, i) => b ^ mask[i % 4]));
  let h;
  if (p.length < 126) h = Buffer.from([0x81, 0x80 | p.length]);
  else if (p.length < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 0xfe; h.writeUInt16BE(p.length, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 0xff; h.writeBigUInt64BE(BigInt(p.length), 2); }
  return Buffer.concat([h, mask, masked]);
}

async function silentConn() {
  const neg = await fetch(`${API}/hubs/main/negotiate?negotiateVersion=1`, { method: 'POST', headers: auth });
  const { connectionToken } = await neg.json();
  const sock = net.connect({ host: HOST, port: PORT });
  sock.setNoDelay(true);
  await new Promise((res, rej) => { sock.once('connect', res); sock.once('error', rej); });
  const key = crypto.randomBytes(16).toString('base64');
  sock.write(`GET /hubs/main?id=${encodeURIComponent(connectionToken)} HTTP/1.1\r\nHost: ${HOST}:${PORT}\r\n` +
    `Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\n` +
    `Sec-WebSocket-Version: 13\r\nAuthorization: Bearer ${TOKEN}\r\n\r\n`);
  await new Promise((res, rej) => {
    let buf = Buffer.alloc(0);
    const onData = (d) => {
      buf = Buffer.concat([buf, d]);
      if (buf.includes('\r\n\r\n')) { sock.off('data', onData); /101/.test(buf.toString('latin1', 0, 40)) ? res() : rej(new Error('upgrade failed')); }
    };
    sock.on('data', onData); sock.once('error', rej);
    setTimeout(() => rej(new Error('upgrade timeout')), 10000);
  });
  sock.write(frame(`{"protocol":"json","version":1}${RS}`));
  await new Promise((r) => setTimeout(r, 250));
  sock.write(frame(`{"type":1,"target":"JoinAdmin","arguments":[]}${RS}`));
  sock.write(frame(`{"type":1,"target":"Join","arguments":[]}${RS}`));
  await new Promise((r) => setTimeout(r, 1000));
  sock.pause();
  return sock;
}

console.log(`BP-6: measuring write latency with ${CONNS} silent subscriber(s)`);
console.log(`  writes=${WRITES} nameBytes=${NAME_BYTES} stallThreshold=${STALL_MS}ms cap=${CAP_MS}ms\n`);

const id = crypto.randomUUID();
await timed('seed', (s) => fetch(`${API}/api/users`, {
  method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ id, name: `BP6Seed-${id}` }), signal: s }));

const put = (n) => timed('PUT', (s) => fetch(`${API}/api/users/${id}`, {
  method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ id, name: `BP6-${n}-${'x'.repeat(NAME_BYTES)}` }), signal: s }));

const base = [];
for (let i = 0; i < 5; i++) base.push((await put(-i)).ms);
console.log(`Baseline, no silent subscribers: ${base.map((m) => m.toFixed(0) + 'ms').join(', ')}\n`);

const socks = [];
for (let i = 0; i < CONNS; i++) socks.push(await silentConn());
console.log(`${CONNS} silent subscriber(s) open and not reading.\n`);

const lat = [], stalls = [];
let failed = null;
for (let i = 1; i <= WRITES; i++) {
  const w = await put(i);
  lat.push(w.ms);
  if (w.ms >= STALL_MS) {
    stalls.push({ i, ms: w.ms, status: w.status });
    console.log(`  STALL  write #${String(i).padStart(4)}  status=${w.status}  ${(w.ms / 1000).toFixed(2)}s`);
  }
  if (!w.ok) { failed = { i, ...w }; console.log(`  FAILED write #${i}: ${w.status} after ${(w.ms / 1000).toFixed(1)}s`); break; }
}

const sorted = [...lat].sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
console.log(`\n--- LATENCY over ${lat.length} writes ---`);
console.log(`  median ${pct(50).toFixed(0)}ms   p95 ${pct(95).toFixed(0)}ms   p99 ${pct(99).toFixed(0)}ms   max ${Math.max(...lat).toFixed(0)}ms`);
console.log(`  stalls >=${STALL_MS}ms: ${stalls.length}` + (stalls.length ? `  (worst ${(Math.max(...stalls.map((s) => s.ms)) / 1000).toFixed(2)}s)` : ''));

const r = await timed('GET', (s) => fetch(`${API}/api/users`, { headers: auth, signal: s }));
console.log(`  read during/after: status=${r.status} ${r.ms.toFixed(0)}ms`);

console.log('\n--- VERDICT ---');
if (failed) console.log(`Writes WEDGED permanently at #${failed.i} (${failed.status}).`);
else if (stalls.length) console.log(`Writes STALL: ${stalls.length}/${lat.length} exceeded ${STALL_MS}ms, worst ${(Math.max(...stalls.map((s) => s.ms)) / 1000).toFixed(2)}s, while the median stayed ${pct(50).toFixed(0)}ms and reads stayed fast. A non-draining subscriber delays writes on the request path.`);
else console.log(`No stalls >=${STALL_MS}ms observed.`);

for (const s of socks) { s.resume(); s.destroy(); }
await new Promise((res) => setTimeout(res, 1500));
await timed('cleanup', (s) => fetch(`${API}/api/users/${id}`, { method: 'DELETE', headers: auth, signal: s }));
process.exit(0);
