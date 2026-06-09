import { test, expect } from '@playwright/test';

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
    await page.goto('http://localhost:8081');

    // Login via Keycloak OAuth
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.getByLabel('Username or email').fill('admin');
    await page.getByLabel('Password').fill('admin');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for dashboard
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
    // TODO: Implement
    // Test scenario:
    // - Question worth 1 point with penalty 0.1
    // - Try 1: Wrong answer → Check → Expect 0.00/1.00
    // - Try 2: Wrong answer → Check → Expect 0.00/1.00
    // - Try 3: Correct answer → Check → Expect 0.80/1.00
    //
    // Steps:
    // 1. Navigate to Test Course
    // 2. Access TopoMojo activity (or create one with known workspace)
    // 3. Launch Lab
    // 4. Wait for questions to load
    // 5. For first question:
    //    a. Fill wrong answer (e.g., "list")
    //    b. Click Check button
    //    c. Verify mark shows "Mark 0.00 out of 1.00"
    //    d. Fill wrong answer again (e.g., "dir")
    //    e. Click Check button
    //    f. Verify mark still shows "Mark 0.00 out of 1.00"
    //    g. Fill correct answer (e.g., "ls")
    //    h. Click Check button
    //    i. Verify mark shows "Mark 0.80 out of 1.00"
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
