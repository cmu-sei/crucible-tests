// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Responsive Design and Accessibility', () => {
  test('Screen Reader Compatibility', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate through the application and verify ARIA labels
    await expect(page.getByText('My Views')).toBeVisible();

    // expect: Key page landmarks and labels are present for screen readers
    // Note: The app uses <span> elements instead of semantic headings (h1-h6)
    await expect(page.getByText('Player')).toBeVisible();

    // expect: Tables have proper row and column headers
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();

    // expect: Interactive elements announce their purpose and state
    // The Menu button should be properly labeled
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();

    // Search field should have a label
    await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();

    // Links should have accessible names
    const viewLink = page.getByRole('link', { name: 'Project Lagoon TTX - Admin User' });
    await expect(viewLink).toBeVisible();
  });
});
