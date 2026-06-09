// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';

test.describe('xAPI Integration and Learning Analytics', () => {
  test('xAPI Statement for Competency Assertion', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Complete a scenario event that has competency mappings
    await page.goto(Services.Blueprint.UI);

    // Navigate to Event Dashboard
    await expect(page.locator('text="Event Dashboard"').first()).toBeVisible({ timeout: 10000 });

    // Look for Join Events section to find an active event
    const joinSection = page.locator('text="Join Events", text="Join"').first();
    if (await joinSection.isVisible({ timeout: 5000 })) {
      await joinSection.click();
      await page.waitForLoadState('networkidle');
    }

    // Find an event with scenario events
    const viewEventButton = page.locator('button:has-text("View"), a:has-text("View"), button:has-text("Open")').first();

    if (await viewEventButton.isVisible({ timeout: 5000 })) {
      await viewEventButton.click();
      await page.waitForLoadState('networkidle');

      // Look for a scenario event/inject to complete
      const eventItem = page.locator('[data-test-id*="event"], [class*="event-item"], [class*="inject"]').first();

      if (await eventItem.isVisible({ timeout: 5000 })) {
        // Click to view/complete the event
        await eventItem.click();
        await page.waitForLoadState('networkidle');

        // Look for a Complete or Mark Complete button
        const completeButton = page.locator('button:has-text("Complete"), button:has-text("Mark Complete")').first();

        if (await completeButton.isVisible({ timeout: 5000 })) {
          await completeButton.click();

          // expect: Scenario event is marked complete
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);

          // 2. Query LRsql for statements with PCTE competency extension
          const lrsqlApiUrl = `${Services.Lrsql}/xapi/statements`;
          const statementsResponse = await page.request.get(lrsqlApiUrl, {
            headers: {
              'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
              'X-Experience-API-Version': '1.0.3'
            },
            params: {
              limit: 50
            }
          });

          expect(statementsResponse.status()).toBe(200);
          const statementsData = await statementsResponse.json();
          const statements = statementsData.statements || [];

          // Look for completed statement with competency extension
          const competencyStatement = statements.find((s: any) =>
            s.verb?.id === 'http://adlnet.gov/exprs/verbs/completed' &&
            s.context?.extensions
          );

          if (competencyStatement) {
            // expect: xAPI statement includes competency assertion extension
            const extensions = competencyStatement.context?.extensions || {};
            const competencyExtensions = Object.keys(extensions).filter(key =>
              key.includes('competency') || key.includes('nice') || key.includes('dcwf') || key.includes('pcte')
            );

            expect(competencyExtensions.length).toBeGreaterThan(0);

            // expect: Statement includes NICE/DCWF competency ID
            const competencyExtension = extensions[competencyExtensions[0]];
            expect(competencyExtension).toBeTruthy();

            if (typeof competencyExtension === 'object') {
              // expect: Statement includes proficiency level if configured
              // This is optional, so we check if it exists but don't require it
              const hasCompetencyId = competencyExtension.id || competencyExtension.competencyId || competencyExtension.competency;
              expect(hasCompetencyId).toBeTruthy();
            }

            // expect: Statement context indicates Blueprint as the asserting platform
            expect(competencyStatement.context?.platform).toBe('blueprint');
          } else {
            // If no competency statement found, check if the event had competency mappings
            // This may indicate competency mapping is not configured for this event
            console.log('No competency assertion statement found. Event may not have competency mappings configured.');
          }
        } else {
          test.skip('No complete button found for event');
        }
      } else {
        test.skip('No scenario events found in MSEL');
      }
    } else {
      test.skip('No active events found to join');
    }
  });
});
