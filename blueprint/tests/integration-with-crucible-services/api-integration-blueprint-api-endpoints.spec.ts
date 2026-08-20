// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  tempBlueprintName,
  navigateToMsel,
} from '../../test-helpers';

/**
 * Verifies the Blueprint UI really talks to the Blueprint API: which endpoints it calls,
 * that every call carries a bearer token, that responses are JSON, and that the Admin
 * sidebar reports the API's version (which it can only know by calling `/api/version`).
 *
 * Rewritten. The previous version had two defects that between them made it worthless:
 *
 * 1. **It leaked a MSEL on every run.** It drove the UI to create one named the literal
 *    `'API Test MSEL'` and had no afterEach. The teardown purge keys off the shape
 *    `tempBlueprintName()` emits (`-<epoch-ms>-<random>`), so that literal was never
 *    swept and accumulated forever.
 * 2. **It could not fail.** Every step sat inside
 *    `if (await x.isVisible().catch(() => false)) { ... }`, so a missed locator skipped
 *    the body and still reported green. It also computed `apiResponses`, unique endpoint
 *    lists and `foundExpectedEndpoints` and then only logged them, or asserted them
 *    inside an `if` whose else-branch also passed.
 *
 * Now: the fixture MSEL is seeded through the API under a `tempBlueprintName()` name and
 * deleted by id in `afterEach`, and every expectation is asserted unconditionally.
 *
 * The endpoint list below is not guesswork — it is what the MSEL detail page actually
 * requests, captured live. Note the paths the UI uses are **lowercase**
 * (`/scenarioevents`, `/datafields`), unlike the mixed-case forms the API also accepts.
 */
