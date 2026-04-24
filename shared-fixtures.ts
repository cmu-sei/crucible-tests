// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, expect as baseExpect, Page } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from the crucible-tests root
dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Shared fixtures for all Crucible applications
 * Provides common authentication helpers and service URL constants
 */

/**
 * Crucible service URLs
 * Values are read from the .env file at the root of crucible-tests.
 * Edit that file to change URLs for your environment.
 */
export const Services = {
  AspireDashboard: process.env.ASPIRE_DASHBOARD_URL || 'http://localhost:18888',
  Keycloak: process.env.KEYCLOAK_URL || 'https://localhost:8443',
  KeycloakRealm: process.env.KEYCLOAK_REALM_URL || 'https://localhost:8443/realms/crucible',
  Player: {
    UI: process.env.PLAYER_UI_URL || 'http://localhost:4301',
    API: process.env.PLAYER_API_URL || 'http://localhost:4302',
  },
  PlayerVM: {
    UI: process.env.PLAYERVM_UI_URL || 'http://localhost:4303',
    API: process.env.PLAYERVM_API_URL || 'http://localhost:4304',
  },
  Console: {
    UI: process.env.CONSOLE_UI_URL || 'http://localhost:4305',
  },
  Caster: {
    UI: process.env.CASTER_UI_URL || 'http://localhost:4310',
    API: process.env.CASTER_API_URL || 'http://localhost:4311',
  },
  Alloy: {
    UI: process.env.ALLOY_UI_URL || 'http://localhost:4403',
    API: process.env.ALLOY_API_URL || 'http://localhost:4402',
  },
  TopoMojo: {
    UI: process.env.TOPOMOJO_UI_URL || 'http://localhost:4201',
    API: process.env.TOPOMOJO_API_URL || 'http://localhost:5000',
  },
  Steamfitter: {
    UI: process.env.STEAMFITTER_UI_URL || 'http://localhost:4401',
    API: process.env.STEAMFITTER_API_URL || 'http://localhost:4400',
  },
  Cite: {
    UI: process.env.CITE_UI_URL || 'http://localhost:4721',
    API: process.env.CITE_API_URL || 'http://localhost:4720',
  },
  Gallery: {
    UI: process.env.GALLERY_UI_URL || 'http://localhost:4723',
    API: process.env.GALLERY_API_URL || 'http://localhost:4722',
  },
  Blueprint: {
    UI: process.env.BLUEPRINT_UI_URL || 'http://localhost:4725',
    API: process.env.BLUEPRINT_API_URL || 'http://localhost:4724',
  },
  Gameboard: {
    UI: process.env.GAMEBOARD_UI_URL || 'http://localhost:4202',
    API: process.env.GAMEBOARD_API_URL || 'http://localhost:4203',
  },
  Moodle: process.env.MOODLE_URL || 'http://localhost:8081',
  Lrsql: process.env.LRSQL_URL || 'http://localhost:9274',
  Misp: process.env.MISP_URL || 'https://localhost:8444',
};

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
  const keycloakHost = new URL(Services.Keycloak).host;
  const currentUrl = page.url();
  const isOnKeycloak = currentUrl.includes(keycloakHost) || currentUrl.includes('/realms/crucible');

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
        if (url.includes(keycloakHost) || url.includes('/realms/crucible')) {
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
        console.log(`App content appeared - checking if OIDC will redirect...`);
        // App content is visible, but the Angular OIDC client may still be initializing.
        // Wait to see if it redirects to Keycloak (this happens if there's no valid token).
        // We'll wait for up to 15 seconds for either:
        // 1. A redirect to Keycloak to start (URL changes to include :8443 or /realms/crucible)
        // 2. The wait to timeout (meaning we're stable and authenticated)
        try {
          await page.waitForURL((url) => url.toString().includes(':8443') || url.toString().includes('/realms/crucible'), {
            timeout: 15000
          });
          console.log(`OIDC initiated redirect to Keycloak after app content appeared`);
          // Now wait for Keycloak login form
          await keycloakField.waitFor({ state: 'visible', timeout: 30000 });
          await keycloakLogin();
        } catch {
          // No redirect happened - we're already authenticated
          console.log(`No redirect occurred - already authenticated`);
        }
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

  // After Keycloak login, Angular apps may redirect to /auth-callback then back to the main page.
  // Wait for this to complete to ensure authentication is fully stabilized.
  const finalUrl = page.url();
  if (finalUrl.includes('/auth-callback')) {
    console.log(`On auth-callback page, waiting for redirect to complete...`);
    const appHost = new URL(appUrl).host;
    await page.waitForURL((url) => url.host === appHost && !url.pathname.includes('/auth-callback'), {
      timeout: 30000
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    console.log(`Auth callback redirect completed, now at ${page.url()}`);
  }

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
