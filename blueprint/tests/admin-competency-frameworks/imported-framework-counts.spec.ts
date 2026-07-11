// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: blueprint/blueprint-test-plan.md

import { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { test, expect, Services, oidcStorageKey } from '../../fixtures';

type ImportedFramework = {
  id: string;
  name: string;
};

type ImportedCompetency = {
  id: string;
  idNumber: string;
  shortName: string;
  description: string;
};

const OIDC_STORAGE_KEY = oidcStorageKey('blueprint.ui');

function apiUrl(path: string): string {
  return `${Services.Blueprint.API.replace(/\/$/, '')}${path}`;
}

function detailUrlRegex(frameworkId: string): RegExp {
  return new RegExp(`/api/competencyframeworks/${frameworkId}(?:\\?.*)?$`);
}

function isFrameworkDetailUrl(url: string, frameworkId: string): boolean {
  return detailUrlRegex(frameworkId).test(new URL(url).pathname);
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve: resolve! };
}

async function getAuthHeaders(page: Page): Promise<Record<string, string>> {
  const rawUser = await page.evaluate((key) => sessionStorage.getItem(key), OIDC_STORAGE_KEY);
  expect(rawUser).toBeTruthy();

  const user = JSON.parse(rawUser as string);
  expect(user.access_token).toBeTruthy();

  return {
    Authorization: `Bearer ${user.access_token}`,
  };
}

async function importFramework(
  page: Page,
  authHeaders: Record<string, string>,
  name: string,
  competencies: ImportedCompetency[]
): Promise<ImportedFramework> {
  const payload = {
    name,
    idNumber: `PW-${randomUUID()}`,
    description: `${name} imported by Playwright`,
    source: 'Playwright',
    version: randomUUID(),
    taxonomies: 'Category,Work Role,Task,Knowledge,Skill,Ability',
    competencies,
  };

  const response = await page.request.post(apiUrl('/api/competencyframeworks/import-json'), {
    headers: authHeaders,
    multipart: {
      file: {
        name: `${name}.json`,
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(payload)),
      },
    },
  });

  expect(response.ok()).toBeTruthy();
  return await response.json();
}

async function deleteFramework(
  page: Page,
  authHeaders: Record<string, string>,
  frameworkId: string
): Promise<void> {
  const response = await page.request.delete(apiUrl(`/api/competencyframeworks/${frameworkId}`), {
    headers: authHeaders,
  });

  expect([200, 204, 404]).toContain(response.status());
}

async function navigateToCompetencyFrameworks(page: Page): Promise<void> {
  await page.goto(`${Services.Blueprint.UI}/admin`);
  await page.waitForLoadState('networkidle');

  const competenciesNav = page.locator(
    'mat-list-item[title="Competency Frameworks"], mat-list-item:has-text("Competencies")'
  ).first();
  await expect(competenciesNav).toBeVisible({ timeout: 10000 });
  await competenciesNav.click();

  await expect(page.getByText('Competency Frameworks', { exact: true })).toBeVisible({ timeout: 10000 });
}

async function filterFrameworks(page: Page, prefix: string): Promise<void> {
  const search = page.locator('app-admin-competency-frameworks input[placeholder="Search"]').first();
  await expect(search).toBeVisible({ timeout: 10000 });
  await search.fill(prefix);
}

function frameworkRow(page: Page, name: string) {
  return page.locator('mat-row').filter({ hasText: name }).first();
}

test.describe('Admin - Competency Frameworks', () => {
  test('Imported framework counts clear while switching framework rows', async ({ blueprintAuthenticatedPage: page }) => {
    const authHeaders = await getAuthHeaders(page);
    const runId = Date.now();
    const namePrefix = `PW Count Regression ${runId}`;
    const firstName = `${namePrefix} A`;
    const secondName = `${namePrefix} B`;
    const frameworks: ImportedFramework[] = [];

    try {
      const first = await importFramework(page, authHeaders, firstName, [
        { id: randomUUID(), idNumber: 'WRL-PW-001', shortName: 'First Work Role One', description: 'First work role one' },
        { id: randomUUID(), idNumber: 'WRL-PW-002', shortName: 'First Work Role Two', description: 'First work role two' },
        { id: randomUUID(), idNumber: 'T0001', shortName: 'First Task', description: 'First task' },
        { id: randomUUID(), idNumber: 'K0001', shortName: 'First Knowledge', description: 'First knowledge' },
        { id: randomUUID(), idNumber: 'S0001', shortName: 'First Skill', description: 'First skill' },
      ]);
      frameworks.push(first);

      const second = await importFramework(page, authHeaders, secondName, [
        { id: randomUUID(), idNumber: 'WRL-PW-101', shortName: 'Second Work Role', description: 'Second work role' },
        { id: randomUUID(), idNumber: 'T0101', shortName: 'Second Task', description: 'Second task' },
      ]);
      frameworks.push(second);

      await navigateToCompetencyFrameworks(page);
      await filterFrameworks(page, namePrefix);

      const firstRow = frameworkRow(page, firstName);
      const secondRow = frameworkRow(page, secondName);
      await expect(firstRow).toBeVisible({ timeout: 10000 });
      await expect(secondRow).toBeVisible({ timeout: 10000 });

      const firstDetailResponse = page.waitForResponse((response) =>
        response.request().method() === 'GET' && isFrameworkDetailUrl(response.url(), first.id)
      );
      await firstRow.click();
      await firstDetailResponse;

      await expect(page.getByText(/Work Roles\s*\(2\)/)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/Competencies\s*\(3\)/)).toBeVisible({ timeout: 10000 });

      const delayedSecondResponse = deferred();
      const secondDetailPattern = detailUrlRegex(second.id);
      await page.route(secondDetailPattern, async (route) => {
        if (route.request().method() === 'GET') {
          await delayedSecondResponse.promise;
        }
        await route.continue();
      });

      await secondRow.click();

      await expect(page.getByText(/Work Roles\s*\(Loading\.\.\.\)/)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/Competencies\s*\(Loading\.\.\.\)/)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/Work Roles\s*\(2\)/)).not.toBeVisible();
      await expect(page.getByText(/Competencies\s*\(3\)/)).not.toBeVisible();

      const firstReloadResponse = page.waitForResponse((response) =>
        response.request().method() === 'GET' && isFrameworkDetailUrl(response.url(), first.id)
      );
      await firstRow.click();
      await firstReloadResponse;

      delayedSecondResponse.resolve();
      await page.waitForResponse((response) =>
        response.request().method() === 'GET' && isFrameworkDetailUrl(response.url(), second.id)
      );

      await expect(page.getByText(/Work Roles\s*\(2\)/)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/Competencies\s*\(3\)/)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/Work Roles\s*\(1\)/)).not.toBeVisible();

      await page.unroute(secondDetailPattern);
    } finally {
      for (const framework of frameworks.reverse()) {
        await deleteFramework(page, authHeaders, framework.id);
      }
    }
  });
});
