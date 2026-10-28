// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Top bar buttons open in a new tab on middle-click', async ({ topomojoAuthenticatedPage: page }) => {
    const ui = Services.TopoMojo.UI.replace(/\/$/, '');
    const navbar = page.locator('nav.navbar');

    for (const [name, path] of [['Home', '/'], ['About', '/about'], ['Admin', '/admin']] as const) {
      // expect: each page button is a real link
      const link = navbar.getByRole('link', { name, exact: true });
      await expect(link).toHaveAttribute('href', path);

      // expect: middle-click opens it in a new tab and leaves this tab where it was
      const before = page.url();
      const [tab] = await Promise.all([
        page.context().waitForEvent('page'),
        link.click({ button: 'middle' }),
      ]);
      await tab.waitForLoadState('domcontentloaded');
      await expect(tab).toHaveURL(`${ui}${path}`);
      expect(page.url()).toBe(before);
      await tab.close();
    }

    // expect: the theme toggle sits after Logout, at the right end of the bar
    const labels = await navbar.locator('div > a, div > button').evaluateAll(els =>
      els.map(e => e.textContent?.trim() || e.getAttribute('aria-label') || ''));
    expect(labels.slice(-2)[0]).toBe('Logout');
    expect(labels.slice(-1)[0]).toMatch(/Switch to (dark|light) theme/);
  });

  test('Middle-clicking Logout logs out from the new tab', async ({ topomojoAuthenticatedPage: page }) => {
    const logout = page.locator('nav.navbar').getByRole('link', { name: 'Logout' });
    await expect(logout).toHaveAttribute('href', '/logout');

    const [tab] = await Promise.all([
      page.context().waitForEvent('page'),
      logout.click({ button: 'middle' }),
    ]);

    // expect: the new tab leaves TopoMojo for the identity provider's logout, or lands home logged out
    await tab.waitForLoadState('domcontentloaded');
    await expect.poll(() => tab.url(), { timeout: 15000 })
      .not.toMatch(/\/logout$/);
    await tab.close();

    // expect: the session is gone, so the original tab shows the login landing page after a reload
    await page.goto(Services.TopoMojo.UI);
    await expect(page.getByRole('button', { name: 'identity provider' })).toBeVisible({ timeout: 15000 });
  });
});
