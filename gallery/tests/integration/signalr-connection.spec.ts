// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoExhibitSection, Services } from '../../fixtures';

test.describe('Integration and API', () => {
  test('SignalR Real-Time Connection', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    // Watch for the SignalR websocket itself rather than scraping console text.
    // signalr.service.ts connects to `${ApiUrl}/hubs/main?bearer=<token>`, so the
    // socket opening is direct proof the transport negotiated — console logging is
    // incidental and can be stripped from a production build.
    const hubSockets: string[] = [];
    page.on('websocket', (ws) => {
      if (ws.url().includes('/hubs/main')) {
        hubSockets.push(ws.url());
      }
    });

    // 1. Navigate to an exhibit Wall view (the page that joins the hub). Go by id
    // rather than via the paginated My Exhibits list so concurrent seeding by
    // sibling specs can't push the target row onto page 2.
    await gotoExhibitSection(page, seededExhibit.exhibitId, 'wall');
    await expect(page).toHaveTitle('Gallery Wall');

    // expect: the SignalR hub connection is established over WebSocket
    await expect
      .poll(() => hubSockets.length, {
        message: 'Expected a SignalR WebSocket connection to /hubs/main',
        timeout: 30000,
      })
      .toBeGreaterThan(0);

    // expect: the hub is served by the Gallery API, and the connection is
    // authenticated (the service appends the bearer token to the hub URL)
    expect(hubSockets[0]).toContain(new URL(Services.Gallery.API).host);
    expect(hubSockets[0]).toContain('bearer=');

    // expect: real-time updates actually flow — the wall renders the seeded
    // cards delivered for the exhibit rather than staying empty
    await expect(page.getByText('Test Card 1')).toBeVisible();
  });
});
