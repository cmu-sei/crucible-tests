// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { expect, type Locator, type Page } from '@playwright/test';
import { gotoAdminSection } from '../../fixtures';

/**
 * Shared navigation and row-reading helpers for the specs that exercise the admin
 * Exhibit Teams panel with deliberately null-valued teams.
 *
 * Not a spec file — `playwright.config.ts` only discovers `**\/tests\/**\/*.spec.ts`, so
 * this module is imported, never collected.
 */

/**
 * Open an exhibit's "Exhibit Teams" panel and return the panel's region locator.
 *
 * The click path is the one documented in `view-exhibit-teams.spec.ts`: the teams are
 * not a top-level admin section but live inside the exhibit row's expanded detail
 * (`admin-exhibits.component.html`), so a collection must be selected before the
 * exhibits table renders at all, the exhibit row must be clicked to expand it
 * (`toggleExpand`, which is also what triggers `teamDataService.loadByExhibitId`), and
 * only then can the "Exhibit Teams" sub-panel be expanded.
 *
 * Assumes the caller has already reached the admin area (`gotoGalleryAdmin`).
 */
export async function openExhibitTeamsPanel(
  page: Page,
  collectionName: string,
  exhibitName: string
): Promise<Locator> {
  await gotoAdminSection(page, 'Exhibits');

  const collectionDropdown = page.getByRole('combobox', { name: 'Select a Collection' });
  await collectionDropdown.click();
  const option = page.getByRole('option', { name: collectionName, exact: true });
  await expect(option).toBeVisible();
  await option.click();

  const exhibitRow = page.getByRole('row').filter({ hasText: exhibitName }).first();
  await expect(exhibitRow).toBeVisible();
  await exhibitRow.getByRole('cell', { name: exhibitName }).click();

  const exhibitTeamsHeader = page.getByRole('button', { name: 'Exhibit Teams' });
  await expect(exhibitTeamsHeader).toBeVisible();
  await exhibitTeamsHeader.click();

  const teamsRegion = page.getByRole('region', { name: 'Exhibit Teams' });
  await expect(teamsRegion).toBeVisible();
  return teamsRegion;
}

/**
 * The Short Name column of every team row, in render order.
 *
 * `admin-teams.component.html` builds each row as a `mat-expansion-panel-header`
 * containing `.cell.one-cell` (shortName), `.cell.two-cell` (email) and
 * `.cell.five-cell` (name). The column headers use `.header-cell`, not `.cell`, so
 * these selectors pick up data rows only. A row whose value is null renders as an empty
 * cell rather than being omitted, which is what makes `toHaveText([...])` able to
 * distinguish "row present with a null value" from "row missing".
 */
export function teamRowShortNames(teamsRegion: Locator): Locator {
  return teamsRegion.locator('mat-expansion-panel-header .cell.one-cell');
}

/** The Full Name column of every team row, in render order. See `teamRowShortNames`. */
export function teamRowFullNames(teamsRegion: Locator): Locator {
  return teamsRegion.locator('mat-expansion-panel-header .cell.five-cell');
}
