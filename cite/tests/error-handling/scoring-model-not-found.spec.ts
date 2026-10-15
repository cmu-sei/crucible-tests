// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { randomUUID } from 'crypto';
import { test, expect, Services, getCiteApiToken, seedScoringModel, apiDeleteScoringModel } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Scoring Model Not Found returns 404', async ({ request }) => {
    const token = await getCiteApiToken(request);
    const headers = { Authorization: `Bearer ${token}` };

    // 1. Request a scoring model ID that does not exist
    const missingId = randomUUID();
    const missing = await request.get(`${Services.Cite.API}/api/scoringModels/${missingId}`, { headers });

    // expect: 404 naming the ID, not a 500 from a null dereference
    expect(missing.status()).toBe(404);
    expect((await missing.json()).title).toContain(missingId);

    // 2. Request a scoring model that does exist
    const existingId = await seedScoringModel();
    try {
      const existing = await request.get(`${Services.Cite.API}/api/scoringModels/${existingId}`, { headers });

      // expect: the existing scoring model is still returned
      expect(existing.status()).toBe(200);
      expect((await existing.json()).id).toBe(existingId);
    } finally {
      await apiDeleteScoringModel(existingId);
    }
  });
});
