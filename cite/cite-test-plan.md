# CITE Application Test Plan

## Application Overview

CITE (Collaborative Incident Threat Evaluator) is a collaborative cyber incident evaluation and scoring application in the Crucible ecosystem. The application enables participants from different organizations to evaluate, score, and comment on cyber incidents. CITE provides a situational awareness dashboard that allows teams to track their internal actions and roles. Users can participate in evaluations, submit and modify scores, view team-based submissions, track progress through evaluation moves, and manage content through administrative functions. The application uses Keycloak for authentication, supports role-based permissions (SystemAdmin, ContentDeveloper, evaluation-level and team-level permissions), and includes real-time SignalR notifications for collaborative features. This test plan covers authentication flows, evaluation selection and participation, scoring workflows, team collaboration, move navigation, submission management, administrative functions, and comprehensive error handling scenarios.

## Test Scenarios

### 1. Authentication and Authorization

**Seed:** `tests/seed.setup.ts`

#### 1.1. Successful Authentication Flow

**File:** `tests/cite/authentication/successful-authentication.spec.ts`

**Steps:**
  1. Navigate to CITE UI at http://localhost:4721
    - expect: User is redirected to Keycloak login page at https://localhost:8443
  2. Enter valid username 'admin' in the username field
    - expect: Username field accepts input
  3. Enter valid password 'admin' in the password field
    - expect: Password field accepts input and masks the password
  4. Click the 'Sign In' button
    - expect: User is authenticated and redirected back to CITE UI at http://localhost:4721
    - expect: Home page displays with evaluation list
    - expect: User profile/menu is visible in top bar

#### 1.2. Failed Authentication - Invalid Credentials

**File:** `tests/cite/authentication/failed-authentication-invalid-credentials.spec.ts`

**Steps:**
  1. Navigate to CITE UI at http://localhost:4721
    - expect: User is redirected to Keycloak login page
  2. Enter invalid username 'wronguser' in the username field
    - expect: Username field accepts input
  3. Enter invalid password 'wrongpass' in the password field
    - expect: Password field accepts input
  4. Click the 'Sign In' button
    - expect: Authentication fails
    - expect: Error message is displayed indicating invalid credentials
    - expect: User remains on Keycloak login page

#### 1.3. Session Persistence After Refresh

**File:** `tests/cite/authentication/session-persistence.spec.ts`

**Steps:**
  1. Log in with valid credentials (admin/admin)
    - expect: User is successfully authenticated and viewing CITE home page
  2. Refresh the browser page
    - expect: User remains authenticated
    - expect: Home page loads without redirecting to Keycloak
    - expect: User session is maintained

#### 1.4. Logout Functionality

**File:** `tests/cite/authentication/logout.spec.ts`

**Steps:**
  1. Log in with valid credentials (admin/admin)
    - expect: User is successfully authenticated
  2. Click on user profile menu in top bar
    - expect: User menu dropdown opens
  3. Click 'Logout' or 'Sign Out' option
    - expect: User is logged out
    - expect: User is redirected to Keycloak or CITE home
    - expect: Authentication session is terminated
  4. Attempt to navigate to CITE UI again
    - expect: User is redirected to Keycloak login page
    - expect: User must authenticate again

#### 1.5. Unauthorized Access Protection

**File:** `tests/cite/authentication/unauthorized-access.spec.ts`

