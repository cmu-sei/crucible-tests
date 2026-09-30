// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';
import { request as pwRequest } from '@playwright/test';
import {
  getKeycloakAdminToken,
  createKeycloakUser,
  deleteKeycloakUser,
  tempUsername,
  getUserToken,
} from '../../../keycloak-admin';

/**
 * A user who is not a member of an evaluation must not be able to reach — let alone
 * score — that evaluation's submissions. The check is deliberately at the API layer:
 * the UI-side read-only assertion lives in the scoresheet suite ("Modify Score
 * without CanSubmit Permission"), and hiding a control proves nothing about whether
 * the server would have accepted the write.
 *
 * The probe runs as a freshly created role-less Keycloak user rather than as `admin`,
 * because `admin` holds every CITE system permission and therefore can never produce
 * a 403.
 */
test.describe('Error Handling and Edge Cases', () => {
  test('Submission Without Required Permissions', async () => {
    const kcAdminToken = await getKeycloakAdminToken();
    const username = tempUsername('citenoperm');
    const password = 'TestPassword123!';

    const seeded = await seedCompleteEvaluation(`E2E NoPerm Evaluation ${Date.now()}`, 1);
    const user = await createKeycloakUser(kcAdminToken, {
      username,
      password,
      email: `${username}@test.local`,
      realmRoles: [], // no CITE system permissions at all
    });

    try {
      const token = await getUserToken(username, password, 'cite.ui', 'openid profile cite');
      const ctx = await pwRequest.newContext({
        baseURL: Services.Cite.API,
        extraHTTPHeaders: { Authorization: `Bearer ${token}` },
        ignoreHTTPSErrors: true,
      });

      try {
        // 1. The user authenticates fine — the token is accepted, the list just scopes to nothing.
        const listResponse = await ctx.get('/api/evaluations');
        expect(listResponse.status()).toBe(200);
        const visible = await listResponse.json();

        // expect: Without an evaluation membership there is nothing to submit
        expect(Array.isArray(visible)).toBe(true);
        expect(visible.map((e: { id: string }) => e.id)).not.toContain(seeded.evaluationId);

        // 2. Reading the evaluation directly is refused rather than leaking it.
        const detailResponse = await ctx.get(`/api/evaluations/${seeded.evaluationId}`);

        // expect: API rejects the read with 403 Forbidden
        expect(detailResponse.status()).toBe(403);

        // expect: Error message indicates insufficient permissions
        expect(await detailResponse.json()).toMatchObject({
          title: 'Insufficient Permissions',
          status: 403,
        });

        // 3. Writing scoring content is refused too, so no unauthorized changes are saved.
        const writeResponse = await ctx.post('/api/scoringmodels', {
          data: {
            description: `E2E NoPerm Should Not Exist ${Date.now()}`,
            status: 'Pending',
            calculationEquation: '{average}',
          },
        });
        expect(writeResponse.status()).toBe(403);
      } finally {
        await ctx.dispose();
      }
    } finally {
      await deleteKeycloakUser(kcAdminToken, user.id);
      await cleanupCompleteEvaluation(seeded);
    }
  });
});
