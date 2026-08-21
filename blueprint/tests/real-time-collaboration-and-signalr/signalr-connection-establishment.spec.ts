// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import type { WebSocket } from '@playwright/test';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  tempBlueprintName,
  navigateToMsel,
} from '../../test-helpers';

/**
 * Verifies the Blueprint UI establishes a working SignalR hub connection when a MSEL is
 * opened, and that the connection actually carries server-pushed updates.
 *
 * Rewritten. The previous version had two defects:
 *
 * 1. **It leaked a MSEL on every run.** It created one named the literal
 *    `'SignalR Test MSEL'` through the UI, with no afterEach. The teardown purge keys off
 *    the shape `tempBlueprintName()` emits, so that literal was never swept.
 * 2. **It could not fail, on several counts.** Its "WebSocket check" was
 *    `resolve(true)` inside a `setTimeout` — a hardcoded pass. Its
 *    `signalRIndicators` boolean OR-ed in `(!hasSignalRError && consoleLogs.length > 0)`,
 *    which is true on any page that logs anything, and its final `if (signalRIndicators)
 *    ... else console.warn(...)` passed either way, concluding "SignalR ... may not be
 *    implemented" while asserting nothing.
 *
 * SignalR **is** implemented and working — verified live below, and independently in
 * `real-time-msel-updates.spec.ts`. So instead of sniffing console text for hints, this
 * spec observes the transport directly with `page.on('websocket')` and asserts the
 * handshake, the hub invocations, and one real server push end to end.
 *
 * What makes each assertion deterministic (from blueprint.ui `signalr.service.ts` and
 * `Hubs/MainHub.cs`, and confirmed against the running stack):
 *   - The hub URL is `{ApiUrl}/hubs/main?bearer=<token>` — one socket, opened on
 *     `startConnection`, which `home-app.component.ts` calls on load.
 *   - The client sends the JSON handshake `{"protocol":"json","version":2}`, then invokes
 *     `Join`, then `selectMsel` with the MSEL id (because `/build?msel=<id>` selects it).
 *   - The server answers each invocation with a completion frame (`"type":3`), and pushes
 *     `MselUpdated` to the MSEL's group on any change.
 * Frames are ``-delimited records, and several can arrive in one payload, so the
 * assertions match on substrings of the concatenated stream rather than parsing per frame.
 *
 * `page.on('websocket')` is filtered to `/hubs/main`, because the hub is not the only socket
 * the page may open. When the UI resource runs in dev mode (`Launch__Blueprint=true` ->
 * `ng serve`), `@angular-devkit/build-angular:dev-server` also opens a Vite HMR socket at
 * `ws://localhost:<uiPort>/?token=…`. Counting every socket made this spec pass only in prod
 * mode (`npx serve dist/browser`, no HMR); scoping to the hub path makes it mode-independent
 * and keeps HMR traffic out of the frame buffers and the close/error assertions below — the
 * HMR socket legitimately closes when the page goes away.
 */
const HUB_PATH = '/hubs/main';

