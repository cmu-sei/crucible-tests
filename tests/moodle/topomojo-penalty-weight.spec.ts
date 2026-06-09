import { test, expect } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../../shared-fixtures';

/**
 * TopoMojo Penalty & Weight Verification Tests
 *
 * Purpose: Verify that penalty and weight values from TopoMojo challenge JSON
 * are correctly imported into Moodle questions and applied during quiz grading.
 *
 * Data Flow:
 * 1. TopoMojo Challenge JSON → questionmanager.php imports weight/penalty
 * 2. Moodle stores in mdl_question table (defaultmark, penalty fields)
 * 3. behaviour/mojomatch applies penalty during grading
 *
 * Formula: final_score = (correct_fraction - (penalty × previous_wrong_tries)) × defaultmark
 */

test.describe('TopoMojo Penalty & Weight Verification', () => {

  // Test workspace with known penalty/weight values
  const TEST_WORKSPACE_ID = '11d9f0cb5ad64e27982a181e116f48b8'; // Moodle Test Workspace - Variants

  test.beforeEach(async ({ page }) => {
    // Navigate to Moodle
    await page.goto(Services.Moodle);

    // Moodle shows its own login page - click "Log in" link
    await page.getByRole('link', { name: 'Log in' }).click();

    // Moodle login page shows Keycloak OAuth option as clickable image
    // Click the Keycloak image/link to redirect to Keycloak
    await page.click('img[alt="Crucible Keycloak"]');

    // Now we're on Keycloak - fill login form
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button:has-text("Sign In"), input[type="submit"]');

    // Wait for redirect back to Moodle dashboard
    await expect(page).toHaveURL(/\/my\//);
  });

  test.skip('should import weight correctly from TopoMojo challenge', async ({ page }) => {
    // TODO: Implement
    // 1. Get question data from TopoMojo API (need auth)
    // 2. Create Moodle activity with TEST_WORKSPACE_ID
    // 3. Navigate to Questions page
    // 4. Verify mdl_question.defaultmark matches expected weight
    //
    // Expected behavior:
    // - Integer weight (1) → defaultmark = 1
    // - Decimal weight (0.5) → defaultmark = 5 (multiplied by 10)
    // - Zero/missing weight → defaultmark = 1 (fallback)
  });

  test.skip('should import penalty correctly from TopoMojo challenge', async ({ page }) => {
    // TODO: Implement
    // 1. Get question data from TopoMojo API
    // 2. Create Moodle activity with TEST_WORKSPACE_ID
    // 3. Navigate to Questions page → Edit question
    // 4. Verify "Penalty for each incorrect try" field matches TopoMojo penalty
    //
    // Expected behavior:
    // - TopoMojo penalty 0.1 → Moodle penalty 0.1 (10%)
    // - Missing penalty → defaults to 0.1
  });

  test.skip('should apply penalty cumulatively per wrong try', async ({ page }) => {
    // TODO: Moodle OAuth flow needs proper fixture - manual testing works but automated test is flaky
    // Navigate to Test Course
    await page.goto('http://localhost:8081/course/view.php?id=2');

    // Access existing TopoMojo activity "test"
    await page.getByRole('link', { name: 'test TopoMojo' }).click();
    await expect(page).toHaveURL(/\/mod\/topomojo\/view\.php\?id=2/);

    // Launch Lab
    await page.getByRole('button', { name: 'Launch Lab' }).click();

    // Wait for challenge page with questions
    await expect(page).toHaveURL(/\/mod\/topomojo\/challenge\.php/);
    await page.waitForSelector('.que.mojomatch', { timeout: 30000 });

    // Find first question
    const firstQuestion = page.locator('.que.mojomatch').first();
    const answerInput = firstQuestion.locator('input[type="text"]');
    const checkButton = firstQuestion.locator('input[type="submit"][name*="submit"]');

    // Try 1: Wrong answer
    await answerInput.fill('list');
    await checkButton.click();
    await page.waitForLoadState('networkidle');
    await expect(firstQuestion.locator('.grade')).toContainText('Mark 0.00 out of');

    // Try 2: Wrong answer again
    await answerInput.fill('dir');
    await checkButton.click();
    await page.waitForLoadState('networkidle');
    await expect(firstQuestion.locator('.grade')).toContainText('Mark 0.00 out of');

    // Try 3: Correct answer (assuming "ls" is correct)
    await answerInput.fill('ls');
    await checkButton.click();
    await page.waitForLoadState('networkidle');

    // Verify penalty applied: 1.0 - (0.1 × 2) = 0.80
    await expect(firstQuestion.locator('.grade')).toContainText('Mark 0.80 out of 1.00');
  });

  test.skip('should show Current Score correctly with penalties', async ({ page }) => {
    // TODO: Implement
    // Verify the "Current Score" box displays correct cumulative score
    // after checking questions with penalties applied
    //
    // Expected: Current Score shows sum of all penalized question scores
  });

  test.skip('should calculate final grade with penalties', async ({ page }) => {
    // TODO: Implement
    // Complete full attempt with penalties, submit quiz
    // Verify final grade on Review Attempts page matches expected calculation
  });

  test.skip('should handle different behavior modes', async ({ page }) => {
    // TODO: Implement
    // Test penalty application in:
    // - interactive (Check button per question)
    // - immediatefeedback (Check button per question)
    // - adaptive (similar to interactive)
    // - deferredfeedback (no Check buttons, no penalties)
  });
});

/**
 * Notes for Implementation:
 *
 * 1. TopoMojo API Integration:
 *    - Need to fetch challenge JSON to get expected weight/penalty
 *    - Requires TopoMojo auth token
 *    - API: GET /api/workspace/{workspaceId}/challenge
 *
 * 2. Database Verification:
 *    - Query mdl_question table after import
 *    - SELECT defaultmark, penalty FROM mdl_question WHERE qtype='mojomatch'
 *    - Requires DB access from Playwright (not available by default)
 *
 * 3. UI Selectors:
 *    - Question mark: text matching "Mark X.XX out of Y.YY"
 *    - Current Score box: alert with heading "Current Score"
 *    - Check button: input[type="submit"][name*="submit"]
 *
 * 4. Test Data Setup:
 *    - Create dedicated test workspace in TopoMojo
 *    - Known questions with specific weight/penalty values
 *    - Simple answers (no random transforms)
 *
 * See: /workspaces/crucible-development/TODO/topomojo-penalty-weight-verification.md
 */