**Steps:**
  1. Clear all cookies and local storage to simulate unauthenticated state
    - expect: Session is cleared
  2. Attempt to navigate directly to a protected route (e.g., http://localhost:4721/admin)
    - expect: User is redirected to Keycloak login page
    - expect: Protected route is not accessible without authentication

### 2. Home Page and Evaluation List

**Seed:** `tests/seed.setup.ts`

#### 2.1. Home Page Display

**File:** `tests/cite/home/home-page-display.spec.ts`

**Steps:**
  1. Log in and land on home page
    - expect: Home page displays with 'CITE' icon and 'My Evaluations' title
    - expect: Evaluation list component is visible
    - expect: Navigation elements are present
    - expect: Administration button is visible for authorized users

#### 2.2. Evaluation List Display - With Evaluations

**File:** `tests/cite/home/evaluation-list-with-evaluations.spec.ts`

**Steps:**
  1. Log in as user with access to evaluations
    - expect: Evaluation list table displays
    - expect: Table shows columns for 'Name', 'Status', 'Created By', and 'Date Created'
    - expect: Active evaluations are visible in the list

#### 2.3. Evaluation List Display - Empty State

**File:** `tests/cite/home/evaluation-list-empty-state.spec.ts`

**Steps:**
  1. Log in as user with no evaluations assigned
    - expect: Evaluation list is empty or shows 'No results found' message
    - expect: No evaluations are displayed in the table

#### 2.4. Evaluation List Search/Filter

**File:** `tests/cite/home/evaluation-list-filter.spec.ts`

**Steps:**
  1. Log in and navigate to home page with multiple evaluations
    - expect: Evaluation list displays multiple evaluations
  2. Locate the search/filter input field
    - expect: Search field is visible
  3. Enter a search term that matches at least one evaluation description
    - expect: Evaluation list filters to show only matching evaluations
    - expect: Non-matching evaluations are hidden
  4. Clear the search field using the clear button
    - expect: All evaluations are displayed again

#### 2.5. Evaluation List Sorting

**File:** `tests/cite/home/evaluation-list-sorting.spec.ts`

**Steps:**
  1. Log in and navigate to home page with multiple evaluations
    - expect: Evaluation list displays multiple evaluations
  2. Click on the 'Name' column header
    - expect: Evaluations are sorted alphabetically by description (ascending)
    - expect: Sort indicator appears on column header
  3. Click on the 'Name' column header again
    - expect: Evaluations are sorted in reverse alphabetical order (descending)
    - expect: Sort indicator updates to show descending order

#### 2.6. Navigate to Evaluation from List

**File:** `tests/cite/home/navigate-to-evaluation.spec.ts`

**Steps:**
  1. Log in and navigate to home page
    - expect: Evaluation list displays at least one evaluation
  2. Click on an evaluation row/link in the list
    - expect: User is navigated to the evaluation dashboard
    - expect: URL changes to include evaluation parameter
    - expect: Evaluation interface loads with team and move information

### 3. Evaluation Dashboard Interface

**Seed:** `tests/seed.setup.ts`

#### 3.1. Dashboard Initial Load

**File:** `tests/cite/evaluation/dashboard-initial-load.spec.ts`

**Steps:**
  1. Log in and select an evaluation from the home page
    - expect: Dashboard page loads
    - expect: Evaluation information header is displayed
    - expect: Team selector is visible
    - expect: Move navigation controls are present
    - expect: Main content area displays dashboard view

#### 3.2. Dashboard - Evaluation Information Display

**File:** `tests/cite/evaluation/evaluation-info-display.spec.ts`

**Steps:**
  1. Navigate to evaluation dashboard
    - expect: Evaluation description is visible
    - expect: Current move number is displayed
    - expect: Evaluation status is shown
    - expect: Section navigation tabs are available (Dashboard, Scoresheet, Report, Aggregate)

#### 3.3. Team Selection

**File:** `tests/cite/evaluation/team-selection.spec.ts`

**Steps:**
  1. Navigate to evaluation dashboard where user belongs to multiple teams
    - expect: Evaluation dashboard loads with team selector
  2. Click on team selector dropdown
    - expect: Team dropdown menu opens
    - expect: List of available teams is displayed
  3. Select a different team from the dropdown
    - expect: Selected team becomes active
    - expect: Dashboard refreshes to show team-specific data
    - expect: Team name updates in selector
    - expect: Submissions reload for selected team

#### 3.4. Move Navigation - Next Move

**File:** `tests/cite/evaluation/move-navigation-next.spec.ts`

**Steps:**
  1. Navigate to evaluation dashboard at a move before the current move
    - expect: Dashboard displays with current move information
    - expect: Next move button is enabled
  2. Click the next move button or arrow
    - expect: Move number increments by one
    - expect: Dashboard updates to show next move data
    - expect: Submission data refreshes for the new move

#### 3.5. Move Navigation - Previous Move

**File:** `tests/cite/evaluation/move-navigation-previous.spec.ts`

**Steps:**
  1. Navigate to evaluation dashboard at a move after move 0
    - expect: Dashboard displays with current move information
    - expect: Previous move button is enabled
  2. Click the previous move button or arrow
    - expect: Move number decrements by one
    - expect: Dashboard updates to show previous move data
    - expect: Submission data refreshes for the previous move

#### 3.6. Move Navigation - Boundary Conditions

**File:** `tests/cite/evaluation/move-navigation-boundaries.spec.ts`

**Steps:**
  1. Navigate to evaluation dashboard at move 0
    - expect: Dashboard displays move 0 data
    - expect: Previous move button is disabled
  2. Navigate to the maximum/current move number
    - expect: Dashboard displays current move data
    - expect: Next move button is disabled or hidden

#### 3.7. Section Navigation - Switch to Scoresheet

**File:** `tests/cite/evaluation/switch-to-scoresheet.spec.ts`

**Steps:**
  1. Navigate to evaluation dashboard
    - expect: Dashboard view is displayed
  2. Click on 'Scoresheet' tab or navigation button
    - expect: View switches to scoresheet section
    - expect: Scoresheet interface is displayed
    - expect: Scoring categories and options are visible
    - expect: User preferences are saved

#### 3.8. Section Navigation - Switch to Report

**File:** `tests/cite/evaluation/switch-to-report.spec.ts`

**Steps:**
  1. Navigate to evaluation dashboard
    - expect: Dashboard view is displayed
  2. Click on 'Report' tab or navigation button
    - expect: View switches to report section
    - expect: Report interface is displayed
    - expect: Summary and detailed scoring data are visible

#### 3.9. Section Navigation - Switch to Aggregate

**File:** `tests/cite/evaluation/switch-to-aggregate.spec.ts`

**Steps:**
  1. Navigate to evaluation dashboard
    - expect: Dashboard view is displayed
  2. Click on 'Aggregate' tab or navigation button
    - expect: View switches to aggregate section
    - expect: Aggregate scoring view is displayed
    - expect: Combined team/group scores are visible

#### 3.10. Return to Home from Evaluation

**File:** `tests/cite/evaluation/return-to-home.spec.ts`

**Steps:**
  1. Navigate to evaluation dashboard
    - expect: Evaluation dashboard is displayed
  2. Click on CITE logo or home link in top bar
    - expect: User is navigated back to home page
    - expect: Evaluation list is displayed

### 4. Scoresheet Interface

**Seed:** `tests/seed.setup.ts`

#### 4.1. Scoresheet Initial Load

**File:** `tests/cite/scoresheet/scoresheet-initial-load.spec.ts`

**Steps:**
  1. Navigate to evaluation and switch to scoresheet view
    - expect: Scoresheet interface loads
    - expect: Scoring categories are displayed
    - expect: Scoring options are visible for each category
    - expect: Current submission scores are shown

#### 4.2. Scoresheet - View User Submission

**File:** `tests/cite/scoresheet/view-user-submission.spec.ts`

**Steps:**
  1. Navigate to scoresheet on user's team
    - expect: Scoresheet displays
  2. Select 'User' submission type from submission selector
    - expect: Scoresheet updates to show user's individual scores
    - expect: User's selected scoring options are highlighted
    - expect: User can modify their own scores if CanSubmit permission is granted

#### 4.3. Scoresheet - View Team Submission

**File:** `tests/cite/scoresheet/view-team-submission.spec.ts`

**Steps:**
  1. Navigate to scoresheet
    - expect: Scoresheet displays
  2. Select 'Team' submission type from submission selector
    - expect: Scoresheet updates to show team's official scores
    - expect: Team's selected scoring options are highlighted
    - expect: Team submission reflects consensus or official team position

#### 4.4. Scoresheet - View Team Average Submission

**File:** `tests/cite/scoresheet/view-team-average-submission.spec.ts`

**Steps:**
  1. Navigate to scoresheet
    - expect: Scoresheet displays
  2. Select 'Team Average' submission type from submission selector
    - expect: Scoresheet updates to show calculated team average scores
    - expect: Average scores across all team members are displayed
    - expect: Team average submission is read-only

#### 4.5. Scoresheet - View Group Average Submission

**File:** `tests/cite/scoresheet/view-group-average-submission.spec.ts`

**Steps:**
  1. Navigate to scoresheet in an evaluation with groups
    - expect: Scoresheet displays
  2. Select 'Group Average' submission type from submission selector
    - expect: Scoresheet updates to show calculated group average scores
    - expect: Average scores across all teams in the group are displayed
    - expect: Group average submission is read-only

#### 4.6. Scoresheet - View Official Submission

**File:** `tests/cite/scoresheet/view-official-submission.spec.ts`

**Steps:**
  1. Navigate to scoresheet
    - expect: Scoresheet displays
  2. Select 'Official' submission type from submission selector
    - expect: Scoresheet updates to show official evaluation scores
    - expect: Official scoring options are highlighted
    - expect: Official submission shows authoritative/ground truth scores

#### 4.7. Scoresheet - Modify Score with CanSubmit Permission

**File:** `tests/cite/scoresheet/modify-score-authorized.spec.ts`

**Steps:**
  1. Log in as user with CanSubmit permission for team
    - expect: User is authenticated with appropriate permissions
  2. Navigate to scoresheet and select user submission
    - expect: Scoresheet displays with editable scoring options
    - expect: Scoring options are interactive
  3. Click on a scoring option for a category
    - expect: Scoring option is selected
    - expect: Selection is saved automatically
    - expect: Score is updated in real-time
    - expect: Total score recalculates if applicable

#### 4.8. Scoresheet - Modify Score without CanSubmit Permission

**File:** `tests/cite/scoresheet/modify-score-unauthorized.spec.ts`

**Steps:**
  1. Log in as user without CanSubmit permission
    - expect: User is authenticated
  2. Navigate to scoresheet
    - expect: Scoresheet displays in read-only mode
    - expect: Scoring options are visible but not interactive
    - expect: User cannot modify scores

#### 4.9. Scoresheet - Add Comment to Score

**File:** `tests/cite/scoresheet/add-comment.spec.ts`

**Steps:**
  1. Navigate to scoresheet with edit permissions
    - expect: Scoresheet displays with editable fields
  2. Locate comment field for a scoring category or option
    - expect: Comment field is visible
  3. Enter comment text in the comment field
    - expect: Comment text is accepted
  4. Save or blur the comment field
    - expect: Comment is saved automatically
    - expect: Comment appears in scoresheet
    - expect: Comment indicator shows that a comment exists

#### 4.10. Scoresheet - View Score Summary

**File:** `tests/cite/scoresheet/view-score-summary.spec.ts`

**Steps:**
  1. Navigate to scoresheet with scored submission
    - expect: Scoresheet displays with scores
  2. Locate score summary section (if rightSideDisplay is set to ScoreSummary)
    - expect: Score summary is visible in right panel
    - expect: Total score is displayed
    - expect: Category-wise score breakdown is shown
    - expect: Percentage or progress indicators are present if applicable

### 5. Report Interface

**Seed:** `tests/seed.setup.ts`

#### 5.1. Report Display

**File:** `tests/cite/report/report-display.spec.ts`

**Steps:**
  1. Navigate to evaluation and switch to report view
    - expect: Report interface loads
    - expect: Summary information is displayed
    - expect: Detailed scoring data is visible
    - expect: Comparison data may be shown

#### 5.2. Report - View Team Comparison

**File:** `tests/cite/report/view-team-comparison.spec.ts`

**Steps:**
  1. Navigate to report view in an evaluation with multiple teams
    - expect: Report displays
  2. Locate team comparison section
    - expect: Comparison of scores across teams is shown
    - expect: Team names are displayed
    - expect: Scores are presented in comparable format (table, chart, etc.)

#### 5.3. Report - Export Report Data

**File:** `tests/cite/report/export-report.spec.ts`

**Steps:**
  1. Navigate to report view
    - expect: Report displays with data
  2. Click export or download button if available
    - expect: Export dialog opens or export begins
    - expect: Export format options are presented if applicable (PDF, CSV, Excel)
    - expect: Report data is exported
    - expect: Export file is downloaded

### 6. Aggregate Interface

**Seed:** `tests/seed.setup.ts`

#### 6.1. Aggregate Display

**File:** `tests/cite/aggregate/aggregate-display.spec.ts`

**Steps:**
  1. Navigate to evaluation and switch to aggregate view
    - expect: Aggregate interface loads
    - expect: Combined scoring data is displayed
    - expect: Team or group aggregations are visible
    - expect: Summary statistics are shown

#### 6.2. Aggregate - View Group Aggregations

**File:** `tests/cite/aggregate/view-group-aggregations.spec.ts`

**Steps:**
  1. Navigate to aggregate view in an evaluation with groups
    - expect: Aggregate view displays
    - expect: Group-level aggregations are shown
    - expect: Combined scores across teams within groups are visible
    - expect: Group names and statistics are displayed

### 7. Administration - Evaluations

**Seed:** `tests/seed.setup.ts`

#### 7.1. Admin Page Access - Authorized

**File:** `tests/cite/admin/admin-access-authorized.spec.ts`

**Steps:**
  1. Log in as user with ViewEvaluations or system admin permission
    - expect: User is authenticated with admin permissions
  2. Navigate to /admin route
    - expect: Admin page loads
    - expect: Admin sidebar is visible with sections
    - expect: Administration title displays

#### 7.2. Admin Page Access - Unauthorized

**File:** `tests/cite/admin/admin-access-unauthorized.spec.ts`

**Steps:**
  1. Log in as user without admin permissions
    - expect: User is authenticated
  2. Attempt to navigate to /admin route
    - expect: Access is denied or user is redirected
    - expect: Error message may be displayed
    - expect: Admin interface is not accessible

#### 7.3. Admin - Evaluations Section Navigation

**File:** `tests/cite/admin/admin-evaluations-section.spec.ts`

**Steps:**
  1. Navigate to admin page
    - expect: Admin page loads with sidebar
  2. Click on 'Evaluations' section in sidebar
    - expect: Evaluations management section displays
    - expect: List of all evaluations is shown
    - expect: Search and filter options are available
    - expect: Status filter dropdown is visible

#### 7.4. Admin - Create Evaluation

**File:** `tests/cite/admin/admin-create-evaluation.spec.ts`

**Steps:**
  1. Navigate to admin evaluations section with CreateEvaluations permission
    - expect: Evaluations list is displayed
    - expect: Create button (plus icon) is visible
  2. Click 'Create' (plus icon) button
    - expect: Create evaluation dialog/form opens
  3. Enter evaluation description 'Test Evaluation'
    - expect: Description field accepts input
  4. Select a scoring model from dropdown
    - expect: Scoring model is selected
  5. Configure evaluation settings as needed (status, situation, etc.)
    - expect: Settings are configured
  6. Click 'Save' or 'Create' button
    - expect: Evaluation is created successfully
    - expect: Success message is displayed
    - expect: New evaluation appears in evaluations list

#### 7.5. Admin - Edit Evaluation

**File:** `tests/cite/admin/admin-edit-evaluation.spec.ts`

**Steps:**
  1. Navigate to admin evaluations section with existing evaluations
    - expect: Evaluations list displays
  2. Click on an evaluation row or its edit button
    - expect: Evaluation edit dialog/page opens
    - expect: Current evaluation details are populated in form
  3. Modify evaluation description or settings
    - expect: Fields accept modifications
  4. Click 'Save' or 'Update' button
    - expect: Evaluation is updated successfully
    - expect: Success message is displayed
    - expect: Updated information is reflected in evaluations list

#### 7.6. Admin - Delete Evaluation

**File:** `tests/cite/admin/admin-delete-evaluation.spec.ts`

**Steps:**
  1. Navigate to admin evaluations section
    - expect: Evaluations list displays
  2. Click delete button (trash icon) for a test evaluation
    - expect: Confirmation dialog appears
    - expect: Dialog warns about evaluation deletion
  3. Click 'Cancel' in confirmation dialog
    - expect: Dialog closes
    - expect: Evaluation is not deleted
  4. Click delete button again
    - expect: Confirmation dialog appears
  5. Click 'Confirm' or 'Delete' in dialog
    - expect: Evaluation is deleted successfully
    - expect: Success message is displayed
    - expect: Evaluation is removed from list

#### 7.7. Admin - Evaluation Search/Filter

**File:** `tests/cite/admin/admin-evaluations-search.spec.ts`

**Steps:**
  1. Navigate to admin evaluations section with multiple evaluations
    - expect: Evaluations list displays multiple evaluations
  2. Enter search term in search field
    - expect: Evaluations list filters to show matching evaluations only
    - expect: Non-matching evaluations are hidden
  3. Clear search field
    - expect: All evaluations are displayed again

#### 7.8. Admin - Filter Evaluations by Status

**File:** `tests/cite/admin/admin-evaluations-status-filter.spec.ts`

**Steps:**
  1. Navigate to admin evaluations section
    - expect: Evaluations list displays
    - expect: Status filter dropdown is visible
  2. Click on status filter dropdown
    - expect: Status options are displayed (Active, Developing, Archived, Complete)
  3. Select one or more statuses
    - expect: Evaluations list filters to show only evaluations with selected statuses
  4. Clear status filter
    - expect: All evaluations are displayed again

#### 7.9. Admin - Increment Evaluation Move

**File:** `tests/cite/admin/admin-increment-move.spec.ts`

**Steps:**
  1. Log in as user with ManageEvaluations permission
    - expect: User is authenticated with appropriate permissions
  2. Navigate to admin evaluations section
    - expect: Evaluations list displays
  3. Locate an active evaluation with current move controls
    - expect: Evaluation details are visible with current move number and increment/decrement buttons
  4. Click increment move button (right arrow)
    - expect: Confirmation may appear
    - expect: Current move number increments by one
    - expect: Evaluation status updates
    - expect: Change is reflected across all participants

#### 7.10. Admin - Copy Evaluation

**File:** `tests/cite/admin/admin-copy-evaluation.spec.ts`

**Steps:**
  1. Navigate to admin evaluations section
    - expect: Evaluations list displays
  2. Click copy button for an evaluation
    - expect: Copy process initiates
    - expect: Dialog may appear for naming the copy
  3. Confirm copy operation
    - expect: Evaluation is copied successfully
    - expect: New evaluation appears in list with copied data

#### 7.11. Admin - Download Evaluation

**File:** `tests/cite/admin/admin-download-evaluation.spec.ts`

**Steps:**
  1. Navigate to admin evaluations section
    - expect: Evaluations list displays
  2. Click download button for an evaluation
    - expect: Download begins
    - expect: JSON file is downloaded containing evaluation data

#### 7.12. Admin - Upload Evaluation

**File:** `tests/cite/admin/admin-upload-evaluation.spec.ts`

**Steps:**
  1. Navigate to admin evaluations section
    - expect: Evaluations list displays
    - expect: Upload button is visible
  2. Click upload button
    - expect: File selection dialog opens
  3. Select a valid evaluation JSON file
    - expect: File is uploaded
    - expect: Evaluation is created from file
    - expect: New evaluation appears in list

#### 7.13. Admin - Expand Evaluation Details

**File:** `tests/cite/admin/admin-evaluation-details.spec.ts`

**Steps:**
  1. Navigate to admin evaluations section
    - expect: Evaluations list displays
  2. Click on an evaluation row to expand details
    - expect: Evaluation row expands
    - expect: Nested sections appear: Moves, Teams, Actions, Duties, Memberships
    - expect: Each section is collapsed by default in expansion panels

#### 7.14. Admin - Manage Evaluation Moves

**File:** `tests/cite/admin/admin-evaluation-moves.spec.ts`

**Steps:**
  1. Navigate to admin evaluations section and expand an evaluation
    - expect: Evaluation details are expanded
  2. Expand the 'Moves' section
    - expect: Moves management interface displays
    - expect: List of moves is shown
    - expect: Add move button is available
  3. Click add move button
    - expect: Create move dialog opens
  4. Enter move details (move number, description, situation description)
    - expect: Form accepts input
  5. Save new move
    - expect: Move is created successfully
    - expect: Move appears in list

#### 7.15. Admin - Manage Evaluation Teams

**File:** `tests/cite/admin/admin-evaluation-teams.spec.ts`

**Steps:**
  1. Navigate to admin evaluations section and expand an evaluation
    - expect: Evaluation details are expanded
  2. Expand the 'Teams' section
    - expect: Teams management interface displays
    - expect: List of teams for the evaluation is shown
    - expect: Add team button is available
  3. Click add team button
    - expect: Create team dialog opens
  4. Enter team name and select team type
    - expect: Form accepts input
  5. Save new team
    - expect: Team is created successfully
    - expect: Team appears in list

#### 7.16. Admin - Manage Evaluation Actions

**File:** `tests/cite/admin/admin-evaluation-actions.spec.ts`

**Steps:**
  1. Navigate to admin evaluations section and expand an evaluation
    - expect: Evaluation details are expanded
  2. Expand the 'Actions' section
    - expect: Actions management interface displays
    - expect: List of actions is shown
    - expect: Add action button is available
  3. Click add action button
    - expect: Create action dialog opens
  4. Enter action details (description, move, team, etc.)
    - expect: Form accepts input
  5. Save new action
    - expect: Action is created successfully
    - expect: Action appears in list

#### 7.17. Admin - Manage Evaluation Duties

**File:** `tests/cite/admin/admin-evaluation-duties.spec.ts`

**Steps:**
  1. Navigate to admin evaluations section and expand an evaluation
    - expect: Evaluation details are expanded
  2. Expand the 'Duties' section
    - expect: Duties management interface displays
    - expect: List of duties is shown
    - expect: Add duty button is available
  3. Click add duty button
    - expect: Create duty dialog opens
  4. Enter duty details (description, team, etc.)
    - expect: Form accepts input
  5. Save new duty
    - expect: Duty is created successfully
    - expect: Duty appears in list

#### 7.18. Admin - Manage Evaluation Memberships

**File:** `tests/cite/admin/admin-evaluation-memberships.spec.ts`

**Steps:**
  1. Navigate to admin evaluations section and expand an evaluation
    - expect: Evaluation details are expanded
  2. Expand the 'Memberships' section
    - expect: Memberships management interface displays
    - expect: List of users with evaluation access is shown
    - expect: Add membership button is available
  3. Click add membership button
    - expect: User selection dialog opens
  4. Select a user and assign evaluation role
    - expect: User is selected
    - expect: Role options are available
  5. Save membership
    - expect: Membership is created successfully
    - expect: User appears in memberships list with assigned role

### 8. Administration - Scoring Models

**Seed:** `tests/seed.setup.ts`

#### 8.1. Admin - Scoring Models Section

**File:** `tests/cite/admin/admin-scoring-models-section.spec.ts`

**Steps:**
  1. Navigate to admin page with ViewScoringModels permission
    - expect: Admin page loads
  2. Click on 'Scoring Models' section in sidebar
    - expect: Scoring models section displays
    - expect: List of scoring models is shown

#### 8.2. Admin - Create Scoring Model

**File:** `tests/cite/admin/admin-create-scoring-model.spec.ts`

**Steps:**
  1. Navigate to admin scoring models section with CreateScoringModels permission
    - expect: Scoring models list displays
    - expect: Create button is visible
  2. Click 'Create' button
    - expect: Create scoring model dialog opens
  3. Enter scoring model name and description
    - expect: Form fields accept input
  4. Configure scoring model settings (status, display options, use flags)
    - expect: Settings are configured
  5. Click 'Create' button
    - expect: Scoring model is created successfully
    - expect: New scoring model appears in list

#### 8.3. Admin - Edit Scoring Model

**File:** `tests/cite/admin/admin-edit-scoring-model.spec.ts`

**Steps:**
  1. Navigate to admin scoring models section
    - expect: Scoring models list displays
  2. Click on a scoring model or edit button
    - expect: Edit scoring model dialog opens
    - expect: Current details are displayed
  3. Modify scoring model details
    - expect: Fields accept modifications
  4. Save changes
    - expect: Scoring model is updated successfully
    - expect: Changes are reflected in list

#### 8.4. Admin - Delete Scoring Model

**File:** `tests/cite/admin/admin-delete-scoring-model.spec.ts`

**Steps:**
  1. Navigate to admin scoring models section
    - expect: Scoring models list displays
  2. Click delete button for a scoring model not in use
    - expect: Confirmation dialog appears
  3. Confirm deletion
    - expect: Scoring model is deleted successfully
    - expect: Scoring model is removed from list

#### 8.5. Admin - Expand Scoring Model Details

**File:** `tests/cite/admin/admin-scoring-model-details.spec.ts`

**Steps:**
  1. Navigate to admin scoring models section
    - expect: Scoring models list displays
  2. Click on a scoring model row to expand
    - expect: Scoring model row expands
    - expect: Nested sections appear: Categories, Memberships
    - expect: Scoring categories and options are displayed in hierarchy

#### 8.6. Admin - Manage Scoring Categories

**File:** `tests/cite/admin/admin-scoring-categories.spec.ts`

**Steps:**
  1. Navigate to admin scoring models section and expand a scoring model
    - expect: Scoring model details are expanded
    - expect: Categories section is visible
  2. Click add category button
    - expect: Create category dialog opens
  3. Enter category details (description, scoring weight)
    - expect: Form accepts input
  4. Save new category
    - expect: Category is created successfully
    - expect: Category appears in list under scoring model

#### 8.7. Admin - Manage Scoring Options

**File:** `tests/cite/admin/admin-scoring-options.spec.ts`

**Steps:**
  1. Navigate to admin scoring models section and expand a scoring model with categories
    - expect: Scoring model details are expanded
    - expect: Categories with their options are visible
  2. Locate a category and click add option button
    - expect: Create option dialog opens
  3. Enter option details (description, value, modifier)
    - expect: Form accepts input
  4. Save new option
    - expect: Option is created successfully
    - expect: Option appears in list under correct category

#### 8.8. Admin - Manage Scoring Model Memberships

**File:** `tests/cite/admin/admin-scoring-model-memberships.spec.ts`

**Steps:**
  1. Navigate to admin scoring models section and expand a scoring model
    - expect: Scoring model details are expanded
  2. Expand the 'Memberships' section
    - expect: Memberships management interface displays
    - expect: List of users with access to this scoring model is shown
  3. Click add membership button
    - expect: User selection dialog opens
  4. Select a user and assign role
    - expect: User is selected
    - expect: Role is assigned
  5. Save membership
    - expect: Membership is created successfully
    - expect: User appears in memberships list

### 9. Administration - Submissions

**Seed:** `tests/seed.setup.ts`

#### 9.1. Admin - Submissions Section

**File:** `tests/cite/admin/admin-submissions-section.spec.ts`

**Steps:**
  1. Navigate to admin page
    - expect: Admin page loads
  2. Click on 'Submissions' section in sidebar
    - expect: Submissions management section displays
    - expect: List of submissions is shown with filters

#### 9.2. Admin - View Submission Details

**File:** `tests/cite/admin/admin-view-submission.spec.ts`

**Steps:**
  1. Navigate to admin submissions section
    - expect: Submissions list displays
  2. Click on a submission to view details
    - expect: Submission details are displayed
    - expect: Scores and comments are visible
    - expect: User and team information is shown

#### 9.3. Admin - Filter Submissions by Evaluation

**File:** `tests/cite/admin/admin-filter-submissions-evaluation.spec.ts`

**Steps:**
  1. Navigate to admin submissions section
    - expect: Submissions list displays
  2. Select an evaluation from filter dropdown
    - expect: Submissions list filters to show only submissions for selected evaluation
    - expect: Filter is applied successfully

#### 9.4. Admin - Filter Submissions by Team

**File:** `tests/cite/admin/admin-filter-submissions-team.spec.ts`

**Steps:**
  1. Navigate to admin submissions section
    - expect: Submissions list displays
  2. Select a team from filter dropdown
    - expect: Submissions list filters to show only submissions for selected team
    - expect: Filter is applied successfully

### 10. Administration - Team Types

**Seed:** `tests/seed.setup.ts`

#### 10.1. Admin - Team Types Section

**File:** `tests/cite/admin/admin-team-types-section.spec.ts`

**Steps:**
  1. Navigate to admin page with ViewTeamTypes permission
    - expect: Admin page loads
  2. Click on 'Team Types' section in sidebar
    - expect: Team types management section displays
    - expect: List of team types is shown

#### 10.2. Admin - Create Team Type

**File:** `tests/cite/admin/admin-create-team-type.spec.ts`

**Steps:**
  1. Navigate to admin team types section
    - expect: Team types list displays
    - expect: Create team type button is visible
  2. Click create team type button
    - expect: Create team type dialog opens
  3. Enter team type name
    - expect: Team type name field accepts input
  4. Save new team type
    - expect: Team type is created successfully
    - expect: New team type appears in list

#### 10.3. Admin - Edit Team Type

**File:** `tests/cite/admin/admin-edit-team-type.spec.ts`

**Steps:**
  1. Navigate to admin team types section
    - expect: Team types list displays
  2. Click on a team type or edit button
    - expect: Edit team type dialog opens
    - expect: Current details are displayed
  3. Modify team type details
    - expect: Fields accept modifications
  4. Save changes
    - expect: Team type is updated successfully
    - expect: Changes are reflected in list

#### 10.4. Admin - Delete Team Type

**File:** `tests/cite/admin/admin-delete-team-type.spec.ts`

**Steps:**
  1. Navigate to admin team types section
    - expect: Team types list displays
  2. Click delete button for a team type not in use
    - expect: Confirmation dialog appears
  3. Confirm deletion
    - expect: Team type is deleted successfully
    - expect: Team type is removed from list

### 11. Administration - Users

**Seed:** `tests/seed.setup.ts`

#### 11.1. Admin - Users Section

**File:** `tests/cite/admin/admin-users-section.spec.ts`

**Steps:**
  1. Navigate to admin page with ViewUsers permission
    - expect: Admin page loads
  2. Click on 'Users' section in sidebar
    - expect: Users management section displays
    - expect: List of users is shown
    - expect: Search functionality is available

#### 11.2. Admin - User Search

**File:** `tests/cite/admin/admin-users-search.spec.ts`

**Steps:**
  1. Navigate to admin users section
    - expect: Users list displays
  2. Enter a user name in search field
    - expect: Users list filters to show matching users
    - expect: Search results update dynamically

#### 11.3. Admin - View User Details

**File:** `tests/cite/admin/admin-view-user-details.spec.ts`

**Steps:**
  1. Navigate to admin users section
    - expect: Users list displays
  2. Click on a user
    - expect: User details page or dialog opens
    - expect: User information is displayed
    - expect: User's team memberships and permissions are visible

### 12. Administration - Roles

**Seed:** `tests/seed.setup.ts`

#### 12.1. Admin - Roles Section

**File:** `tests/cite/admin/admin-roles-section.spec.ts`

**Steps:**
  1. Navigate to admin page with ViewRoles permission
    - expect: Admin page loads
  2. Click on 'Roles' section in sidebar
    - expect: Roles management section displays
    - expect: Tabs for Roles, Scoring Model Roles, and Evaluation Roles are visible

#### 12.2. Admin - View System Roles

**File:** `tests/cite/admin/admin-system-roles.spec.ts`

**Steps:**
  1. Navigate to admin roles section
    - expect: Roles section displays
  2. Click on 'Roles' tab (system roles)
    - expect: System roles are displayed
    - expect: List shows users and their system permissions (CreateScoringModels, ViewScoringModels, CreateEvaluations, etc.)

#### 12.3. Admin - View Scoring Model Roles

**File:** `tests/cite/admin/admin-scoring-model-roles.spec.ts`

**Steps:**
  1. Navigate to admin roles section
    - expect: Roles section displays
  2. Click on 'Scoring Model Roles' tab
    - expect: Scoring model roles are displayed
    - expect: List shows users and their scoring model-specific permissions

#### 12.4. Admin - View Evaluation Roles

**File:** `tests/cite/admin/admin-evaluation-roles.spec.ts`

**Steps:**
  1. Navigate to admin roles section
    - expect: Roles section displays
  2. Click on 'Evaluation Roles' tab
    - expect: Evaluation roles are displayed
    - expect: List shows users and their evaluation-specific permissions

#### 12.5. Admin - Assign System Role

**File:** `tests/cite/admin/admin-assign-system-role.spec.ts`

**Steps:**
  1. Navigate to admin roles section, system roles tab
    - expect: System roles are displayed
  2. Locate a user and click to manage their roles
    - expect: Role management interface appears
  3. Select a system permission to grant
    - expect: Permission is selected
  4. Save changes
    - expect: Permission is granted successfully
    - expect: User's role is updated in the list

### 13. Administration - Groups

**Seed:** `tests/seed.setup.ts`

#### 13.1. Admin - Groups Section

**File:** `tests/cite/admin/admin-groups-section.spec.ts`

**Steps:**
  1. Navigate to admin page with ViewGroups permission
    - expect: Admin page loads
  2. Click on 'Groups' section in sidebar
    - expect: Groups management section displays
    - expect: List of groups is shown

#### 13.2. Admin - Create Group

**File:** `tests/cite/admin/admin-create-group.spec.ts`

**Steps:**
  1. Navigate to admin groups section
    - expect: Groups list displays
    - expect: Create group button is visible
  2. Click create group button
    - expect: Create group dialog opens
  3. Enter group name and select evaluation
    - expect: Group name field accepts input
    - expect: Evaluation is selected
  4. Save new group
    - expect: Group is created successfully
    - expect: New group appears in list

#### 13.3. Admin - Edit Group

**File:** `tests/cite/admin/admin-edit-group.spec.ts`

**Steps:**
  1. Navigate to groups section
    - expect: Groups list displays
  2. Click on a group or edit button
    - expect: Edit group dialog opens
    - expect: Current details are displayed
  3. Modify group details
    - expect: Fields accept modifications
  4. Save changes
    - expect: Group is updated successfully
    - expect: Changes are reflected in list

#### 13.4. Admin - Delete Group

**File:** `tests/cite/admin/admin-delete-group.spec.ts`

**Steps:**
  1. Navigate to groups section
    - expect: Groups list displays
  2. Click delete button for a group
    - expect: Confirmation dialog appears
  3. Confirm deletion
    - expect: Group is deleted successfully
    - expect: Group is removed from list

#### 13.5. Admin - Manage Group Members

**File:** `tests/cite/admin/admin-group-members.spec.ts`

**Steps:**
  1. Navigate to groups section and expand a group
    - expect: Groups list displays
  2. Select a group to manage members
    - expect: Group members interface opens
    - expect: List of teams in the group is shown
  3. Add a team to the group
    - expect: Team selection interface appears
  4. Select and confirm team
    - expect: Team is added successfully
    - expect: Team appears in group members list

### 14. Real-time Collaboration Features

**Seed:** `tests/seed.setup.ts`

#### 14.1. Real-time Score Updates

**File:** `tests/cite/realtime/score-updates.spec.ts`

**Steps:**
  1. Open two browser instances with different users logged in to the same evaluation and team
    - expect: Both instances are authenticated and viewing scoresheet
  2. In first instance, modify a score
    - expect: Score is updated in first instance
    - expect: Change is saved to server
  3. Observe second instance
    - expect: Score update appears in second instance automatically via SignalR
    - expect: No manual refresh is required
    - expect: Real-time synchronization is working

#### 14.2. Real-time Move Advancement

**File:** `tests/cite/realtime/move-advancement.spec.ts`

**Steps:**
  1. Open two browser instances with users in the same evaluation
    - expect: Both instances show current move number
  2. In first instance (with ManageEvaluations permission), advance to next move
    - expect: Move increments in first instance
    - expect: Move advancement is saved
  3. Observe second instance
    - expect: Move number updates automatically in second instance
    - expect: Dashboard reflects new move without refresh
    - expect: SignalR notification is received

#### 14.3. Real-time Team Changes

**File:** `tests/cite/realtime/team-changes.spec.ts`

**Steps:**
  1. Open two browser instances with users viewing the same evaluation
    - expect: Both instances are viewing evaluation data
  2. In admin interface in first instance, modify team membership
    - expect: Team membership is updated
  3. Observe second instance
    - expect: Team changes are reflected automatically
    - expect: User sees updated team information
    - expect: SignalR update is received

### 15. Error Handling and Edge Cases

**Seed:** `tests/seed.setup.ts`

#### 15.1. API Error Handling - Network Failure

**File:** `tests/cite/error-handling/network-failure.spec.ts`

**Steps:**
  1. Log in successfully
    - expect: User is authenticated
  2. Simulate network failure (disconnect or block API calls)
    - expect: Application detects network failure
  3. Attempt to perform an action that requires API call
    - expect: Error message is displayed to user
    - expect: Message indicates network issue
    - expect: Application remains stable

#### 15.2. API Error Handling - Server Error (500)

**File:** `tests/cite/error-handling/server-error.spec.ts`

**Steps:**
  1. Log in successfully
    - expect: User is authenticated
  2. Trigger an API call that returns 500 error
    - expect: Application handles error gracefully
    - expect: Error message is displayed to user
    - expect: No uncaught exceptions in console

#### 15.3. Form Validation - Required Fields

**File:** `tests/cite/error-handling/form-validation-required.spec.ts`

**Steps:**
  1. Navigate to a form (e.g., create evaluation dialog)
    - expect: Form is displayed
  2. Leave required fields empty
    - expect: Required fields are marked
  3. Attempt to submit form
    - expect: Form validation prevents submission
    - expect: Error messages indicate required fields

#### 15.4. Session Timeout

**File:** `tests/cite/error-handling/session-timeout.spec.ts`

**Steps:**
  1. Log in successfully
    - expect: User is authenticated
  2. Wait for session to expire or manually invalidate session
    - expect: Session expires
  3. Attempt to perform an action
    - expect: User is notified of session expiration
    - expect: User is redirected to login page
    - expect: No data loss occurs for unsaved changes if possible

#### 15.5. Browser Back Button Navigation

**File:** `tests/cite/error-handling/back-button-navigation.spec.ts`

**Steps:**
  1. Navigate through multiple pages (home -> evaluation -> admin)
    - expect: Navigation history is recorded
  2. Click browser back button
    - expect: User navigates back to previous page
    - expect: Page state is preserved or reloaded correctly
    - expect: No errors occur

#### 15.6. Deep Link Access

**File:** `tests/cite/error-handling/deep-link-access.spec.ts`

**Steps:**
  1. Copy a deep link URL with evaluation parameter
    - expect: URL is copied
  2. Log out or open in incognito mode
    - expect: User is not authenticated
  3. Paste and navigate to deep link URL
    - expect: User is redirected to login
    - expect: After login, user is redirected back to intended deep link with evaluation loaded

#### 15.7. Invalid Evaluation ID

**File:** `tests/cite/error-handling/invalid-evaluation-id.spec.ts`

**Steps:**
  1. Log in successfully
    - expect: User is authenticated
  2. Navigate to URL with invalid evaluation ID parameter
    - expect: Error message is displayed
    - expect: User is notified that evaluation does not exist or is not accessible
    - expect: User can navigate back to home

#### 15.8. Concurrent Score Modifications

**File:** `tests/cite/error-handling/concurrent-score-modifications.spec.ts`

**Steps:**
  1. Open two browser instances with same user logged in
    - expect: Both instances are authenticated on same evaluation
  2. Modify the same score in both instances simultaneously
    - expect: Application handles concurrent edits
    - expect: Last write wins or conflict is detected
    - expect: No data corruption occurs
    - expect: Both instances synchronize via SignalR

#### 15.9. Submission Without Required Permissions

**File:** `tests/cite/error-handling/submission-without-permission.spec.ts`

**Steps:**
  1. Log in as user without CanSubmit permission
    - expect: User is authenticated
  2. Navigate to scoresheet
    - expect: Scoresheet is displayed in read-only mode
    - expect: User cannot modify scores
  3. Attempt to modify a score via direct API call or console manipulation
    - expect: API rejects the modification with 403 Forbidden
    - expect: Error message indicates insufficient permissions
    - expect: No unauthorized changes are saved

### 16. Integration with Gallery

**Seed:** `tests/seed.setup.ts`

#### 16.1. Gallery Integration - View Articles

**File:** `tests/cite/integration/gallery-view-articles.spec.ts`

**Steps:**
  1. Navigate to evaluation dashboard with Gallery integration enabled
    - expect: Dashboard displays with gallery content area
  2. Observe articles or gallery content in the dashboard or right side panel
    - expect: Gallery articles are displayed if configured
    - expect: Articles are relevant to current evaluation
    - expect: Gallery SignalR connection is active

#### 16.2. Gallery Integration - Unread Articles Notification

**File:** `tests/cite/integration/gallery-unread-articles.spec.ts`

**Steps:**
  1. Navigate to evaluation with new gallery articles
    - expect: Dashboard displays
  2. Observe unread articles indicator
    - expect: Unread articles count is displayed if available
    - expect: Notification badge or indicator is visible
    - expect: User is aware of new content

### 17. Accessibility

**Seed:** `tests/seed.setup.ts`

#### 17.1. Keyboard Navigation - Tab Order

**File:** `tests/cite/accessibility/keyboard-tab-order.spec.ts`

**Steps:**
  1. Navigate to home page
    - expect: Page is loaded
  2. Press Tab key repeatedly to navigate through interactive elements
    - expect: Focus moves through elements in logical order
    - expect: All interactive elements are reachable
    - expect: Focus indicator is visible

#### 17.2. Keyboard Navigation - Enter Key Submission

**File:** `tests/cite/accessibility/keyboard-enter-submission.spec.ts`

**Steps:**
  1. Navigate to a form (e.g., create evaluation dialog)
    - expect: Form is displayed
  2. Fill in form fields using keyboard only
    - expect: Fields can be filled via keyboard
  3. Press Enter key to submit
    - expect: Form submits successfully without mouse click

#### 17.3. Screen Reader Compatibility - Form Labels

**File:** `tests/cite/accessibility/screen-reader-form-labels.spec.ts`

**Steps:**
  1. Navigate to a form
    - expect: All form fields have associated labels
    - expect: Labels are programmatically linked to inputs
    - expect: Screen reader announces labels correctly

#### 17.4. Focus Management - Modal Dialogs

**File:** `tests/cite/accessibility/focus-management-modals.spec.ts`

**Steps:**
  1. Open a modal dialog (e.g., create evaluation)
    - expect: Focus moves to modal when opened
    - expect: Focus is trapped within modal
    - expect: Background content is not accessible via Tab
  2. Close modal
    - expect: Focus returns to element that triggered modal

### 18. Performance

**Seed:** `tests/seed.setup.ts`

#### 18.1. Page Load Performance - Home Page

**File:** `tests/cite/performance/home-page-load-time.spec.ts`

**Steps:**
  1. Measure time from navigation to home page until page is fully loaded
    - expect: Home page loads within acceptable time (e.g., under 3 seconds)
    - expect: No blocking resources delay rendering

#### 18.2. Page Load Performance - Evaluation Dashboard

**File:** `tests/cite/performance/dashboard-load-time.spec.ts`

**Steps:**
  1. Measure time from navigation to evaluation dashboard until page is interactive
    - expect: Dashboard loads within acceptable time
    - expect: Data renders promptly

#### 18.3. API Response Time - Evaluation List

**File:** `tests/cite/performance/api-response-evaluation-list.spec.ts`

**Steps:**
  1. Monitor network requests when loading evaluation list
    - expect: API response time is under acceptable threshold (e.g., 1 second)
    - expect: No unnecessary API calls are made

#### 18.4. Memory Usage - Extended Session

**File:** `tests/cite/performance/memory-usage-extended-session.spec.ts`

**Steps:**
  1. Log in and navigate through various pages and sections for extended period
    - expect: Memory usage remains stable
    - expect: No significant memory leaks are detected
    - expect: Application performance does not degrade over time
