// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';

export async function authenticatePlayerVmWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  // Authenticate against Player UI, not the VM UI: the VM UI has no route that
  // works without a view id (its root renders "View Not Found"), so there is
  // nothing there to land on. The Keycloak SSO session carries over to the
  // Player VM UI on the next navigation, which is what lets a spec go straight
  // to `/views/{seededViewId}/...`.
  await authenticateWithKeycloak(page, Services.Player.UI, username, password);
}

// There is deliberately no "find me a view/VM in this environment" helper here.
// Discovery made every VM-facing spec conditional — no views meant a self-skip
// that reported green — and it made assertions depend on what the discovered
// record happened to contain. Specs seed what they need instead: see
// `vm-helpers.ts` (`seedView`, `seedViewWithVm`).

export type PlayerVmFixtures = {
  playerVmAuthenticatedPage: Page;
};

export const test = base.extend<PlayerVmFixtures>({
  playerVmAuthenticatedPage: async ({ page }, use) => {
    await authenticatePlayerVmWithKeycloak(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services };
