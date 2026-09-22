// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

/**
 * local_tagmanager's bulk import and export of tags, driven through the pages it
 * adds them to.
 *
 * The plugin has no pages of its own in the navigation: it hooks
 * `before_footer_html_generation` on `/tag/manage.php` and injects its controls
 * from JavaScript, so the import and export icons only exist once the AMD module
 * has run. That is exactly the part its PHPUnit suite cannot reach — those tests
 * cover the capability, the form class, the language strings and the template in
 * isolation, and never load the page they are injected into.
 *
 * Everything runs in a tag collection created for the test and deleted in
 * teardown, so the site's own collections and tags are left alone.
 */

import { Page } from '@playwright/test';
import { test, expect, Services } from '../fixtures';
import { runMoodlePhp } from '../cli-helpers';

/** Tags seeded into the collection, with the descriptions the export should carry. */
const SEEDED_TAGS = [
  { name: 'e2e-alpha', description: 'First seeded tag' },
  { name: 'e2e-beta', description: 'Second seeded tag' },
];

/** Strings the plugin's language file defines for the controls under test. */
const STRINGS = {
  exportSelected: 'Export selected',
  exportSelectedNone: 'Please select at least one tag to export.',
  importStandard: 'Import standard tags',
};

/**
 * Creates a tag collection holding the seeded tags and returns its id.
 *
 * Core's own API is used rather than an INSERT, so the collection is registered in
 * the tag cache the manage page reads from.
 */
function seedCollection(name: string): number {
  const rows = SEEDED_TAGS
    .map(tag => `['${tag.name}', '${tag.description}']`)
    .join(', ');

  const output = runMoodlePhp(
    `$coll = \\core_tag_collection::create(['name' => '${name}']);`
    + ` foreach ([${rows}] as [$tagname, $description]) {`
    + `   $created = \\core_tag_tag::create_if_missing($coll->id, [$tagname]);`
    + `   $tag = reset($created);`
    + `   $DB->set_field('tag', 'description', $description, ['id' => $tag->id]);`
    + ` }`
    + ` echo $coll->id;`
  );

  const collectionId = Number(output);
  if (!Number.isInteger(collectionId) || collectionId <= 0) {
    throw new Error(`Expected a tag collection id, got: ${output}`);
  }
  return collectionId;
}

/** Deletes the collection and every tag in it. */
function deleteCollection(collectionId: number): void {
  runMoodlePhp(`\\core_tag_collection::delete(${collectionId});`);
}

/** Reads a tag's description straight from the database. */
function tagDescription(collectionId: number, name: string): string {
  return runMoodlePhp(
    `$tag = $DB->get_record('tag', ['tagcollid' => ${collectionId}, 'name' => '${name}']);`
    + ` echo $tag ? (string) $tag->description : '<missing>';`
  );
}

/** The row of the collections table for one collection, by name. */
function collectionRow(page: Page, name: string) {
  return page.locator('.tag-collections-table tbody tr').filter({ hasText: name });
}

/**
 * Downloads whatever a click starts and returns it as text.
 *
 * `export.php` streams a CSV with a Content-Disposition attachment header, so the
 * browser never navigates and the body is only reachable through the download.
 */
/**
 * Splits CSV text into rows of fields.
 *
 * `fputcsv()` quotes any field holding whitespace, so comparing raw lines would
 * make the assertions depend on which values happen to need quoting.
 */
function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map(line =>
      (line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || [])
        .filter((field, index, fields) => index < fields.length - 1 || field !== '')
        .map(field => field.replace(/,$/, '').replace(/^"(.*)"$/s, '$1').replace(/""/g, '"'))
    );
}

async function downloadText(page: Page, start: () => Promise<void>): Promise<string> {
  const [download] = await Promise.all([page.waitForEvent('download'), start()]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Uploads a CSV through a Moodle filepicker.
 *
 * The form element is a filepicker rather than a plain file input: the file goes
 * to a draft file area through the repository modal, and only then does the form
 * hold anything to submit.
 */
async function uploadCsvToFilepicker(page: Page, csv: string, filename: string): Promise<void> {
  await page.getByRole('button', { name: /Choose a file/i }).first().click();

  const picker = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'File picker' }) });
  await expect(picker).toBeVisible();

  // The picker opens on whichever repository was used last, and only the "Upload a
  // file" repository has a file input to hand a buffer to.
  await picker.getByRole('link', { name: 'Upload a file' }).click();

  const fileInput = picker.locator('input[type="file"]').first();
  await expect(fileInput).toBeAttached();
  await fileInput.setInputFiles({
    name: filename,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });

  await picker.getByRole('button', { name: /Upload this file/i }).click();

  // The picker replaces its "choose" button with the file name once the draft area
  // has the file, which is what makes the form worth submitting.
  await expect(page.locator('.filepicker-filename, .fp-filename').first()).toContainText(filename);
}

