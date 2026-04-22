// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteEvaluationByName, createEvaluation } from '../../test-helpers';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

test.describe('Administration - Evaluations', () => {

  const TEST_EVAL_NAME = 'Test Evaluation For Upload';
  const UPLOADED_EVAL_NAME = 'Uploaded Evaluation Automation';
  let tempFilePath: string;

  test('Upload Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. First create and download an evaluation so we have a valid JSON file to upload
    await createEvaluation(page, TEST_EVAL_NAME);

    // 2. Navigate to the evaluations list and wait for the evaluation to appear
    await navigateToAdminSection(page, 'Evaluations');
    await page.waitForTimeout(2000);

    const evalRow = page.locator('tbody tr').filter({ hasText: TEST_EVAL_NAME }).first();
    await expect(evalRow).toBeVisible({ timeout: 15000 });

    const downloadButton = evalRow.locator(`button[title*="Download"]`);
    await expect(downloadButton).toBeVisible({ timeout: 5000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await downloadButton.click();
    const download = await downloadPromise;

    // 3. Save the downloaded file and modify its description for re-upload
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const jsonContent = fs.readFileSync(downloadPath!, 'utf-8');
    const evalData = JSON.parse(jsonContent);

    // Modify the description field (C# uses PascalCase)
    evalData.Description = UPLOADED_EVAL_NAME;

    tempFilePath = path.join(os.tmpdir(), 'test-upload-evaluation.json');
    fs.writeFileSync(tempFilePath, JSON.stringify(evalData));

    // 4. Upload the modified evaluation JSON
    await navigateToAdminSection(page, 'Evaluations');

    const uploadButton = page.getByRole('button', { name: 'Upload Evaluation' });
    await expect(uploadButton).toBeVisible({ timeout: 10000 });

    // Set up file chooser handler and wait for upload API call
    const fileChooserPromise = page.waitForEvent('filechooser');
    const uploadResponsePromise = page.waitForResponse(response =>
      response.url().includes('/api/evaluations/json') && response.request().method() === 'POST'
    );

    await uploadButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempFilePath);

    // Wait for the upload API call to complete
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status()).toBe(200);

    // 5. Verify the uploaded evaluation appears in the list
    await navigateToAdminSection(page, 'Evaluations');

    const uploadedRow = page.locator('tbody tr').filter({ hasText: UPLOADED_EVAL_NAME }).first();
    await expect(uploadedRow).toBeVisible({ timeout: 15000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteEvaluationByName(page, UPLOADED_EVAL_NAME);
    await deleteEvaluationByName(page, TEST_EVAL_NAME);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  });
});
