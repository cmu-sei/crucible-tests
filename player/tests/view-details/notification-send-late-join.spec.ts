// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import type { WebSocketRoute } from '@playwright/test';
import {
  test,
  expect,
  seededPrimaryViewName,
  findPlayerHomeViewLink,
  clickWithoutOverlayInterference,
  Services,
} from '../../fixtures';

// SignalR's JSON protocol separates records with this character.
const RECORD_SEPARATOR = '\u001e';

test.describe('View Details', () => {
  test('Send field appears when the join reply arrives after the panel opens', async ({
    playerAuthenticatedPage: page,
  }) => {
    // Whether the viewer may post comes only from the hubs' System "Reply" to Join.
    // Hold those replies so they land after the panel is already open, the order
    // a slow hub produces.
    const held: { ws: WebSocketRoute; message: string }[] = [];
    let holding = true;
    const hubUrl = new RegExp(`^${Services.Player.API.replace(/^http/, 'ws')}/hubs/`);
    await page.routeWebSocket(hubUrl, (ws) => {
      const server = ws.connectToServer();
      server.onMessage((message) => {
        const text = typeof message === 'string' ? message : message.toString();
        if (holding && text.includes('"priority":"System"')) {
          held.push({ ws, message: text });
        } else {
          ws.send(message);
        }
      });
    });
    // The route takes effect only in a document loaded after it was installed
    await page.reload();

    // 1. Open a view and wait until every hub has answered its Join
    await (await findPlayerHomeViewLink(page, seededPrimaryViewName())).click();
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });
    await expect.poll(() => held.length, { timeout: 15000 }).toBeGreaterThanOrEqual(3);

    // 2. Open the notification panel before any reply is delivered
    const notificationsToggle = page.getByRole('button', { name: 'Notifications' });
    await clickWithoutOverlayInterference(page, notificationsToggle);
    await expect(notificationsToggle).toHaveAttribute('aria-expanded', 'true');
    const notificationInput = page.getByPlaceholder('Send system wide notification');
    await expect(notificationInput).toBeHidden();

    // 3. Deliver the held replies
    holding = false;
    for (const { ws, message } of held.splice(0)) {
      ws.send(message.endsWith(RECORD_SEPARATOR) ? message : message + RECORD_SEPARATOR);
    }

    // expect: The send field renders without any further interaction
    await expect(notificationInput).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  });
});