test.describe('Real-time Collaboration and SignalR', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, {
      name: tempBlueprintName('TestBP-SignalRConnect'),
      description: 'Seeded to verify SignalR hub connection establishment.',
    });
    mselId = msel.id;
  });

  test.afterEach(async () => {
    if (mselId) {
      try {
        await deleteMsel(token, mselId);
      } catch (err) {
        console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
      }
    }
  });

  test('SignalR Connection Establishment', async ({ blueprintAuthenticatedPage: page }) => {
    const sockets: WebSocket[] = [];
    const sentFrames: string[] = [];
    const receivedFrames: string[] = [];
    const closedSockets: string[] = [];
    const socketErrors: string[] = [];
    const consoleErrors: string[] = [];

    const payloadText = (payload: string | Buffer): string =>
      typeof payload === 'string' ? payload : payload.toString('utf8');

    page.on('websocket', (ws) => {
      // Ignore anything that is not the SignalR hub (see the note on HUB_PATH above).
      if (!new URL(ws.url()).pathname.endsWith(HUB_PATH)) return;
      sockets.push(ws);
      ws.on('framesent', (frame) => sentFrames.push(payloadText(frame.payload)));
      ws.on('framereceived', (frame) => receivedFrames.push(payloadText(frame.payload)));
      ws.on('close', () => closedSockets.push(ws.url()));
      ws.on('socketerror', (error) => socketErrors.push(error));
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // 1. Log in and navigate to a MSEL. This is what triggers `startConnection` +
    // `selectMsel` in the Angular app.
    await navigateToMsel(page, mselId);

    // expect: a hub connection is opened, to the Blueprint API's /hubs/main endpoint.
    await expect
      .poll(() => sockets.length, {
        timeout: 30000,
        intervals: [200, 500, 1000],
        message: 'the Blueprint UI never opened a hub WebSocket after loading a MSEL',
      })
      .toBe(1);

    const hubSocket = sockets[0];
    // The hub is reached over ws:// (or wss:// under TLS) at the API host, so compare the
    // parsed URL rather than string-matching a port.
    const hubUrl = new URL(hubSocket.url());
    const apiUrl = new URL(Services.Blueprint.API);
    expect(hubUrl.host).toBe(apiUrl.host);
    expect(hubUrl.pathname).toBe(`${apiUrl.pathname.replace(/\/$/, '')}${HUB_PATH}`);
    expect(hubUrl.protocol).toMatch(/^wss?:$/);

    // expect: the hub connection is authenticated. `getHubUrlWithAuth()` appends the OIDC
    // access token as `?bearer=`; MainHub is `[Authorize(AuthenticationSchemes="Bearer")]`,
    // so a connection without it would be rejected.
    const bearer = hubUrl.searchParams.get('bearer');
    expect(bearer, 'hub URL carried no ?bearer= access token').toBeTruthy();
    // Shape check only — three dot-separated JWT segments. Not the token's value.
    expect(bearer!.split('.')).toHaveLength(3);

    // expect: the SignalR handshake completes and the client joins the hub.
    await expect
      .poll(() => sentFrames.join(''), {
        timeout: 30000,
        intervals: [200, 500, 1000],
        message: 'client never sent the SignalR JSON handshake',
      })
      .toContain('{"protocol":"json","version":2}');

    await expect
      .poll(() => sentFrames.join(''), {
        timeout: 30000,
        intervals: [200, 500, 1000],
        message: 'client never invoked the hub Join method',
      })
      .toContain('"target":"Join"');

    // expect: the server answered the invocation. A SignalR completion frame is type 3;
    // its presence proves the hub accepted the authenticated connection and ran Join.
    await expect
      .poll(() => receivedFrames.join(''), {
        timeout: 30000,
        intervals: [200, 500, 1000],
        message: 'server never sent an invocation-completion frame for Join',
      })
      .toContain('"type":3');

    // expect: the client subscribes to *this* MSEL's group, so pushes about it arrive.
    await expect
      .poll(() => sentFrames.join(''), {
        timeout: 30000,
        intervals: [200, 500, 1000],
        message: `client never invoked selectMsel for ${mselId}`,
      })
      .toContain('"target":"selectMsel"');
    expect(sentFrames.join('')).toContain(mselId);

    // expect: the connection carries real server pushes. Change the MSEL out-of-band via
    // the API and require the hub to deliver `MselUpdated` — with no reload, so only a
    // push can satisfy it. This is the assertion that proves the connection is *useful*
    // and not merely open.
    const renamed = tempBlueprintName('TestBP-SignalRConnect-Renamed');
    await updateMsel(token, mselId, { name: renamed });

    await expect
      .poll(() => receivedFrames.join('').includes('"target":"MselUpdated"'), {
        timeout: 30000,
        intervals: [250, 500, 1000],
        message: 'the hub never pushed MselUpdated after the MSEL was changed via the API',
      })
      .toBe(true);

    // ...and the UI applied it. The Config tab's Name field is bound to the store that
    // `MselUpdated` feeds, so this closes the loop from server push to rendered DOM.
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(renamed, {
      timeout: 20000,
    });

    // expect: no connection errors. The socket must still be open, with no transport
    // error and no SignalR/hub error logged to the console.
    expect(closedSockets, 'the hub WebSocket closed during the test').toEqual([]);
    expect(socketErrors, 'the hub WebSocket reported a transport error').toEqual([]);

    const signalRErrors = consoleErrors.filter((text) =>
      /signalr|hub|websocket/i.test(text)
    );
    expect(
      signalRErrors,
      `SignalR-related console errors were logged: ${signalRErrors.join(' | ')}`
    ).toEqual([]);
  });
});
