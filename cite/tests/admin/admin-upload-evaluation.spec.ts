// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation } from '../../fixtures';
import { navigateToAdminSection, waitForAdminListLoad, deleteEvaluationByName } from '../../test-helpers';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

test.describe('Administration - Evaluations', () => {

  const UPLOADED_EVAL_NAME = `Uploaded Eval ${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  let tempFilePath: string;
  let seedData: { scoringModelId: string; evaluationId: string; teamTypeId: string } | null = null;
  let evalName = '';

  test('Upload Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Seed an evaluation via API to get a valid download
    evalName = `Upload Test ${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    seedData = await seedCompleteEvaluation(evalName, 0);

    // 2. Navigate to the evaluations list and download the seeded evaluation
    await navigateToAdminSection(page, 'Evaluations');
    await waitForAdminListLoad(page, '/api/evaluations', true);

    // Search for the evaluation
    const searchBox = page.locator('input[placeholder="Search"], input[type="search"], input[aria-label="Search"]').first();
    await expect(searchBox).toBeVisible({ timeout: 5000 });
    await searchBox.clear();
    await searchBox.fill(evalName);
    await page.waitForTimeout(1000);

    const evalRow = page.locator('tbody tr').filter({ hasText: evalName }).first();
    await expect(evalRow).toBeVisible({ timeout: 10000 });

    // 3. Download the evaluation
    const downloadButton = evalRow.locator(`button[title*="Download"]`);
    await expect(downloadButton).toBeVisible({ timeout: 5000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await downloadButton.click();
    const download = await downloadPromise;

    // 4. Save the downloaded file and modify its description for re-upload
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const jsonContent = fs.readFileSync(downloadPath!, 'utf-8');
    const evalData = JSON.parse(jsonContent);

    // Modify the description field (C# uses PascalCase)
    evalData.Description = UPLOADED_EVAL_NAME;

    tempFilePath = path.join(os.tmpdir(), `test-upload-${Date.now()}.json`);
    fs.writeFileSync(tempFilePath, JSON.stringify(evalData));

    // 5. Upload the modified evaluation JSON
    const uploadButton = page.getByRole('button', { name: 'Upload Evaluation' });
    await expect(uploadButton).toBeVisible({ timeout: 10000 });

    // Set the file directly on the hidden file input element
    const fileInput = page.locator('input[type="file"][accept=".json"]');
    await fileInput.setInputFiles(tempFilePath);

    // Wait for the upload to complete
    await page.waitForTimeout(2000);

    // 6. Verify the uploaded evaluation appears in the list
    await searchBox.clear();
    await searchBox.fill(UPLOADED_EVAL_NAME);
    await page.waitForTimeout(1000);

    const uploadedRow = page.locator('tbody tr').filter({ hasText: UPLOADED_EVAL_NAME }).first();
    await expect(uploadedRow).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    // Clean up the original seeded evaluation via API
    if (seedData) {
      await cleanupCompleteEvaluation(seedData);
      seedData = null;
    }
    // Clean up the uploaded evaluation via UI
    await deleteEvaluationByName(page, UPLOADED_EVAL_NAME);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  });
});