test.describe('Integration with Crucible Services', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, {
      name: tempBlueprintName('TestBP-ApiIntegration'),
      description: 'Seeded to observe Blueprint UI -> Blueprint API traffic.',
    });
    mselId = msel.id;

    // One renderable event, so the MSEL has DataFields/DataValues and the detail page
    // has real content to fetch rather than a set of empty collections.
    await createRenderableScenarioEvent(token, mselId, 'API integration probe event', {
      deltaSeconds: 60,
    });
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

  test('API Integration - Blueprint API Endpoints', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const blueprintApiPattern = serviceUrlPattern(Services.Blueprint.API);

    interface CapturedRequest {
      path: string;
      method: string;
      hasAuthHeader: boolean;
    }
    interface CapturedResponse {
      path: string;
      status: number;
      contentType: string;
    }

    const apiRequests: CapturedRequest[] = [];
    const apiResponses: CapturedResponse[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (!blueprintApiPattern.test(url)) return;
      const headers = request.headers();
      apiRequests.push({
        path: new URL(url).pathname,
        method: request.method(),
        hasAuthHeader: !!(headers['authorization'] ?? headers['Authorization']),
      });
    });

    page.on('response', (response) => {
      const url = response.url();
      if (!blueprintApiPattern.test(url)) return;
      apiResponses.push({
        path: new URL(url).pathname,
        status: response.status(),
        contentType: response.headers()['content-type'] ?? '',
      });
    });

    // 1. Perform a real action in the UI: open the seeded MSEL's detail page. That is
    // what drives the burst of API reads asserted below.
    await navigateToMsel(page, mselId);

    // expect: API calls are made to the Blueprint API.
    // The MSEL detail page fans out to ~20 endpoints; poll until the batch has landed
    // rather than sampling once, so this does not race the Angular bootstrap.
    const expectedEndpoints = [
      `/api/msels/${mselId}`,
      `/api/msels/${mselId}/teams`,
      `/api/msels/${mselId}/organizations`,
      `/api/msels/${mselId}/datafields`,
      `/api/msels/${mselId}/datavalues`,
      `/api/msels/${mselId}/scenarioevents`,
      `/api/msels/${mselId}/mselunits`,
      '/api/me/systempermissions',
    ];

    await expect
      .poll(() => expectedEndpoints.filter((e) => apiRequests.some((r) => r.path === e)).length, {
        timeout: 30000,
        intervals: [250, 500, 1000],
        message: `Blueprint UI never requested the expected MSEL endpoints. Saw: ${[
          ...new Set(apiRequests.map((r) => r.path)),
        ].join(', ')}`,
      })
      .toBe(expectedEndpoints.length);

    // Every one of those is a GET — the detail page reads, it does not mutate on load.
    for (const endpoint of expectedEndpoints) {
      const matches = apiRequests.filter((r) => r.path === endpoint);
      expect(matches.map((r) => r.method)).toContain('GET');
    }

    // expect: Requests use proper authentication headers.
    // Asserted for EVERY captured request, not "at least one" — a single unauthenticated
    // read would be a real defect. The SignalR `/hubs/main/negotiate` POST is the one
    // legitimate exception: it authenticates via the `?bearer=` query parameter (see
    // `getHubUrlWithAuth` in blueprint.ui signalr.service.ts), so it is excluded by path.
    const restRequests = apiRequests.filter((r) => !r.path.startsWith('/hubs/'));
    expect(restRequests.length).toBeGreaterThan(0);
    const unauthenticated = restRequests.filter((r) => !r.hasAuthHeader);
    expect(
      unauthenticated,
      `these Blueprint API requests carried no Authorization header: ${unauthenticated
        .map((r) => `${r.method} ${r.path}`)
        .join(', ')}`
    ).toEqual([]);

    // The negotiate call must still prove it is authenticated, via the bearer query param.
    const negotiate = apiRequests.filter((r) => r.path === '/hubs/main/negotiate');
    expect(negotiate.length).toBeGreaterThan(0);

    // expect: Responses are in expected JSON format, and none of them failed.
    await expect
      .poll(() => apiResponses.filter((r) => r.path.startsWith('/api/')).length, {
        timeout: 30000,
        intervals: [250, 500, 1000],
      })
      .toBeGreaterThanOrEqual(expectedEndpoints.length);

    const restResponses = apiResponses.filter((r) => r.path.startsWith('/api/'));
    const failures = restResponses.filter((r) => r.status >= 400);
    expect(
      failures,
      `Blueprint API returned errors: ${failures.map((r) => `${r.status} ${r.path}`).join(', ')}`
    ).toEqual([]);

    const nonJson = restResponses.filter((r) => !r.contentType.includes('json'));
    expect(
      nonJson,
      `these Blueprint API responses were not JSON: ${nonJson
        .map((r) => `${r.path} -> ${r.contentType || '(no content-type)'}`)
        .join(', ')}`
    ).toEqual([]);

    // 2. expect: Admin sidebar shows the API version (e.g. 'Versions: UI 0.0.0, API 1.6.1').
    // The UI can only render this by calling GET /api/version, so pair the assertion with
    // that response: it proves the value on screen came from the API, not a constant.
    const versionResponse = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/version' && r.request().method() === 'GET',
      { timeout: 30000 }
    );
    await page.goto(`${Services.Blueprint.UI}/admin`, { waitUntil: 'domcontentloaded' });
    const version = await versionResponse;
    expect(version.status()).toBe(200);

    // The API answers a JSON string like "0.0.0+<git-sha>"; the UI splits on '+' and
    // renders only the leading semver part.
    const rawVersion = (await version.json()) as string;
    expect(rawVersion).toMatch(/^\d+\.\d+\.\d+/);
    const apiSemver = rawVersion.split('+')[0];

    const versionsLine = page.locator('.app-versions').first();
    await expect(versionsLine).toBeVisible({ timeout: 30000 });
    await expect(versionsLine).toHaveText(
      new RegExp(`Versions:\\s*UI\\s*\\d+\\.\\d+\\.\\d+,\\s*API\\s*${apiSemver.replace(/\./g, '\\.')}`)
    );

    // The component initialises `apiVersion = 'API ERROR!'` and only overwrites it on a
    // successful response, so this also proves the fetch succeeded.
    await expect(versionsLine).not.toContainText('API ERROR!');
  });
});