test.describe('local_tagmanager bulk tag import and export', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = `${Date.now()}`;
  const collectionName = `E2E Tag Manager ${suffix}`;
  let collectionId: number;

  test.beforeAll(async () => {
    collectionId = seedCollection(collectionName);
  });

  test.afterAll(async () => {
    if (collectionId) {
      deleteCollection(collectionId);
    }
  });

  test('the manage tags page offers import and export actions for each collection', async ({
    moodleAdminPage: page,
  }) => {
    await page.goto(`${Services.Moodle}/tag/manage.php`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const row = collectionRow(page, collectionName);
    await expect(row, 'the seeded collection should be listed').toHaveCount(1);

    // Injected by the AMD module after the page has loaded, so these are also the
    // assertion that the hook fired and the module ran.
    const importLink = row.locator('a.import-collection');
    await expect(importLink).toHaveAttribute('href', new RegExp(`/local/tagmanager/import\\.php\\?tc=${collectionId}$`));
    await expect(importLink).toHaveAttribute('title', 'Import tags');

    const exportLink = row.locator('a.export-collection');
    await expect(exportLink).toHaveAttribute(
      'href',
      new RegExp(`/local/tagmanager/export\\.php\\?tc=${collectionId}&sesskey=\\w+$`)
    );
    // `export.php` calls require_sesskey(), so a link without one would 404 the
    // feature for every user.
    await expect(exportLink).toHaveAttribute('title', 'Export');
  });

  test('exporting a collection downloads every tag in it', async ({ moodleAdminPage: page }) => {
    await page.goto(`${Services.Moodle}/tag/manage.php`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const exportLink = collectionRow(page, collectionName).locator('a.export-collection');
    await expect(exportLink).toBeVisible();

    const rows = parseCsv(await downloadText(page, () => exportLink.click()));

    expect(rows[0], 'the export should be headed tagname,description').toEqual(['tagname', 'description']);
    for (const tag of SEEDED_TAGS) {
      expect(rows, `the export should carry ${tag.name} and its description`).toContainEqual([
        tag.name,
        tag.description,
      ]);
    }
    expect(rows, 'the export should hold the collection and nothing else').toHaveLength(SEEDED_TAGS.length + 1);
  });

  test('exporting without a session key is refused', async ({ moodleAdminPage: page }) => {
    await page.goto(`${Services.Moodle}/local/tagmanager/export.php?tc=${collectionId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // A missing sesskey has to fail as a request, not stream the collection to
    // whatever page linked here. Either message is a refusal: the parameter is
    // required before it can be compared against the session's key.
    await expect(page.locator('body')).toContainText(
      /A required parameter \(sesskey\) was missing|Invalid session key/i
    );
  });

  test('importing a CSV creates the tags it lists, with their descriptions', async ({
    moodleAdminPage: page,
  }) => {
    const imported = `e2e-imported-${suffix}`;
    const csv = `tagname,description\n${imported},Imported by the e2e suite\n${SEEDED_TAGS[0].name},Already here\n`;

    await page.goto(`${Services.Moodle}/local/tagmanager/import.php?tc=${collectionId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await expect(page.getByRole('heading', { name: 'Import tags' }).first()).toBeVisible();

    await uploadCsvToFilepicker(page, csv, 'tags.csv');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
      // By name, not by label: the form's header carries the same string, so the
      // collapse toggle is also a button called "Upload Tag File".
      page.locator('[name="submitbutton"]').click(),
    ]);

    // The import redirects back to the collection, reporting what it did with each
    // row: the new tag created, the one that was already there left alone.
    await expect(page.locator('.notifysuccess, .alert-success')).toContainText(`Created tag: ${imported}`);
    await expect(page.locator('.notifywarning, .alert-warning')).toContainText(
      `Tag already exists: ${SEEDED_TAGS[0].name}`
    );

    expect(tagDescription(collectionId, imported)).toBe('Imported by the e2e suite');
    // The description of a tag that already existed is not overwritten by the row
    // that named it.
    expect(tagDescription(collectionId, SEEDED_TAGS[0].name)).toBe(SEEDED_TAGS[0].description);
  });

  test('the collection page exports only the tags that are selected', async ({ moodleAdminPage: page }) => {
    await page.goto(`${Services.Moodle}/tag/manage.php?tc=${collectionId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    const exportSelected = page.locator('.local-tagmanager-exportselected');
    await expect(exportSelected).toHaveText(STRINGS.exportSelected);
    await expect(page.locator('.local-tagmanager-importstandard')).toContainText(STRINGS.importStandard);

    // Nothing selected: the button has to say so rather than export the lot.
    await exportSelected.click();
    await expect(page.locator('[data-region="notification"], .alert')).toContainText(STRINGS.exportSelectedNone);

    const row = page.locator('table tbody tr').filter({ hasText: SEEDED_TAGS[1].name }).first();
    await row.locator('input[type="checkbox"]').first().check();

    const rows = parseCsv(await downloadText(page, () => exportSelected.click()));

    expect(rows[0]).toEqual(['tagname', 'description']);
    expect(rows).toContainEqual([SEEDED_TAGS[1].name, SEEDED_TAGS[1].description]);
    expect(rows, 'an unselected tag should not be in the export').not.toContainEqual([
      SEEDED_TAGS[0].name,
      SEEDED_TAGS[0].description,
    ]);
  });
});
