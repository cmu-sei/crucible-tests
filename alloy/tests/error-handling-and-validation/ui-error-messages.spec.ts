// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

// The UI tells the user why something failed, in the API's words, instead of logging it to the
// console or showing an empty list. Failures are injected with page.route(), so no service has to
// be broken to run these.

import { expect, Page, test } from '@playwright/test';
import { getUserToken } from '../../../keycloak-admin';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { ALLOY_THEMES, applyAlloyTheme, createTestEventTemplate } from '../../test-helpers';

/** A ProblemDetails response, as Alloy's JsonExceptionFilter writes it. */
function problem(status: number, title: string) {
  return {
    status,
    contentType: 'application/problem+json',
    body: JSON.stringify({ status, title }),
  };
}

/** Creates a template through the UI and returns its id, read from the create response. */
async function createTemplate(page: Page, name: string): Promise<string> {
  const created = page.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/api\/eventtemplates$/i.test(new URL(r.url()).pathname),
    { timeout: 60000 }
  );
  await createTestEventTemplate(page, name);
  return (await (await created).json()).id;
}

/**
 * Deletes a template through the API. Cleaning up through the UI is unreliable here, since a test
 * may leave the page anywhere, and a failure there leaves the template behind.
 */
async function deleteTemplate(page: Page, id: string) {
  const token = await getUserToken(
    'admin',
    'admin',
    'alloy.ui',
    'openid profile player player-vm alloy caster steamfitter'
  );
  const base = Services.Alloy.API.replace(/\/$/, '');
  const response = await page.request.delete(`${base}/api/eventtemplates/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok()) {
    console.log(`Error deleting event template ${id}: ${response.status()}`);
  }
}

/** The bottom sheet the error handler opens. */
function systemMessage(page: Page) {
  return page.locator('app-system-message');
}

for (const theme of ALLOY_THEMES) {
  test.describe(`${theme} theme › Error Messages`, () => {
    let seededTemplateId: string | null = null;

    test.afterEach(async ({ page }) => {
      if (seededTemplateId) {
        await deleteTemplate(page, seededTemplateId);
        seededTemplateId = null;
      }
    });

    test('A Refused Launch Shows The Reason', async ({ page }) => {
      const reason =
        'You already have as many active events as you can have at once (2). End one before launching another.';

      await authenticateWithKeycloak(page, Services.Alloy.UI);
      await applyAlloyTheme(page, theme);
      await page.goto(`${Services.Alloy.UI}/admin`);
      await expect(page.getByRole('table')).toBeVisible();
      const templateName = `ZZ Refused Launch ${Date.now()}`;
      seededTemplateId = await createTemplate(page, templateName);

      // Refuse the launch the way the API does when the user is at their limit
      await page.route(/\/api\/eventtemplates\/[^/]+\/events$/i, (route) =>
        route.request().method() === 'POST' ? route.fulfill(problem(409, reason)) : route.fallback()
      );

      // 1. Launch from the template's page
      await page.goto(`${Services.Alloy.UI}/templates/${seededTemplateId}`);
      await expect(page.getByRole('heading', { name: templateName })).toBeVisible({
        timeout: 30000,
      });
      await page.getByRole('button', { name: 'Launch', exact: true }).click();

      // expect: the API's reason is shown, where it was only logged to the console before
      await expect(systemMessage(page)).toBeVisible();
      await expect(systemMessage(page).getByText(reason)).toBeVisible();

      // expect: the user can launch again once they have dealt with it
      await systemMessage(page).getByRole('button', { name: 'Close' }).click();
      await expect(systemMessage(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Launch', exact: true })).toBeVisible();
    });

    test('An Unreachable Hub Is Reported Once', async ({ page }) => {
      const warnings: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'warning' && msg.text().startsWith('Alloy hub unreachable')) {
          warnings.push(msg.text());
        }
      });
      let negotiations = 0;
      await page.route('**/hubs/engine/negotiate**', (route) => {
        negotiations++;
        return route.abort('connectionrefused');
      });

      // 1. Open Administration, which connects to the hub
      await authenticateWithKeycloak(page, Services.Alloy.UI);
      await applyAlloyTheme(page, theme);
      await page.goto(`${Services.Alloy.UI}/admin`);

      // expect: the user is told live updates are off, and why it matters
      await expect(systemMessage(page).getByText('Live Updates Unavailable')).toBeVisible();
      await expect(
        systemMessage(page).getByText(
          'Alloy could not connect to the Alloy API for live updates. Event status changes will not appear until the connection is restored. Refresh the page to try again.'
        )
      ).toBeVisible();
      await systemMessage(page).getByRole('button', { name: 'Close' }).click();

      // 2. Open Roles, which tries the hub again
      await page.getByText('Roles', { exact: true }).click();
      await expect.poll(() => negotiations).toBeGreaterThanOrEqual(2);

      // expect: the retry fails too, but the user is not told a second time
      await page.waitForTimeout(1000);
      expect(warnings).toHaveLength(1);
      await expect(systemMessage(page)).toHaveCount(0);
    });

    test('A Rejected Hub Token Is Not Reported As An Outage', async ({ page }) => {
      const warnings: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'warning' && msg.text().startsWith('Alloy hub rejected the token')) {
          warnings.push(msg.text());
        }
      });
      await page.route('**/hubs/engine/negotiate**', (route) =>
        route.fulfill({ status: 401, body: '' })
      );

      // 1. Open Administration, which connects to the hub
      await authenticateWithKeycloak(page, Services.Alloy.UI);
      await applyAlloyTheme(page, theme);
      await page.goto(`${Services.Alloy.UI}/admin`);
      await expect(page.getByRole('table')).toBeVisible();

      // expect: the refusal is logged, but the user is not told the API is unreachable
      await expect.poll(() => warnings.length).toBeGreaterThanOrEqual(1);
      await expect(systemMessage(page)).toHaveCount(0);
    });

    test('A Caster Directory List That Cannot Load Says So', async ({ page }) => {
      const reason = 'Could not load the Caster directories. Caster could not be reached.';
      await page.route('**/api/directories', (route) => route.fulfill(problem(502, reason)));

      await authenticateWithKeycloak(page, Services.Alloy.UI);
      await applyAlloyTheme(page, theme);
      await page.goto(`${Services.Alloy.UI}/admin`);
      await expect(page.getByRole('table')).toBeVisible();
      const templateName = `ZZ Directory Load Failure ${Date.now()}`;
      seededTemplateId = await createTemplate(page, templateName);

      // 1. Open the template for editing
      await page.getByRole('button', { name: `Edit: ${templateName}` }).click();
      const dialog = page.getByRole('dialog', { name: 'Edit Event Template' });
      await expect(dialog).toBeVisible();

      // expect: the Caster Directory field says why it has nothing to offer, instead of an
      // empty list that looks like there are no directories
      await expect(dialog.getByRole('alert').filter({ hasText: reason })).toBeVisible();

      // expect: the lists that did load have no warning
      await expect(dialog.getByRole('alert')).toHaveCount(1);
      await expect(systemMessage(page)).toHaveCount(0);

      await dialog.getByRole('button', { name: 'Cancel' }).first().click();
    });
  });
}
