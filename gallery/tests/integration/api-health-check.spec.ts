// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.describe('Integration and API', () => {
  test('API Health Check', async ({ request }) => {
    // 1. Make a request to the health/live endpoint
    const liveResponse = await request.get(`${Services.Gallery.API}/api/health/live`);

    // expect: Health endpoint responds with status 200
    expect(liveResponse.status()).toBe(200);

    // expect: Response body contains status: 'Healthy'
    const liveBody = await liveResponse.text();
    expect(liveBody).toContain('Healthy');

    // 2. Make a request to the health/ready endpoint
    const readyResponse = await request.get(`${Services.Gallery.API}/api/health/ready`);

    // expect: Readiness endpoint responds with status 200
    expect(readyResponse.status()).toBe(200);

    // expect: Response body contains status: 'Healthy'
    const readyBody = await readyResponse.text();
    expect(readyBody).toContain('Healthy');
  });
});
