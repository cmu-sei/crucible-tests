// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test, expect, CITE_THEMES, setCiteTheme } from '../fixtures';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Test group`, () => {
    test('seed', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // generate code here.
    });
  });
}
