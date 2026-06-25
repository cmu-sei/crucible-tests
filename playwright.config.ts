// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { defineConfig, devices } from '@playwright/test';
import { loadCrucibleEnv } from './load-env';

// Load environment based on CRUCIBLE_TARGET (aspire | minikube). Defaults to .env.
loadCrucibleEnv();

/**
 * Playwright configuration for Crucible applications
 * Supports testing multiple applications: Blueprint, Player, CITE, Gameboard, TopoMojo, Steamfitter, Moodle, etc.
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './',
  testMatch: '**/tests/**/*.spec.ts',

  // Authenticate provisioned apps (currently cite) once before the suite and save
  // their browser storageState to .auth/<app>.json. Consuming apps load that state
  // via their fixtures so per-test runs skip the full Keycloak redirect. See
  // global-setup.ts. Note: no global `use.storageState` here on purpose — that would
  // leak one app's auth into every other app's tests; consumption is opted into
  // per-app in each app's fixtures.ts.
  globalSetup: require.resolve('./global-setup'),

  // Maximum time one test can run for (includes auth redirect which can take up to 3 min)
  timeout: 300000,

  // Test timeout for each assertion
  expect: {
    timeout: 10000,
  },

  // Run tests in files in parallel
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI (2x) and locally (1x) to handle transient auth/timing issues
  retries: process.env.CI ? 2 : 1,

  // Opt out of parallel tests on CI; cap local workers to reduce resource pressure
  workers: process.env.CI ? 1 : 2,

  // Reporter to use
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL read from .env (defaults to Blueprint UI)
    baseURL: process.env.BLUEPRINT_UI_URL || 'http://localhost:4725',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Ignore HTTPS errors (for self-signed Keycloak certificate)
    ignoreHTTPSErrors: true,

    // Browser context options
    viewport: { width: 1920, height: 1080 },

    // Action timeout
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Accept downloads
        acceptDownloads: true,
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        acceptDownloads: true,
      },
    },

    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //     acceptDownloads: true,
    //   },
    // },

    // Test against mobile viewports
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    // Test against branded browsers
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  // Run your local dev server before starting the tests
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:4725',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  // },
});
