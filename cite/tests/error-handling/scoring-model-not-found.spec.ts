// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { randomUUID } from 'crypto';
import { test, expect, Services, getCiteApiToken, seedScoringModel, apiDeleteScoringModel, CITE_THEMES } from '../../fixtures';

// API-only: no browser page is opened, so there is no theme to apply. It still runs under
// each theme's title so every CITE spec reports in both, and its seeded scoring model is
// named per theme so the two runs never share a row.
for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Error Handling and Edge Cases`, () => {
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
      const existingId = await seedScoringModel(`Test Scoring Model ${theme} ${randomUUID()}`);
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
}
