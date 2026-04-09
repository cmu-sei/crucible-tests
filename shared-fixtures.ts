// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, expect as baseExpect, Page } from '@playwright/test';

/**
 * Shared fixtures for all Crucible applications
 * Provides common authentication helpers and service URL constants
 */

/**
 * Crucible service URLs
 */
export const Services = {
  AspireDashboard: 'http://localhost:18888',
  Keycloak: 'https://localhost:8443',
  KeycloakRealm: 'https://localhost:8443/realms/crucible',
  Player: {
    UI: 'http://localhost:4301',
    API: 'http://localhost:4302',
  },
  PlayerVM: {
    UI: 'http://localhost:4303',
    API: 'http://localhost:4304',
  },
  Console: {
    UI: 'http://localhost:4305',
  },
  Caster: {
    UI: 'http://localhost:4310',
    API: 'http://localhost:4311',
  },
  Alloy: {
    UI: 'http://localhost:4403',
    API: 'http://localhost:4402',
  },
  TopoMojo: {
    UI: 'http://localhost:4201',
    API: 'http://localhost:5000',
  },
  Steamfitter: {
    UI: 'http://localhost:4401',
    API: 'http://localhost:4400',
  },
  Cite: {
    UI: 'http://localhost:4721',
    API: 'http://localhost:4720',
  },
  Gallery: {
    UI: 'http://localhost:4723',
    API: 'http://localhost:4722',
  },
  Blueprint: {
    UI: 'http://localhost:4725',
    API: 'http://localhost:4724',
  },
  Gameboard: {
    UI: 'http://localhost:4202',
    API: 'http://localhost:4203',
  },
  Moodle: 'http://localhost:8081',
  Lrsql: 'http://localhost:9274',
  Misp: 'https://localhost:8444',
} as const;

/**
 * Generic Keycloak authentication helper
 * @param page - Playwright Page object
 * @param appUrl - The application URL to authenticate with
 * @param username - Keycloak username (default: 'admin')
 * @param password - Keycloak password (default: 'admin')
 */
export async function authenticateWithKeycloak(
  page: Page,
  appUrl: string,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  console.log(`Authenticating with Keycloak for ${appUrl}...`);

  // Helper to perform Keycloak login and wait for redirect back to app
  const keycloakLogin = async () => {
    console.log(`Keycloak login page detected, logging in...`);
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    try {
      await page.click('button:has-text("Sign In")', { timeout: 2000 });
    } catch {
      await page.click('input[type="submit"]');
    }
    // Wait for redirect back to the app
    const appHost = new URL(appUrl).host;
    await page.waitForURL((url) => url.host === appHost, { timeout: 30000 });
  };

  // Navigate to the app
  console.log(`Navigating to ${appUrl}...`);
  let response;
  try {
    response = await page.goto(appUrl, { timeout: 180000, waitUntil: 'domcontentloaded' });
    console.log(`Navigation response: ${response?.status()} - ${response?.url()}`);
    console.log(`Current URL after navigation: ${page.url()}`);
  } catch (navigationError: any) {
    console.error(`Navigation failed: ${navigationError.message}`);
    throw new Error(`Failed to navigate to ${appUrl}: ${navigationError.message}`);
  }

  // Check if we got redirected to Keycloak immediately
  // Keycloak URLs will contain 'localhost:8443' or the realm path
  const currentUrl = page.url();
  const isOnKeycloak = currentUrl.includes(':8443') || currentUrl.includes('/realms/crucible');

  if (isOnKeycloak) {
    console.log(`Redirected to Keycloak at ${currentUrl}`);
    // Wait for the Keycloak login form to appear (3 minutes timeout)
    await page.waitForSelector('input[name="username"]', { timeout: 180000 });
    await keycloakLogin();
  } else {
    // Still on app URL - wait for either:
    // 1. App content to appear (already authenticated)
    // 2. Redirect to Keycloak (needs authentication)
    console.log(`Still on app URL, waiting for content or Keycloak redirect...`);

    // Set up listeners for URL changes
    let redirectedToKeycloak = false;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        const url = frame.url();
        if (url.includes(':8443') || url.includes('/realms/crucible')) {
          console.log(`Detected redirect to Keycloak: ${url}`);
          redirectedToKeycloak = true;
        }
      }
    });

    // The Angular OIDC client may redirect to Keycloak asynchronously.
    // Race: wait for either the Keycloak username field OR the app to render content.
    const keycloakField = page.locator('input[name="username"]');
    const appContent = page.locator('app-root, [class*="topbar"], mat-toolbar, [class*="dashboard"], nav, header, [role="banner"], [role="navigation"]');

    try {
      // Wait up to 3 minutes for one of these to appear (apps can take time to redirect to Keycloak)
      const winner = await Promise.race([
        keycloakField.waitFor({ state: 'visible', timeout: 180000 }).then(() => 'keycloak' as const),
        appContent.first().waitFor({ state: 'visible', timeout: 180000 }).then(() => 'app' as const),
      ]);

      if (winner === 'keycloak') {
        console.log(`Keycloak login form appeared`);
        await keycloakLogin();
      } else {
        console.log(`App content appeared - already authenticated`);
      }
    } catch (error: any) {
      console.error(`Timeout waiting for Keycloak or app content. Current URL: ${page.url()}`);
      console.error(`Error: ${error.message}`);
      // Try to get page content for debugging
      const bodyText = await page.locator('body').textContent().catch(() => 'Could not get body text');
      console.error(`Page body (first 500 chars): ${bodyText?.substring(0, 500)}`);
      // Get page title
      const title = await page.title().catch(() => 'Could not get title');
      console.error(`Page title: ${title}`);
      // Check if there are any visible elements
      const visibleElements = await page.locator('body *').count().catch(() => 0);
      console.error(`Visible elements in body: ${visibleElements}`);

      throw new Error(
        `Timeout waiting for either Keycloak login page or app content at ${appUrl}. ` +
        `Current URL: ${page.url()}. The app may not be running or may have redirected to an unexpected page.`
      );
    }
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  console.log(`Successfully authenticated and returned to ${appUrl}`);
}

/**
 * Wait for Aspire services to be healthy
 * @param page - Playwright Page object
 * @param requiredServices - Array of service names to check (default: ['keycloak', 'postgres'])
 */
export async function waitForAspireServices(
  page: Page,
  requiredServices: string[] = ['keycloak', 'postgres']
): Promise<void> {
  // Navigate to Aspire dashboard
  await page.goto(Services.AspireDashboard);

  // Wait for dashboard to load
  await page.waitForSelector('[data-resource-name]', { timeout: 30000 });

  // Check that required services are running
  for (const service of requiredServices) {
    const serviceRow = page.locator(`[data-resource-name="${service}"]`);
    await baseExpect(serviceRow).toBeVisible({ timeout: 60000 });

    // Check for "Running" or "Healthy" state
    const stateCell = serviceRow.locator('[data-state]');
    await baseExpect(stateCell).toHaveAttribute('data-state', /Running|Healthy/i, { timeout: 60000 });
  }
}

/**
 * Check if a service is available at the specified URL
 * Useful for health checks before running tests
 * @param page - Playwright Page object
 * @param url - Service URL to check
 */
export async function checkServiceHealth(page: Page, url: string): Promise<boolean> {
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
    return response?.ok() || false;
  } catch {
    return false;
  }
}

/**
 * Extended test with common fixtures
 * Apps can import this and extend it further with app-specific fixtures
 */
export const test = base.extend({});

export { expect } from '@playwright/test';
