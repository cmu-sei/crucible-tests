# BP-6 harnesses — stalled-client reproduction and delivery measurement

Plain Node, no dependencies. The WebSocket framing is hand-rolled on purpose: the whole point is a
client that **stops reading** while keeping the socket open, and off-the-shelf clients will not do
that.

Get a token first (the `blueprint.ui` client accepts the password grant for `admin`/`admin` on a
dev stack):

```bash
TOKEN=$(curl -sk -X POST "https://localhost:8443/realms/crucible/protocol/openid-connect/token" \
  -d client_id=blueprint.ui -d username=admin -d password=admin \
  -d grant_type=password -d "scope=openid profile blueprint" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).access_token))")
```

## 1. `verify-precondition.mjs` — run this first

Confirms a **reading** client in the same groups does receive `UserCreated`. Without this, a "no
stall" result from the harness below is meaningless — it may just mean nothing was ever sent there.

```bash
node verify-precondition.mjs http://localhost:4724 "$TOKEN"
```

## 2. `wedge-ws3.mjs` — the reproduction

Opens N subscribed WebSockets, joins their groups, then `sock.pause()`es them so they stop draining.
Then times writes, logging **every** write over a threshold (sampling hides the stall — one run
reported `max 11004ms` while every printed write showed 9ms).

```bash
# apiBase, token, writes, nameBytes, silentConns, stallThresholdMs
node wedge-ws3.mjs http://localhost:4724 "$TOKEN" 200 60000 4 150
```

Measured against Blueprint:

| | median | p95 | p99 | max | stalls >=150ms |
|---|---|---|---|---|---|
| before | 9ms | 13ms | 10,974ms | 11,003ms | 4 |
| after | 10ms | 13ms | 22ms | 48ms | 0 |

Notes on why this shape is needed:
- **Long polling does not reproduce it** — a poll-less long-polling connection is reaped by the
  server and stops being a broadcast target.
- **Low volume does not reproduce it** — 40 x 60KB to one silent socket sits under the combined
  send+receive buffer capacity. Four subscribers were needed.

## 3. `probe-order.mjs` — the fix must not silence delivery

Measures HTTP-write -> SignalR-frame latency for a client that *is* reading, so a "fix" that simply
drops broadcasts fails here.

```bash
node probe-order.mjs http://localhost:4724 "$TOKEN" 20
# expected: 20/20 delivered, median ~4ms
```

See `blueprint/BP-6-platform-report.html` for the full analysis and the
`Crucible.Common.SignalR` proposal, and BP-6 in `blueprint/blueprint-app-bugs.md`.
