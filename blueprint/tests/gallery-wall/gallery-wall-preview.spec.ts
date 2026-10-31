// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// The Gallery Wall tab: a read-only preview of the wall Gallery shows a team at the end of a
// move, built from the field mapping the Gallery push uses (DataField.galleryArticleParameter,
// not field names). The mapping itself is unit-tested in blueprint.ui
// (src/app/utilities/gallery-wall.spec.ts); this spec covers the browser side: the tab
// appearing only when the MSEL uses Gallery, the Team and Move selectors, a card tile with its
// article count, the expanded article row, and the placeholder that flags a Gallery parameter
// no data field feeds.

import { test, expect, selectMatSelectOption, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  createTeam,
  createMove,
  createMselCard,
  createCardTeam,
  createMselDataField,
  createScenarioEvent,
  setScenarioEventFieldValue,
  navigateToMsel,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';

// Every Gallery parameter but Summary gets a field, so every article shows the Summary
// placeholder. The Description parameter is fed by a field named Body, and the field named
// Description carries no parameter: the wall must show Body's HTML, not Description's text.
const GALLERY_FIELDS = [
  { name: 'Title', dataType: 'String', galleryArticleParameter: 'Name' },
  { name: 'Body', dataType: 'Html', galleryArticleParameter: 'Description' },
  { name: 'Description', dataType: 'String' },
  { name: 'From Org', dataType: 'Organization', galleryArticleParameter: 'FromOrg' },
  { name: 'To Org', dataType: 'TeamsMultiple', galleryArticleParameter: 'ToOrg' },
  { name: 'Article Status', dataType: 'String', galleryArticleParameter: 'Status' },
  { name: 'Type', dataType: 'SourceType', galleryArticleParameter: 'SourceType' },
  { name: 'Source', dataType: 'String', galleryArticleParameter: 'SourceName' },
  { name: 'Simulated Time', dataType: 'DateTime', galleryArticleParameter: 'DatePosted' },
  { name: 'Card', dataType: 'Card', galleryArticleParameter: 'CardId' },
];

for (const theme of BLUEPRINT_THEMES) {
  test.describe(`${theme} theme › MSEL - Gallery Wall`, () => {
    let token: string;
    let mselId: string | undefined;

    test.beforeEach(async () => {
      token = await getBlueprintToken();
    });

    test.afterEach(async () => {
      // The MSEL delete cascades to its teams, moves, cards, card teams, fields and events.
      if (mselId) await deleteMsel(token, mselId);
      mselId = undefined;
    });

    test('Gallery Wall Section Follows The Gallery Integration Flag', async ({
      blueprintAuthenticatedPage: page,
    }) => {
      await applyBlueprintTheme(page, theme);
      mselId = (await createMsel(token)).id;

      // expect: with Gallery off, the MSEL offers no Gallery Wall section.
      await navigateToMsel(page, mselId);
      const wallItem = page.locator('mat-list-item').filter({ hasText: 'Gallery Wall' });
      await expect(page.locator('mat-list-item').filter({ hasText: 'Exercise View' })).toBeVisible();
      await expect(wallItem).toHaveCount(0);

      // expect: once the MSEL uses Gallery, the section is listed right after Exercise View.
      await updateMsel(token, mselId, { useGallery: true });
      await navigateToMsel(page, mselId);
      await expect(wallItem).toBeVisible();
      const labels = await page.locator('mat-drawer mat-list mat-list-item').allInnerTexts();
      const trimmed = labels.map((l) => l.trim());
      expect(trimmed.indexOf('Gallery Wall')).toBe(trimmed.indexOf('Exercise View') + 1);
    });

    test('Previews A Team Wall At A Move And Flags An Unmapped Field', async ({
      blueprintAuthenticatedPage: page,
    }) => {
      await applyBlueprintTheme(page, theme);
      const msel = await createMsel(token);
      mselId = msel.id;
      await updateMsel(token, mselId, { useGallery: true });

      // A team, two moves, and one card that team sees on its wall.
      const team = await createTeam(token, mselId, { name: tempBlueprintName('WallTeam'), shortName: 'WALL' });
      await createMove(token, mselId, { moveNumber: 1, deltaSeconds: 0 });
      await createMove(token, mselId, { moveNumber: 2, deltaSeconds: 600 });
      const cardName = tempBlueprintName('WallCard');
      const card = await createMselCard(token, mselId, { name: cardName, description: 'Press coverage' });
      await createCardTeam(token, { cardId: card.id, teamId: team.id, isShownOnWall: true });

      // The fields must exist before the event: the event's DataValues are created with it.
      let displayOrder = 1;
      for (const field of GALLERY_FIELDS) {
        await createMselDataField(token, mselId, { ...field, displayOrder: displayOrder++ });
      }

      // One article in move 1 for every team, on the card; one in move 2 that is not released yet.
      const title = tempBlueprintName('Bank hit by ransomware');
      const released = await createScenarioEvent(token, mselId, { deltaSeconds: 0, integrationTarget: 'Gallery' });
      const laterTitle = tempBlueprintName('Later in move two');
      const later = await createScenarioEvent(token, mselId, { deltaSeconds: 600, integrationTarget: 'Gallery' });
      for (const [eventId, eventTitle] of [[released.id, title], [later.id, laterTitle]] as const) {
        await setScenarioEventFieldValue(token, eventId, 'Title', eventTitle);
        await setScenarioEventFieldValue(token, eventId, 'Body', '<p>Details <b>inside</b></p>');
        await setScenarioEventFieldValue(token, eventId, 'Description', 'not the article description');
        await setScenarioEventFieldValue(token, eventId, 'From Org', 'CC News');
        await setScenarioEventFieldValue(token, eventId, 'To Org', 'ALL');
        await setScenarioEventFieldValue(token, eventId, 'Article Status', 'Green');
        await setScenarioEventFieldValue(token, eventId, 'Type', 'News');
        await setScenarioEventFieldValue(token, eventId, 'Source', 'CC News Desk');
        await setScenarioEventFieldValue(token, eventId, 'Simulated Time', '2026-10-01T12:00:00Z');
        await setScenarioEventFieldValue(token, eventId, 'Card', card.id);
      }

      await navigateToMselSection(page, mselId, 'Gallery Wall');
      await expect(page.getByRole('heading', { name: 'Gallery Wall' })).toBeVisible();

      // 1. Choose the team and the first move explicitly.
      await selectMatSelectOption(
        page,
        page.getByRole('combobox', { name: 'Team' }),
        page.getByRole('option', { name: `WALL - ${team.name}` })
      );
      await selectMatSelectOption(
        page,
        page.getByRole('combobox', { name: 'Move' }),
        page.getByRole('option', { name: '1 - Move 1' })
      );

      // expect: the card is a tile counting the one article released by move 1, and the header
      // counts it as an article with a field the push cannot fill (no Summary field).
      const tile = page.getByRole('button', { name: `Card ${cardName}, 1 article` });
      await expect(tile).toBeVisible();
      await expect(tile).toContainText('Press coverage');
      await expect(page.getByRole('status')).toHaveText('1 of 1 article has fields the Gallery push cannot fill');

      // 2. Expanding the tile lists the article as Gallery would show it.
      await tile.click();
      await expect(tile).toHaveAttribute('aria-expanded', 'true');
      const articles = page.getByRole('list', { name: `${cardName} articles` });
      const row = articles.getByRole('listitem').filter({ hasText: title });
      await expect(row).toHaveCount(1);
      await expect(row.getByRole('heading', { level: 4 })).toHaveText(title);
      await expect(row.getByTitle('Status: Green')).toHaveText('Green');
      await expect(row.locator('.article-orgs')).toContainText('CC News');
      await expect(row.locator('.article-orgs')).toContainText('ALL');
      await expect(row.locator('.article-source')).toContainText('News');
      await expect(row.locator('.article-source')).toContainText('CC News Desk');
      await expect(row.locator('.article-source')).toContainText('01 Oct 2026');
      await expect(row.getByText('Move 1, Inject 0')).toBeVisible();
      // expect: the description comes from the Body field (the Gallery Description parameter),
      // rendered as HTML, not from the field that happens to be named Description.
      await expect(row.locator('.article-description b')).toHaveText('inside');
      await expect(row).not.toContainText('not the article description');
      // expect: the parameter with no data field shows its placeholder rather than a blank.
      await expect(row.getByText('— no Summary field —')).toBeVisible();
      // expect: the move-2 article is not released at move 1.
      await expect(page.getByText(laterTitle)).toHaveCount(0);

      // 3. Moving to move 2 releases the second article, newest first.
      await selectMatSelectOption(
        page,
        page.getByRole('combobox', { name: 'Move' }),
        page.getByRole('option', { name: '2 - Move 2' })
      );
      const tileAtMove2 = page.getByRole('button', { name: `Card ${cardName}, 2 articles` });
      await expect(tileAtMove2).toBeVisible();
      await expect(articles.getByRole('heading', { level: 4 })).toHaveText([laterTitle, title]);
      await expect(page.getByRole('status')).toHaveText('2 of 2 articles have fields the Gallery push cannot fill');
    });
  });
}
