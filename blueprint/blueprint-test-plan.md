# Blueprint Application Test Plan

## Application Overview

Blueprint is a collaborative MSEL (Master Scenario Events List) creation application within the Crucible cybersecurity training and simulation platform. It enables teams to design, manage, and execute training scenario events through a structured interface. The application features a modern dashboard-style homepage called "Event Dashboard" that organizes MSELs into three user workflows: Join (participate in active events), Launch (start new events), and Build (design and manage events). Blueprint integrates with Player, Gallery, CITE, Player-VM, and Steamfitter services to provide comprehensive scenario management. The application supports event creation with customizable data fields, delivery methods, team/organization assignments, and timeline management. It features role-based access control, real-time collaboration, and visual scenario planning with color-coded event types. MSELs have a lifecycle with statuses: Pending, Entered, Approved, Complete, Deployed, and Archived. MSELs can be marked as reusable templates. The application includes a MSEL Playbook view for printable event summaries, MSEL Pages for rich-text content associated with a MSEL, an Event Detail page for viewing individual scenario events, and a Contributors section for managing unit access and per-MSEL roles. Integration management is done through Push/Pull Integrations. The Admin section includes Units, Data Fields, Inject Types, Catalogs, Organizations, Gallery Cards, CITE Actions, CITE Duties, Users, Roles, and Groups.

## Test Scenarios

### 1. Authentication and Authorization

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 1.1. User Login Flow

**File:** `blueprint/tests/authentication-and-authorization/user-login-flow.spec.ts`

**Steps:**
  1. Navigate to http://localhost:4725
    - expect: The application redirects to the Keycloak authentication page at https://localhost:8443/realms/crucible
  2. Enter username 'admin' in the username field
    - expect: The username field accepts input
  3. Enter password 'admin' in the password field
    - expect: The password field accepts input and masks the password
  4. Click the 'Sign In' button
    - expect: The application authenticates successfully
    - expect: The user is redirected back to http://localhost:4725
    - expect: The main application interface loads
    - expect: The topbar displays 'Event Dashboard'
    - expect: The topbar uses Material Design 3 theme colors
    - expect: The username 'admin' is displayed in the topbar
    - expect: A Blueprint icon button is visible in the topbar that links to home

#### 1.2. Unauthorized Access Redirect

**File:** `blueprint/tests/authentication-and-authorization/unauthorized-access-redirect.spec.ts`

**Steps:**
  1. Clear all browser cookies and local storage
    - expect: All authentication tokens are removed
  2. Navigate to http://localhost:4725
    - expect: The application redirects to the Keycloak login page
    - expect: No application content is displayed before authentication

#### 1.3. User Logout Flow

**File:** `blueprint/tests/authentication-and-authorization/user-logout-flow.spec.ts`

**Steps:**
  1. Log in as admin user
    - expect: Successfully authenticated and viewing the Event Dashboard
  2. Click on the user menu in the topbar
    - expect: A dropdown menu appears with logout option and theme toggle
  3. Click 'Logout' option
    - expect: The user is logged out
    - expect: Authentication tokens are cleared from local storage
    - expect: The user is redirected to the Keycloak logout page or login page

#### 1.4. Session Token Renewal

**File:** `blueprint/tests/authentication-and-authorization/session-token-renewal.spec.ts`

**Steps:**
  1. Log in as admin user
    - expect: Successfully authenticated
  2. Wait for silent token renewal
    - expect: The application automatically renews the authentication token
    - expect: No user interaction is required for token renewal
    - expect: The user session remains active

#### 1.5. Access Token Expiration Redirect

**File:** `blueprint/tests/authentication-and-authorization/access-token-expiration-redirect.spec.ts`

**Steps:**
  1. Log in as admin user and wait for token to expire or manually invalidate the token
    - expect: Token expiration occurs
  2. Attempt to perform an authenticated action
    - expect: The application detects expired token
    - expect: User is redirected to Keycloak login page
    - expect: User must re-authenticate to continue

### 2. Event Dashboard and Navigation

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 2.1. Event Dashboard Initial Load

**File:** `blueprint/tests/event-dashboard-and-navigation/event-dashboard-initial-load.spec.ts`

**Steps:**
  1. Log in as admin user and navigate to http://localhost:4725
    - expect: The Event Dashboard loads successfully
    - expect: The topbar is visible with Blueprint branding
    - expect: The topbar displays 'Event Dashboard'
    - expect: A Blueprint icon button is displayed in the topbar
    - expect: The user's name is displayed in the topbar
    - expect: The main content area displays a card-based layout
  2. Check for available dashboard cards
    - expect: If user has join MSELs, a 'Join an Event' card is visible with subtitle 'Access In-Progress Events'
    - expect: If user has launch MSELs, a 'Start an Event' card is visible with subtitle 'Launch New events'
    - expect: If user has build MSELs or create permission, a 'Manage an Event' card is visible with subtitle 'Design and Plan Events'
    - expect: If no MSELs are available and no create permission, a 'Nothing to see here!' card is displayed

#### 2.2. Navigate to Join Events

**File:** `blueprint/tests/event-dashboard-and-navigation/navigate-to-join-events.spec.ts`

**Steps:**
  1. From Event Dashboard, click on 'Join an Event' card
    - expect: Navigation to /join occurs
    - expect: Page displays list of available MSELs to join
    - expect: Topbar still displays with navigation back to dashboard

#### 2.3. Navigate to Launch Events

**File:** `blueprint/tests/event-dashboard-and-navigation/navigate-to-launch-events.spec.ts`

**Steps:**
  1. From Event Dashboard, click on 'Start an Event' card
    - expect: Navigation to /launch occurs
    - expect: Page displays list of available MSELs to launch
    - expect: Topbar still displays with navigation back to dashboard

#### 2.4. Navigate to Build Events

**File:** `blueprint/tests/event-dashboard-and-navigation/navigate-to-build-events.spec.ts`

**Steps:**
  1. From Event Dashboard, click on 'Manage an Event' card
    - expect: Navigation to /build occurs
    - expect: Page displays MSEL list
    - expect: Admin button is visible if user has admin permissions

#### 2.5. Navigation to Admin Section

**File:** `blueprint/tests/event-dashboard-and-navigation/navigation-to-admin-section.spec.ts`

**Steps:**
  1. Log in as admin user, open the topbar user menu, and select 'Administration'
    - expect: The Administration item appears once permissions load (the menu is reopened until it does)
    - expect: Navigation to /admin occurs
    - expect: The admin interface loads with sidebar navigation
    - expect: Admin sections are visible: Units, Data Fields, Inject Types, Catalogs, Organizations, Gallery Cards, CITE Actions, CITE Duties, Users, Roles, Groups (Gallery and CITE entries are rendered unconditionally)
    - expect: The version display at the bottom of the admin sidebar is present and populated

#### 2.6. Theme Toggle Light Dark Mode

**File:** `blueprint/tests/event-dashboard-and-navigation/theme-toggle-light-dark-mode.spec.ts`

**Steps:**
  1. Navigate to Event Dashboard, open the user menu, and flip the 'Dark Theme' switch
    - expect: The `darkMode` class on the page body flips
    - expect: The choice is saved as `selectedTheme` in the `uiState` localStorage entry
  2. Refresh the page
    - expect: The toggled theme persists after page reload
  3. Toggle the switch back
    - expect: The original theme is restored and saved

#### 2.7. Dashboard Loading State

**File:** `blueprint/tests/event-dashboard-and-navigation/dashboard-loading-state.spec.ts`

**Steps:**
  1. Navigate to Event Dashboard immediately after login
    - expect: During data initialization, a loading card is displayed
    - expect: Loading card shows 'Initializing Data' title with 'Please wait ...' subtitle
    - expect: A progress spinner is visible
    - expect: After data loads, dashboard shows available cards

#### 2.8. Browser Back and Forward Navigation

**File:** `blueprint/tests/event-dashboard-and-navigation/browser-back-and-forward-navigation.spec.ts`

**Steps:**
  1. Seed a MSEL. Start on the Event Dashboard, go to the /build list, and open the seeded MSEL from it
    - expect: The MSEL detail view for that MSEL is shown
  2. Press browser Back
    - expect: The MSEL list is shown again, not the MSEL
  3. Press Back again
    - expect: The Event Dashboard is shown
  4. Press Forward
    - expect: The MSEL list is shown
  5. Press Forward again
    - expect: The same MSEL's detail view is shown

### 3. MSEL Management

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 3.1. View MSELs List

**File:** `blueprint/tests/msel-management/view-msels-list.spec.ts`

**Steps:**
  1. Navigate to /build after logging in
    - expect: MSELs list is displayed in a table format
    - expect: Each MSEL shows: name, description, template status (checkbox column), status, created by, date created, date modified
    - expect: A 'Template' column shows which MSELs are marked as templates
    - expect: An 'All Types' dropdown allows filtering by template type
    - expect: An 'All Statuses' dropdown allows filtering by MSEL status
    - expect: A search box allows text-based filtering
    - expect: A 'Show all MSELs from all users' toggle button is available
    - expect: Buttons to 'Add blank MSEL' and 'Upload a new MSEL from a file' are available in the table header

#### 3.2. Filter MSELs by Type

**File:** `blueprint/tests/msel-management/filter-msels-by-type.spec.ts`

**Steps:**
  1. Navigate to /build and click the 'All Types' dropdown
    - expect: Dropdown shows type filter options
  2. Select the template filter option
    - expect: The MSEL list filters to show only MSELs marked as templates
    - expect: MSELs without template status are hidden
  3. Select 'All Types' to reset
    - expect: All MSELs are displayed again

#### 3.3. Create New MSEL

**File:** `blueprint/tests/msel-management/create-new-msel.spec.ts`

**Steps:**
  1. Navigate to MSELs list and click 'Add blank MSEL' button (plus icon in header)
    - expect: A new MSEL is created with a default name
    - expect: The new MSEL appears in the table with status 'Pending'
    - expect: Description shows 'Created from Default Settings by [username]'

#### 3.4. Upload MSEL from File

**File:** `blueprint/tests/msel-management/upload-msel-from-file.spec.ts`

**Steps:**
  1. Navigate to MSELs list and click 'Upload a new MSEL from a file' button
    - expect: A file chooser opens
  2. Select a valid XLSX file to upload
    - expect: A new MSEL is created from the file content
    - expect: The imported MSEL appears in the list

#### 3.5. Edit MSEL

**File:** `blueprint/tests/msel-management/edit-msel.spec.ts`

**Steps:**
  1. Navigate to MSELs list and click on an existing MSEL name link
    - expect: The MSEL info page is displayed with a tabbed interface
    - expect: The Config tab is selected by default
    - expect: Form fields are populated with current values
    - expect: Save Changes and Cancel Changes buttons are displayed but disabled until a change is made
    - expect: An Overview tab is available
    - expect: An 'Add Page' tab (with plus icon) is shown at the end of the tab list
  2. Modify the Description field
    - expect: The description field accepts the new value
    - expect: Character count is displayed (e.g., '176 / 600 characters')
    - expect: Save Changes button becomes enabled
  3. Click 'Save Changes' button
    - expect: The MSEL is updated successfully
    - expect: Save Changes and Cancel Changes buttons become disabled again

#### 3.6. Delete MSEL

**File:** `blueprint/tests/msel-management/delete-msel.spec.ts`

**Steps:**
  1. Navigate to MSELs list and click the delete icon for a non-template MSEL
    - expect: A confirmation dialog appears asking to confirm deletion
  2. Click 'Cancel'
    - expect: The dialog closes
    - expect: The MSEL is not deleted
  3. Click the delete icon again and confirm deletion
    - expect: The MSEL is deleted successfully
    - expect: The MSEL is removed from the list
  4. Observe the delete button on a template MSEL
    - expect: The delete button is disabled for template MSELs

#### 3.7. MSEL Form Validation

**File:** `blueprint/tests/msel-management/msel-form-validation.spec.ts`

**Steps:**
  1. Navigate to a seeded MSEL's Info tab and type in the Name field
    - expect: The input declares a 70 character maximum and the counter tracks the live length
    - expect: Input past 70 characters is truncated, not accepted
  2. Type in the Description field
    - expect: The same contract holds at 600 characters
  3. Dirty the form through another field, then clear Name and try to save
    - expect: A required-field validation error is displayed
    - expect: The save is blocked and no request reaches the server

#### 3.8. MSEL Status Lifecycle

**File:** `blueprint/tests/msel-management/msel-status-lifecycle.spec.ts`

**Steps:**
  1. Navigate to a MSEL Config tab and open the MSEL Status dropdown
    - expect: Available statuses are: Pending, Entered, Approved, Complete, Deployed, Archived
  2. Change the status and save
    - expect: Status change is reflected in the MSEL list and detail view

#### 3.9. MSEL Template Management

**File:** `blueprint/tests/msel-management/msel-template-management.spec.ts`

**Steps:**
  1. Navigate to an existing MSEL Config tab
    - expect: An 'Is a Template' checkbox is visible with tooltip 'Mark this MSEL as a reusable template for creating new MSELs'
  2. Check the 'Is a Template' checkbox and save changes
    - expect: The MSEL is now marked as a template
    - expect: In the MSELs list, the Template column shows the checkbox as checked
    - expect: The delete button becomes disabled for this MSEL
  3. Filter the MSELs list using the 'All Types' dropdown to show only templates
    - expect: Only template MSELs are shown in the list
  4. Uncheck the 'Is a Template' checkbox and save
    - expect: The MSEL is no longer a template
    - expect: The delete button becomes enabled again

#### 3.10. Clone MSEL

**File:** `blueprint/tests/msel-management/clone-msel.spec.ts`

**Steps:**
  1. Navigate to MSELs list and click the 'Copy [MSEL name]' button for a MSEL
    - expect: A copy of the MSEL is created
    - expect: The cloned MSEL appears in the list
    - expect: The cloned MSEL has independent data from the original

#### 3.11. Search and Filter MSELs

**File:** `blueprint/tests/msel-management/search-and-filter-msels.spec.ts`

**Steps:**
  1. Navigate to MSELs list and enter a search term in the search box
    - expect: The list filters to show only MSELs matching the search term
    - expect: Search works on MSEL name and description
  2. Clear the search box
    - expect: All MSELs are displayed again
  3. Apply status filter using the 'All Statuses' dropdown
    - expect: The list filters according to the selected status

#### 3.12. Sort MSELs

**File:** `blueprint/tests/msel-management/sort-msels.spec.ts`

**Steps:**
  1. Navigate to MSELs list and click on the 'Name' column header
    - expect: MSELs are sorted alphabetically by name
    - expect: A sort indicator shows direction
  2. Click the 'Template' column header
    - expect: MSELs are sorted by template status

### 4. MSEL Info Pages Management

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 4.1. View MSEL Config Tab

**File:** `blueprint/tests/msel-info-pages/view-msel-config-tab.spec.ts`

**Steps:**
  1. Navigate to a MSEL and click on its name link
    - expect: The MSEL info area shows a tabbed interface with Config tab selected by default
    - expect: An Overview tab is available
    - expect: An 'Add Page' tab with a plus icon is shown at the end
  2. Review the Config tab content
    - expect: Name field with character count (e.g., '31 / 70 characters')
    - expect: Description field with character count (e.g., '176 / 600 characters')
    - expect: 'Is a Template' checkbox with tooltip
    - expect: 'Set a Start Time' checkbox with tooltip 'Schedule a specific start date and time for this MSEL'
    - expect: Start Date / Time field shown when Set a Start Time is checked
    - expect: End Date / Time field with duration spinner (days d, hours h, minutes m)
    - expect: Applications to Integrate section with checkboxes: Player, Gallery, CITE (with Scoring Model display), Steamfitter
    - expect: 'Push Integrations' button
    - expect: MSEL Status dropdown
    - expect: Exercise View URL section with copy button and direct link
    - expect: MSEL Starter URL section with copy button and direct link
    - expect: Header Row Metadata (Height) field for Excel export
    - expect: Date Created field (read-only)
    - expect: Created By field (read-only)

#### 4.2. Add MSEL Page

**File:** `blueprint/tests/msel-info-pages/add-msel-page.spec.ts`

**Steps:**
  1. Navigate to a MSEL and click the 'Add Page' tab (plus icon at end of tabs)
    - expect: A new page is created automatically with a default name like 'New Page'
    - expect: The application switches to the newly created page tab
    - expect: The rich text editor becomes active for editing
  2. Edit the page name and add content using the rich text editor
    - expect: Page name field is editable
    - expect: Content area shows a rich text editor with a toolbar
    - expect: Content supports formatting: bold, italic, lists, headings, fonts (Arial, Times New Roman, Calibri, Comic Sans MS)
  3. Click save for the page edits
    - expect: Page is saved successfully
    - expect: The tab displays the updated page name
    - expect: Edit mode is deactivated
  4. Click cancel on page edits
    - expect: Changes are discarded and reverts to last saved state

#### 4.3. Edit MSEL Page

**File:** `blueprint/tests/msel-info-pages/edit-msel-page.spec.ts`

**Steps:**
  1. Navigate to a MSEL with existing pages and click a page tab
    - expect: The page content is displayed in view mode
  2. Click the edit button for the page
    - expect: Rich text editor appears with the existing content
    - expect: Save and Cancel buttons are displayed
  3. Modify the page content and save
    - expect: Changes are saved successfully
    - expect: View mode is restored with updated content

#### 4.4. Delete MSEL Page

**File:** `blueprint/tests/msel-info-pages/delete-msel-page.spec.ts`

**Steps:**
  1. Navigate to a MSEL with existing pages and click a page tab, then click the delete button
    - expect: A confirmation dialog appears
  2. Confirm deletion
    - expect: The page is deleted
    - expect: The tab is removed
    - expect: Application switches back to the Config tab

#### 4.5. MSEL Page Unsaved Changes Warning

**File:** `blueprint/tests/msel-info-pages/msel-page-unsaved-changes-warning.spec.ts`

**Steps:**
  1. Navigate to a MSEL page and make edits without saving
    - expect: The page shows unsaved changes in edit mode
  2. Try to close the browser tab
    - expect: Browser shows an 'unsaved changes' warning (beforeunload event)
  3. Switch to a different page tab without saving
    - expect: Unsaved changes are preserved temporarily in memory for that page
    - expect: Switching back to the edited page shows the unsaved changes still present

#### 4.6. Push and Pull Integrations

**File:** `blueprint/tests/msel-info-pages/push-and-pull-integrations.spec.ts`

**Steps:**
  1. Navigate to a MSEL Config tab with at least one integration checkbox enabled
    - expect: 'Push Integrations' button is visible next to Applications to Integrate label
  2. Click 'Push Integrations' button
    - expect: A confirmation dialog appears: 'Are you sure that you want to push MSEL data to the selected applications?'
    - expect: If Gallery events are missing required fields, a warning is appended to the message
  3. Confirm the push
    - expect: Push status message updates to 'Pushing Integrations'
    - expect: Status clears when push completes
  4. Find and use the Remove/Pull Integrations option
    - expect: A confirmation dialog appears asking to confirm removal
    - expect: Integration data is removed from associated applications after confirmation

#### 4.7. View Exercise View URL and Starter URL

**File:** `blueprint/tests/msel-info-pages/view-exercise-view-url-and-starter-url.spec.ts`

**Steps:**
  1. Navigate to a MSEL Config tab and review the URL sections
    - expect: 'Exercise View URL' section shows a copyable URL button and a direct link
    - expect: URL format is: http://localhost:4725/msel/{mselId}/view
    - expect: Tooltip describes: 'Use this URL for direct access to view the Exercise MSEL'
    - expect: 'MSEL Starter URL' section shows a copyable URL button and a direct link
    - expect: URL format is: http://localhost:4725/starter/?msel={mselId}
    - expect: Tooltip describes: 'Use this URL for direct access to edit the Scenario Events'
  2. Click the copy button for the Exercise View URL
    - expect: The URL is copied to the clipboard
  3. Navigate to the Exercise View URL
    - expect: The MSEL view page loads at /msel/{mselId}/view
    - expect: Scenario events are displayed in a read-only exercise view format
  4. Navigate to the MSEL Starter URL
    - expect: The starter page loads at /starter/?msel={mselId}
    - expect: Scenario events are displayed in the starter mode

#### 4.8. View Integration Name Display

**File:** `blueprint/tests/msel-info-pages/view-integration-name-display.spec.ts`

**Steps:**
  1. Navigate to a MSEL Config tab that has been deployed with Player, Gallery, CITE, or Steamfitter integrations
    - expect: Player integration shows the linked Player View name next to the checkbox
    - expect: Gallery integration shows linked Collection name and Exhibit name when deployed
    - expect: CITE integration shows linked Evaluation name and Scoring Model description
    - expect: Steamfitter integration shows linked Scenario name
    - expect: Names are fetched dynamically from the respective service APIs

#### 4.9. MSEL Moves

**File:** `blueprint/tests/msel-info-pages/msel-moves.spec.ts`

**Steps:**
  1. Open a new MSEL's Moves section and click 'Add new move', enter a description, and click 'Save'
    - expect: The 'Add a Move' dialog pre-fills Move Number 1
    - expect: The move is listed as move 1 and no ordering warning is shown
  2. Add a second move
    - expect: The dialog pre-fills Move Number 2 and the latest existing start offset
    - expect: '** The moves are not in ascending start time order!' is shown, because both moves start at the same time
  3. Edit Move 2, set 'Minutes from Start' to 30, and click 'Save'
    - expect: The ordering warning disappears and the new offset is saved
  4. Search for move 1's description, then clear the search
    - expect: Only move 1 is listed, then both moves are listed again
  5. Click 'Delete Move 1', answer 'No', then repeat and answer 'Yes'
    - expect: The confirmation reads 'Are you sure that you want to delete <description>?'
    - expect: Declining keeps the move; confirming removes only move 1

### 5. Contributors Management

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 5.1. View Contributors Section

**File:** `blueprint/tests/contributors-management/view-contributors-section.spec.ts`

**Steps:**
  1. Navigate to a MSEL and click 'Contributors' in the sidebar navigation
    - expect: The Contributors section loads
    - expect: A table is shown listing Units associated with this MSEL
    - expect: Each unit row shows: Short Name and Name columns
    - expect: Rows can be expanded to show unit users and their MSEL roles
    - expect: An add-unit control is available if user has manage permissions

#### 5.2. Add Unit to MSEL

**File:** `blueprint/tests/contributors-management/add-unit-to-msel.spec.ts`

**Steps:**
  1. Navigate to Contributors section and use the add control to select a unit
    - expect: A dropdown or selector shows available units not already in the MSEL
  2. Select a unit to add
    - expect: The unit is added to the MSEL's contributor list
    - expect: The unit appears in the Contributors table

#### 5.3. Remove Unit from MSEL

**File:** `blueprint/tests/contributors-management/remove-unit-from-msel.spec.ts`

**Steps:**
  1. Navigate to Contributors section and click the delete icon for a unit row
    - expect: A confirmation dialog appears: 'Are you sure that you want to remove [unit name] from the MSEL?'
  2. Confirm removal
    - expect: The unit is removed from the MSEL
    - expect: The unit row is removed from the Contributors table

#### 5.4. Expand Unit to Manage User MSEL Roles

**File:** `blueprint/tests/contributors-management/expand-unit-to-manage-user-msel-roles.spec.ts`

**Steps:**
  1. Navigate to Contributors section and click on a unit row to expand it
    - expect: The row expands to show users in that unit
    - expect: Each user row shows checkboxes for MSEL roles: Editor, Approver, MoveEditor, Owner, Evaluator, Viewer
    - expect: CITE-related roles only appear if CITE is enabled; Gallery-related roles only if Gallery is enabled
    - expect: Role descriptions are shown: Editor (can edit scenario events), Approver (can approve events), MoveEditor (can modify move info), Owner (full control), Evaluator (can access view and mark items complete), Viewer (can only view MSEL Pages)
  2. Toggle a role checkbox for a user
    - expect: The role is assigned to or removed from the user for this MSEL
  3. Attempt to remove your own Owner role
    - expect: The Owner checkbox for the currently logged-in user is disabled
    - expect: User cannot remove their own Owner role

### 6. MSEL Playbook

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 6.1. View MSEL Playbook

**File:** `blueprint/tests/msel-playbook/view-msel-playbook.spec.ts`

**Steps:**
  1. Navigate to a MSEL and click 'MSEL Playbook' in the sidebar navigation
    - expect: The MSEL Playbook section loads
    - expect: Scenario events are displayed in a table format
    - expect: Each event page shows: Execution Time (absolute + offset), Move, Group, Integration Target, Control Number, Simulated Time, Status, Summary, From Org, To Org, Card Id, SourceType, Source Name, Delivery Method, and Description with rich text content
    - expect: Pagination controls are shown with 'Items per page' selector (default 1 per page)
    - expect: The paginator shows the current page range (e.g., '1 - 1 of 28')
  2. Navigate through pages using pagination controls
    - expect: Next page and Previous page buttons work correctly
    - expect: Page size can be changed
  3. Check if move boundaries are indicated
    - expect: Visual indicators show when events transition between moves

#### 6.2. Print MSEL Playbook

**File:** `blueprint/tests/msel-playbook/print-msel-playbook.spec.ts`

**Steps:**
  1. Navigate to MSEL Playbook and click 'Print MSEL Playbook' button
    - expect: The browser's print dialog opens
    - expect: The printable area content is prepared for printing

### 7. Event Detail Page

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 7.1. View Event Detail Page

**File:** `blueprint/tests/event-detail-page/view-event-detail-page.spec.ts`

**Steps:**
  1. Navigate to /eventdetail?msel={mselId}&scenarioEvent={eventId}
    - expect: The Event Detail page loads at the /eventdetail route
    - expect: The page title shows 'Scenario Event Details'
    - expect: A Blueprint topbar is displayed unless embedded in an iframe
    - expect: All data fields for the scenario event are shown
    - expect: Rich text content fields are rendered with HTML formatting
  2. Navigate with an additional ?dataValue={dataValueId} parameter
    - expect: The specific data value content is highlighted or directly shown
  3. Access the event detail page from a scenario event's 'open in new tab' button
    - expect: The page opens in a new browser tab
    - expect: The URL includes msel, scenarioEvent, and dataValue query parameters

### 8. Launch and Join Event Workflows

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 8.1. Launch New Event

**File:** `blueprint/tests/launch-and-join-workflows/launch-new-event.spec.ts`

**Steps:**
  1. Navigate to Event Dashboard and click 'Start an Event', then click 'Start' on a MSEL card
    - expect: Launch process begins
    - expect: Progress spinner is displayed on the card
    - expect: Launch status message is shown
    - expect: Other launch buttons are disabled during launch
  2. Wait for launch to complete
    - expect: MSEL status changes to 'Deployed'
    - expect: User is redirected to the event view
    - expect: Success notification is displayed

#### 8.2. Launch Loading State

**File:** `blueprint/tests/launch-and-join-workflows/launch-loading-state.spec.ts`

**Steps:**
  1. Start launching an event and observe the UI during a long launch
    - expect: Full-page loading card appears if launch takes long
    - expect: Loading card shows 'Launching your event!' title
    - expect: Message 'Please wait until you are redirected to the event.' is displayed
    - expect: Progress spinner is shown

#### 8.3. Join Active Event

**File:** `blueprint/tests/launch-and-join-workflows/join-active-event.spec.ts`

**Steps:**
  1. Navigate to Event Dashboard and click 'Join an Event', then click 'Join' on a MSEL card
    - expect: Join page displays with available MSELs to join
    - expect: Only MSELs with status 'Deployed' are shown
    - expect: User is redirected to the event participant view

#### 8.4. Manage Deployed Event

**File:** `blueprint/tests/launch-and-join-workflows/manage-deployed-event.spec.ts`

**Steps:**
  1. Navigate to build page and select a MSEL with status 'Deployed'
    - expect: MSEL details are shown with End Date/Time field and 'End Event' button
  2. Click 'End Event' button and confirm
    - expect: Event status changes from 'Deployed' to 'Complete' or 'Archived'
    - expect: Success notification is displayed

#### 8.5. Manage Event Access Control

**File:** `blueprint/tests/launch-and-join-workflows/manage-event-access-control.spec.ts`

**Steps:**
  1. Access manage page for a deployed MSEL as a non-owner without permissions
    - expect: 'You have nothing to manage.' message is displayed
    - expect: 'If you believe you should have permissions to manage this event, contact your administrator.' message is shown
    - expect: No management controls are visible

### 9. Admin - Units Management

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 9.1. Unit Lifecycle

**File:** `blueprint/tests/admin-units-management/unit-lifecycle.spec.ts`

**Steps:**
  1. Navigate to Admin > Units, click 'Add Unit', enter a Name and Short Name, and click 'Save'
    - expect: The dialog closes and searching for the name finds one row showing both names
  2. Click 'Edit' for the unit, change its Name, and click 'Save'
    - expect: The dialog is prefilled with the current values
    - expect: Searching finds the new name, and the old name matches nothing
  3. Click 'Delete' for the unit and answer 'No'
    - expect: The confirmation names the unit, and the row remains
  4. Click 'Delete' again and answer 'Yes'
    - expect: The row is removed
  5. Reload and search for the unit
    - expect: The deletion persists

#### 9.2. Search and Filter Units

**File:** `blueprint/tests/admin-units-management/search-and-filter-units.spec.ts`

**Steps:**
  1. Navigate to Units list and enter search term in search field
    - expect: Table filters to show matching units on Short Name and Name
  2. Click clear button
    - expect: All units are displayed again

#### 9.3. View and Manage Unit Users

**File:** `blueprint/tests/admin-units-management/view-and-manage-unit-users.spec.ts`

**Steps:**
  1. Seed a unit and a user. Navigate to Units, search for the unit, and click its row
    - expect: The row expands to show 'Users' (not in the unit) and 'Unit Members' tables
    - expect: Searching both tables shows the user under Users with an 'Add' button, and not under Unit Members
  2. Click 'Add' for the user
    - expect: The user moves from Users to Unit Members
  3. Reload and reopen the unit
    - expect: The membership persisted
  4. Click 'Remove' for the user
    - expect: The user leaves Unit Members and reappears under Users
  5. Click the unit row again
    - expect: The member panels collapse

### 10. Admin - Inject Types and Catalogs Management

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 10.1. Create Inject Type

**File:** `blueprint/tests/admin-inject-types-and-catalogs/create-inject-type.spec.ts`

**Steps:**
  1. Navigate to Inject Types admin section, click 'Add' button, enter a name and description, then click 'Save'
    - expect: Inject type is created and appears in the list

#### 10.2. Edit and Delete Inject Type

**File:** `blueprint/tests/admin-inject-types-and-catalogs/edit-and-delete-inject-type.spec.ts`

**Steps:**
  1. Click edit icon for an inject type, modify values, and save
    - expect: Inject type is updated
  2. Click delete icon and confirm
    - expect: Inject type is deleted

#### 10.3. Create Catalog

**File:** `blueprint/tests/admin-inject-types-and-catalogs/create-catalog.spec.ts`

**Steps:**
  1. Navigate to Catalogs admin section, click 'Add new Catalog', fill in name and select an inject type, then save
    - expect: Catalog is created successfully and appears in the list

#### 10.4. Upload Catalog from File

**File:** `blueprint/tests/admin-inject-types-and-catalogs/upload-catalog-from-file.spec.ts`

**Steps:**
  1. Click 'Upload a new catalog from a file' button and select a valid JSON file
    - expect: The catalog is uploaded and a new catalog entry appears in the list

#### 10.5. Download Catalog as JSON

**File:** `blueprint/tests/admin-inject-types-and-catalogs/download-catalog-as-json.spec.ts`

**Steps:**
  1. Click the download button for a catalog
    - expect: A JSON file is downloaded named '{catalogName}-catalog.json'
    - expect: The file contains the catalog data including its injects

#### 10.6. Copy Catalog

**File:** `blueprint/tests/admin-inject-types-and-catalogs/copy-catalog.spec.ts`

**Steps:**
  1. Click the Copy button for a catalog and confirm
    - expect: A copy of the catalog is created and appears in the list

#### 10.7. Expand Catalog to View Injects

**File:** `blueprint/tests/admin-inject-types-and-catalogs/expand-catalog-to-view-injects.spec.ts`

**Steps:**
  1. Navigate to Catalogs list and click on a catalog row
    - expect: The row expands to show the inject list for that catalog
  2. Click the same row again
    - expect: The row collapses

### 11. Scenario Events Management

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 11.1. View Scenario Events in MSEL

**File:** `blueprint/tests/scenario-events-management/view-scenario-events-in-msel.spec.ts`

**Steps:**
  1. Navigate to a MSEL and click 'Scenario Events' in the sidebar
    - expect: Scenario events are displayed in chronological order
    - expect: Each event shows: time, control number, from org, to org, description, details
    - expect: Events are color-coded based on their type

#### 11.2. Create Scenario Event

**File:** `blueprint/tests/scenario-events-management/create-scenario-event.spec.ts`

**Steps:**
  1. Click 'Add Event' or 'Create Scenario Event' button in the Scenario Events section
    - expect: A scenario event creation form is displayed
  2. Fill in event fields including Control Number, From Org, To Org, Description, time, delivery method, event type, then click 'Save'
    - expect: The scenario event is created successfully
    - expect: The event appears in the timeline/list at the correct position
    - expect: Event is displayed with its assigned color

#### 11.3. Edit Scenario Event

**File:** `blueprint/tests/scenario-events-management/edit-scenario-event.spec.ts`

**Steps:**
  1. Click on an event or its edit icon
    - expect: Event edit form is displayed with all fields populated
  2. Modify fields and click 'Save'
    - expect: The event is updated and reflected in the timeline

#### 11.4. Delete Scenario Event

**File:** `blueprint/tests/scenario-events-management/delete-scenario-event.spec.ts`

**Steps:**
  1. Click delete icon for a scenario event
    - expect: A confirmation dialog appears
  2. Cancel and verify event remains, then delete again and confirm
    - expect: The event is deleted and removed from the timeline

#### 11.5. Scenario Event Custom Data Fields

**File:** `blueprint/tests/scenario-events-management/scenario-event-custom-data-fields.spec.ts`

**Steps:**
  1. Navigate to Admin Data Fields and add a custom data field for scenario events with a specific data type
    - expect: Custom data field can be configured with name, data type, and display order
  2. Create a new scenario event
    - expect: The custom data field appears in the event creation form in display order position
    - expect: Field validates according to its data type

#### 11.6. Bulk Import Scenario Events

**File:** `blueprint/tests/scenario-events-management/bulk-import-scenario-events.spec.ts`

**Steps:**
  1. Click 'Import' or 'Upload Events' button in MSEL details and select a CSV or Excel file
    - expect: File is uploaded and validated
  2. Confirm import
    - expect: Events are imported
    - expect: Success notification shows number of events imported

#### 11.7. Export Scenario Events

**File:** `blueprint/tests/scenario-events-management/export-scenario-events.spec.ts`

**Steps:**
  1. Click 'Export' or download button and select a format
    - expect: File is generated and downloaded with all events and data fields

#### 11.8. Starter MSEL View

**File:** `blueprint/tests/scenario-events-management/starter-msel-view.spec.ts`

**Steps:**
  1. Navigate to /starter?msel={mselId}
    - expect: Starter page loads with Blueprint topbar
    - expect: Scenario event list is displayed in starter mode for direct editing

#### 11.9. Open Event in Detail Page

**File:** `blueprint/tests/scenario-events-management/open-event-in-detail-page.spec.ts`

**Steps:**
  1. In the Scenario Events list, find an event with rich text content and click the 'open in new tab' button for a data field
    - expect: The Event Detail page opens in a new browser tab at /eventdetail
    - expect: URL includes msel, scenarioEvent, and dataValue query parameters
    - expect: The data field content is displayed

#### 11.10. Scenario Event Color Coding

**File:** `blueprint/tests/scenario-events-management/scenario-event-color-coding.spec.ts`

**Steps:**
  1. Seed a MSEL with one scenario event and open Scenario Events
    - expect: The unhighlighted row has no background of its own
  2. Highlight the row with the first real colour from the Highlight menu (not the 'no colour' swatch)
    - expect: The row renders with exactly the swatch's computed background
  3. Reload the page
    - expect: The highlight is rendered from the stored row metadata
  4. Clear it with the 'no colour' swatch
    - expect: The row has no background again

### 12. Integration with Crucible Services

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 12.1. Gallery Integration Content Selection

**File:** `blueprint/tests/integration-with-crucible-services/gallery-integration-content-selection.spec.ts`

**Steps:**
  1. Create a scenario event with Gallery delivery method
    - expect: Gallery integration options are shown
  2. Select Gallery content items to associate with the event
    - expect: Content is linked to the scenario event

#### 12.2. CITE Integration Team Collaboration

**File:** `blueprint/tests/integration-with-crucible-services/cite-integration-team-collaboration.spec.ts`

**Steps:**
  1. Enable CITE integration on a MSEL Config tab
    - expect: CITE checkbox shows a 'Scoring Model:' display
  2. Check team configurations with CITE enabled when teams lack CITE Team Types
    - expect: Warning message if no teams have CITE Team Type: '** WARNING: No teams have a CITE Team Type selected, so no teams will be pushed to CITE! **'
    - expect: Error message if some teams are missing types: '** ERROR: [N] team(s) are missing a CITE Team Type. All teams must have a team type selected before pushing to CITE. **'
    - expect: Push Integrations is blocked if teams are missing CITE Team Types

#### 12.3. Gallery Integration Validation

**File:** `blueprint/tests/integration-with-crucible-services/gallery-integration-validation.spec.ts`

**Steps:**
  1. Configure data fields with Gallery Article Parameters and create Gallery scenario events with missing required data
    - expect: Gallery data fields show galleryArticleParameter assignment options
  2. Attempt to Push Integrations with incomplete Gallery event data
    - expect: Warning appended to push confirmation: '** WARNING: One or more Scenario Events marked as a Gallery integration is missing required fields. **'
    - expect: Push can still proceed after acknowledging the warning

#### 12.4. Player Integration View Association

**File:** `blueprint/tests/integration-with-crucible-services/player-integration-view-association.spec.ts`

**Steps:**
  1. Enable Player integration and associate a Player view with the MSEL
    - expect: Player view selector shows available views from Player service (http://localhost:4301)
  2. After deploying, view the MSEL Config tab
    - expect: Player view name is displayed next to the Player checkbox

#### 12.5. API Integration Blueprint API Endpoints

**File:** `blueprint/tests/integration-with-crucible-services/api-integration-blueprint-api-endpoints.spec.ts`

**Steps:**
  1. Perform various actions in Blueprint UI and observe network calls
    - expect: API calls are made to http://localhost:4724 (Blueprint API)
    - expect: Requests use proper authentication headers
    - expect: Responses are in expected JSON format
    - expect: Admin sidebar shows API version (e.g., 'Versions: UI 0.0.0, API 1.6.1')

#### 12.6. Integration In Progress Navigation Guard

**File:** `blueprint/tests/integration-with-crucible-services/integration-in-progress-navigation-guard.spec.ts`

**Steps:**
  1. Open a MSEL whose integration status is 'Pushing Integrations'
    - expect: The MSEL shows 'Processing integrations ...' with a 'Cancel Push' button
  2. Click the topbar home link and dismiss the browser confirmation
    - expect: A confirm dialog reads 'An integration push is in progress. Are you sure you want to leave?'
    - expect: The user stays on the MSEL's build page and the push status is still shown
  3. Repeat, accepting the confirmation
    - expect: The user is taken to the Event Dashboard
  4. Open a MSEL whose integration status is an ERROR and click the topbar home link
    - expect: 'Integration Failed' is shown instead of the in-progress status
    - expect: Navigation happens with no confirmation dialog

### 13. Real-time Collaboration and SignalR

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 13.1. Real-time MSEL Updates

**File:** `blueprint/tests/real-time-collaboration-and-signalr/real-time-msel-updates.spec.ts`

**Steps:**
  1. Open two browser windows both viewing the same MSEL, then create a new scenario event in window 1
    - expect: Window 2 receives real-time update via SignalR
    - expect: New event appears automatically without manual refresh

#### 13.2. SignalR Connection Establishment

**File:** `blueprint/tests/real-time-collaboration-and-signalr/signalr-connection-establishment.spec.ts`

**Steps:**
  1. Log in and navigate to a MSEL, then check console logs
    - expect: Console shows SignalR connection established (e.g., 'Information: WebSockets transport starting')
    - expect: No connection errors are displayed

### 14. Error Handling and Validation

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 14.1. API Error Display

**File:** `blueprint/tests/error-handling-and-validation/api-error-display.spec.ts`

**Steps:**
  1. Trigger an API error by creating MSEL with invalid data
    - expect: Error notification or message is displayed
    - expect: Error is clear and actionable

#### 14.2. Unauthorized Action Handling

**File:** `blueprint/tests/error-handling-and-validation/unauthorized-action-handling.spec.ts`

**Steps:**
  1. Sign in (from an empty storage state) as a fresh Keycloak user with no Blueprint permissions
    - expect: The dashboard offers no Join, Start, or Manage card
    - expect: Once permissions have loaded, the user menu has Logout but no Administration entry
  2. Navigate directly to /admin
    - expect: The shell renders, but the sidebar lists no sections and no section content is shown
  3. Navigate to /build
    - expect: The create and upload MSEL controls are disabled

#### 14.3. API Health Check Error

**File:** `blueprint/tests/error-handling-and-validation/api-health-check-error.spec.ts`

**Steps:**
  1. Navigate to build page when API is unavailable
    - expect: Application detects API health check failure
    - expect: Error message explains API unavailability
    - expect: 'Please refresh this page' message is shown

### 15. Export and Import

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 15.1. Export MSEL to Excel

**File:** `blueprint/tests/export-and-import/export-msel-to-excel.spec.ts`

**Steps:**
  1. Navigate to a MSEL and click the 'Download [MSEL name]' download icon
    - expect: MSEL xlsx file download begins
    - expect: File contains MSEL details and all scenario events

#### 15.2. Import MSEL from Excel

**File:** `blueprint/tests/export-and-import/import-msel-from-excel.spec.ts`

**Steps:**
  1. Navigate to MSELs list and click 'Upload a new MSEL from a file', select a valid xlsx file
    - expect: MSEL and events are created from Excel data
    - expect: New MSEL appears in the list

#### 15.3. Upload XLSX to Existing MSEL

**File:** `blueprint/tests/export-and-import/upload-xlsx-to-existing-msel.spec.ts`

**Steps:**
  1. In the MSELs list, click 'Upload .xlsx file to [MSEL name]' for an existing MSEL and select a valid xlsx file
    - expect: The file is uploaded and the existing MSEL is updated with new data

### 16. Accessibility and Usability

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 16.1. Keyboard Navigation

**File:** `blueprint/tests/accessibility-and-usability/keyboard-navigation.spec.ts`

**Steps:**
  1. Navigate to the /build MSEL list and press Tab twelve times from the top of the page
    - expect: Every Tab lands on a new, visible element (no focus traps, no hidden stops)
    - expect: The Search box is one of the stops
  2. Press Shift+Tab three times
    - expect: Focus retraces the forward order exactly
  3. Focus the Name column sort header and press Enter three times
    - expect: Each press changes the column's aria-sort, and both ascending and descending are reached
  4. Navigate to the Event Dashboard and Tab to the 'Manage an Event' card
    - expect: The card is reachable by keyboard
  5. Press Enter, then Space, on the focused card
    - expect: The card activates and navigates to /build (currently fails upstream: the cards only handle mouse clicks, so the spec asserts that no click fires)

#### 16.2. Loading States and Feedback

**File:** `blueprint/tests/accessibility-and-usability/loading-states-and-feedback.spec.ts`

**Steps:**
  1. Trigger an action that takes time (e.g., push integrations, launch event)
    - expect: Loading indicator or status message is displayed
    - expect: Submit button is disabled during processing
    - expect: Push status message shows 'Pushing Integrations' then clears when done
  2. Wait for action to complete
    - expect: Loading indicator disappears
    - expect: Success or error message is displayed
#### 16.3. Color Contrast Compliance

**File:** `blueprint/tests/accessibility-and-usability/color-contrast-compliance.spec.ts`

**Steps:**
  1. Seed a MSEL with one scenario event. In the current theme, run axe-core's color-contrast rule on the Event Dashboard, the /build list, the MSEL's Info section, its Scenario Events grid, and Administration
    - expect: Each screen has zero contrast violations
    - expect: Each screen has passing nodes, so a blank page cannot pass
  2. Switch theme from the user menu and repeat the sweep
    - expect: The same holds in the other theme

### 17. Admin - Competencies and Proficiency

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 17.1. Proficiency Scale and Level Management

**File:** `blueprint/tests/admin-competencies-and-proficiency/proficiency-scales-and-levels.spec.ts`

**Steps:**
  1. Navigate to Admin → 'Proficiency Scales', click 'Add proficiency scale', enter a name and Save
    - expect: Save is disabled until a name is entered
    - expect: Searching for the scale shows one row with 0 levels
  2. Expand the scale and add levels 'Novice' and 'Expert'
    - expect: The levels panel starts with "No levels defined", then lists both levels and the count updates
  3. Edit 'Novice' to 'Beginner', then delete 'Expert'
    - expect: The table reflects each change
  4. Click 'Delete Scale', answer No, then repeat and answer Yes
    - expect: No keeps the scale; Yes removes it from the table

#### 17.2. Competency Framework Lifecycle

**File:** `blueprint/tests/admin-competencies-and-proficiency/competency-framework-lifecycle.spec.ts`

**Steps:**
  1. Navigate to Admin → 'Competencies', click 'Add new competency framework', fill in Name, Version, Source, Description, pick a Proficiency Scale and Save
    - expect: Save is disabled until a name is entered
    - expect: The row shows each field, with the scale shown by name
    - expect: A search that matches nothing shows "No Competency Frameworks found"
  2. Edit the framework and change its Version
    - expect: The dialog opens pre-filled and the row shows the new version
  3. Expand the row and add a Knowledge competency
    - expect: Choosing the Type pre-fills the ID Number with 'K'
    - expect: The competency appears under 'Competencies (1)' with type Knowledge
  4. Add a work role from the Work Roles panel
    - expect: Type is locked and the ID Number is pre-filled with 'WRL-'
    - expect: The work role appears under Work Roles only
  5. Delete the competency (No, then Yes)
    - expect: No keeps it; Yes shows "No competencies found"
  6. Delete the framework
    - expect: The confirmation gives the number of competencies that will be deleted (currently always reads 0 — pending upstream)
    - expect: The row is removed
  7. With a framework whose competency is in a MSEL pool, view its row
    - expect: The delete button is disabled and its tooltip reads "In use by 1 MSEL(s): <name>"
    - expect: After the MSEL is deleted and the page reloads, the button is enabled with tooltip "Delete framework"

#### 17.3. Import and Download Competency Frameworks

**File:** `blueprint/tests/admin-competencies-and-proficiency/competency-framework-import.spec.ts`

**Steps:**
  1. Open the Import dialog and choose a .txt file
    - expect: Import is disabled and "Supported formats: .csv (Moodle), .json (NICE), .xlsx (DCWF)" is shown
  2. Choose a Blueprint framework JSON export
    - expect: The preview shows the framework name, Source, Version, "Competencies to import: 3" and "Relationships: 2"
    - expect: Cancel imports nothing
  3. Choose an export whose framework ID number already exists
    - expect: A conflict error names the existing framework and version, and no counts are shown
  4. Import the file
    - expect: A progress bar and status reach 'Complete' / 100% from polling
    - expect: The dialog then shows "Successfully imported <name>" with only a Close button
    - expect: The table lists the framework with the file's Source and Version, and 1 work role and 2 competencies
  5. Click a framework row's Download button
    - expect: A file named "<name>-<version>.json" downloads, containing the framework and its competencies

#### 17.4. MSEL Competency Pool

**File:** `blueprint/tests/admin-competencies-and-proficiency/msel-competency-pool.spec.ts`

**Steps:**
  1. Open a MSEL's Competencies tab while its pool is empty
    - expect: "No competencies associated with this MSEL." and "MSEL Competencies (0)"
    - expect: The Add Competencies panel is open and asks for a framework
  2. Choose a framework in 'Competency Framework'
    - expect: Only its work roles are listed
  3. Expand a work role
    - expect: Its child competencies are listed with their types (Task, Knowledge)
    - expect: A work role with no children shows "No related competencies in framework"
  4. Check one child, then use Select All, then check the work role
    - expect: The pool count goes 1 → 2 → 3
    - expect: Select All is shown as partly selected after the first child is checked
    - expect: Pool rows show ID, Type, "<framework> (<version>)", Name, "—" for teams and 0 events
  5. Uncheck a pooled child in the browser (No, then Yes)
    - expect: The "Remove Competency" confirmation names the competency; No keeps it, Yes removes it
    - expect: After No, the checkbox is ticked again (currently it stays unticked until the work role is collapsed and re-expanded — pending upstream)
  6. Remove a row with its 'Remove from MSEL' button, then select the last row and click 'Remove 1'
    - expect: Each removal is confirmed, and the pool ends empty

#### 17.5. Propagate Team Assignments to Related Competencies

**File:** `blueprint/tests/admin-competencies-and-proficiency/team-competency-propagate.spec.ts`

**Steps:**
  1. In a MSEL with a team and a pooled work role plus two pooled children, expand the work role's pool row
    - expect: "Assigned (0)" and "No teams assigned"
  2. Click 'Add <team>'
    - expect: "Add Team from Related" lists both children, pre-selected, with 'Yes (2)'
    - expect: Unchecking changes the count to 'Yes (1)'; with none selected, 'Yes (0)' is disabled
  3. Confirm with one child selected
    - expect: The Teams column shows the team on the work role and that child, and "—" on the other child
  4. Click 'Remove <team>' on the work role and answer No
    - expect: "Remove Team from Related" lists only the child that has the team
    - expect: The team is removed from the work role only
  5. Add the team to a competency that has no pooled children
    - expect: It is assigned without a dialog

### 18. Reordering

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 18.1. Scenario Event Drag and Drop Reordering

**File:** `blueprint/tests/reordering/scenario-event-drag-reorder.spec.ts`

**Steps:**
  1. Open a MSEL's Scenario Events with three events at different times
    - expect: Events are listed chronologically and each row has a drag handle
  2. Drag the third event onto the second event's row
    - expect: The event is saved and the grid shows it between the other two
    - expect: The event's time is moved to midway between its new neighbours
  3. Reload the page
    - expect: The new order is still shown
  4. Sort the grid by Description, then clear the sort
    - expect: Drag handles are hidden while sorted and return once the sort is cleared

#### 18.2. Data Field Drag and Drop Reordering

**File:** `blueprint/tests/reordering/data-field-drag-reorder.spec.ts`

**Steps:**
  1. Open a MSEL's Data Fields with the standard fields
    - expect: The four system-defined rows (Move, Group, Execution Time, Integration Target) come first and have no drag handle
    - expect: The MSEL's own fields follow in display order, each with a drag handle
  2. Drag 'Title' onto the second row
    - expect: The field is saved, 'Title' is second, and the fields it passed shift down one
  3. Reload the page
    - expect: The new order is still shown
  4. Sort by Name, then clear the sort
    - expect: The list is alphabetical with no drag handles, then returns to display order with handles
    - expect: System-defined rows stay first and unsorted

#### 18.3. Player Application Team Order

**File:** `blueprint/tests/reordering/player-team-app-order.spec.ts`

**Steps:**
  1. On a Player-enabled MSEL with a team assigned two applications, open Player Apps > Team Application Order and click the team
    - expect: Both applications are listed with display orders 1 and 2
    - expect: 'Move player application up' is disabled on the first; 'Move player application down' is disabled on the last
  2. Click 'Move player application down' on the first application
    - expect: The change is saved and the two applications swap places and numbers
  3. Reload and reopen the team
    - expect: The new order is still shown

### 19. Player Applications

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 19.1. Player Apps Section Gating

**File:** `blueprint/tests/player-applications/player-application-crud.spec.ts`

**Steps:**
  1. Open a MSEL with usePlayer off
    - expect: No 'Player Apps' section in the sidebar
  2. Turn usePlayer on and reopen the MSEL
    - expect: 'Player Apps' section is offered

#### 19.2. Create Player Application with URL Validation

**File:** `blueprint/tests/player-applications/player-application-crud.spec.ts`

**Steps:**
  1. Player Apps → expand 'Player Applications' → Add → 'New Player Application'
    - expect: Dialog 'Add a Player Application'; Embeddable checked, Load in Background unchecked
  2. Enter a URL with an unknown variable and Save
    - expect: 'Unknown variable(s): {notAVariable}'; dialog stays open
  3. Enter a URL with an unpaired brace, then a bad Icon URL, and Save
    - expect: 'URL contains unpaired or invalid braces'; dialog stays open
  4. Enter valid URL/Icon URL using {blueprintMselId}/{playerViewId}/{galleryUrl}, check Load in Background, Save
    - expect: Row shows name and unsubstituted URL; values persisted

#### 19.3. Edit and Delete Player Application

**File:** `blueprint/tests/player-applications/player-application-crud.spec.ts`

**Steps:**
  1. Edit a seeded application
    - expect: Dialog 'Edit Player Application' prefilled with current values
  2. Rename, change URL, uncheck Embeddable, Save
    - expect: Row shows new name/URL; old name gone; changes persisted
  3. Delete it and confirm YES (and, separately, answer NO)
    - expect: 'Delete PlayerApplication' confirmation names the app; YES removes the row, NO keeps it
  4. With two seeded applications, sort by Name twice, then by URL twice
    - expect: Name sorts ascending then descending
    - expect: URL sorts by URL in each direction (currently sorts by name — pending upstream)

#### 19.4. Assign Player Application to Teams

**File:** `blueprint/tests/player-applications/player-application-teams.spec.ts`

**Steps:**
  1. Expand an application row
    - expect: 'MSEL Teams' lists every team; 'Player Application Teams' is empty
  2. Click 'Add Alpha Team'
    - expect: ALPHA moves to 'Player Application Teams'; assignment persists across reload
  3. Click the ALPHA remove button
    - expect: ALPHA returns to 'MSEL Teams'; assignment deleted

#### 19.5. Search MSEL Teams

**File:** `blueprint/tests/player-applications/player-application-teams.spec.ts`

**Steps:**
  1. Type 'charlie' in the MSEL Teams search
    - expect: Only Charlie Team offered; Clear Search enabled
  2. Type a non-matching term
    - expect: 'No teams found'
  3. Click Clear Search
    - expect: Box empties and all teams return
  4. Search for 'bravo' and assign Bravo Team
    - expect: The box still says 'bravo' and the list stays filtered (currently shows every remaining team — pending upstream)

#### 19.6. Add Player Application from Template

**File:** `blueprint/tests/player-applications/player-application-templates.spec.ts`

**Steps:**
  1. Seed a Player application template; open Add menu
    - expect: Template listed, titled with its URL
  2. Pick it
    - expect: Dialog prefilled with template name, URL, icon, Embeddable, Load in Background
  3. Save
    - expect: A new MSEL application (not the template id) is listed and persisted
  4. Pick a template whose URL uses {viewId} and Save
    - expect: 'Unknown variable(s): {viewId}' (pending upstream); after changing to {playerViewId} it saves

### 20. Invitations

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 20.1. Create Invitation with Validation

**File:** `blueprint/tests/invitations/invitation-crud.spec.ts`

**Steps:**
  1. Invitations section of a MSEL with no invitations
    - expect: 'No invitations found'
  2. Click 'Add an invitation'
    - expect: 'Create an Invitation to this MSEL'; max uses '1'; expiration shown; team-leader option disabled; Save disabled
  3. Choose team ALPHA; try domains 'abcd.test', '@ab', '@abc.test'
    - expect: Save enabled only with a team and a domain longer than 3 characters containing '@'
  4. Set max uses 4 and Save
    - expect: Row ALPHA / @abc.test / expiration / 4 / 4; persisted

#### 20.2. Invitation Link Availability

**File:** `blueprint/tests/invitations/invitation-crud.spec.ts`

**Steps:**
  1. View an invitation on a Pending MSEL
    - expect: Copy Invitation Link disabled with an empty link
  2. Deploy the MSEL and reopen
    - expect: Copy enabled; link carries msel and team ids (path '//join/', pending upstream)

#### 20.3. Edit Invitation

**File:** `blueprint/tests/invitations/invitation-crud.spec.ts`

**Steps:**
  1. Edit a seeded invitation
    - expect: 'Edit an Invitation to this MSEL'; team shown as text, not selectable; fields prefilled
  2. Change domain and max uses, Save
    - expect: Row shows new domain, max and remaining uses; persisted (currently typing throws a read-only-property TypeError, and Save keeps the original values — pending upstream)

#### 20.4. Search Invitations

**File:** `blueprint/tests/invitations/invitation-crud.spec.ts`

**Steps:**
  1. Search by email domain, then by team short name
    - expect: Only matching invitations listed
  2. Search a non-matching term, then Clear Search
    - expect: 'No invitations found', then the full list returns

#### 20.5. Delete Invitation

**File:** `blueprint/tests/invitations/invitation-crud.spec.ts`

**Steps:**
  1. Delete an invitation and answer NO
    - expect: Confirmation names the domain; invitation kept
  2. Delete again and answer YES
    - expect: Only that invitation removed

#### 20.6. Join Through an Invitation Link

**File:** `blueprint/tests/invitations/invitation-join.spec.ts`

**Steps:**
  1. Admin copies the ALPHA invitation link (domain @test.local, 2 uses) of a Deployed MSEL
  2. A temporary user follows the link in a fresh context and signs in
    - expect: Browser is sent to Player at /view/<playerViewId>
  3. Admin reopens Invitations
    - expect: ALPHA remaining uses 1; other invitation unchanged
  4. Temporary user opens /join
    - expect: The MSEL is offered with a Join button

#### 20.7. Invitation Domain Mismatch

**File:** `blueprint/tests/invitations/invitation-join.spec.ts`

**Steps:**
  1. Temporary user follows a link whose invitation requires @elsewhere.test
    - expect: Error names the user's email and the required domain; user stays in Blueprint
    - expect: The invitation's remaining uses are unchanged

### 21. Assessor Page

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 21.1. No Assessor-visible Fields

**File:** `blueprint/tests/assessor-page/assessor-page.spec.ts`

**Steps:**
  1. Open /assess?msel=<id> for a MSEL with no assessor-visible fields
    - expect: 'No data fields are marked as assessor-visible.'; no event rows

#### 21.2. Events by Move and Group

**File:** `blueprint/tests/assessor-page/assessor-page.spec.ts`

**Steps:**
  1. Open /assess for a MSEL with one move, two assessor-visible fields, one hidden field, two events
    - expect: Columns are the visible fields in display order; hidden field and its values absent
    - expect: 'Move 1' header with description, 'Group 0' and 'Group 1' headers, events numbered 1 and 2

#### 21.3. Expand and Collapse

**File:** `blueprint/tests/assessor-page/assessor-page.spec.ts`

**Steps:**
  1. Click an event row, then click again
    - expect: Detail shows 'No xAPI statements found for this event.' and 'No competencies on this event.'; second click closes it
  2. Expand All, then Collapse All
    - expect: All move/group/event details open (Expand All disabled), then all close (Collapse All disabled)

#### 21.4. Search Events

**File:** `blueprint/tests/assessor-page/assessor-page.spec.ts`

**Steps:**
  1. Search Events and type the second event's note
    - expect: Only that event remains, under its move
  2. Type a value held only in the hidden field
    - expect: No events
  3. Clear Search
    - expect: Search row hidden; all events return

#### 21.5. Tick Assessor Checkbox

**File:** `blueprint/tests/assessor-page/assessor-page.spec.ts`

**Steps:**
  1. As admin, tick an event's Checkbox field
    - expect: Ticked without expanding the row; persists across reload; other event unticked
  2. Untick it
    - expect: Value saved as false

#### 21.6. Access by MSEL Role

**File:** `blueprint/tests/assessor-page/assessor-page.spec.ts`

**Steps:**
  1. Temporary user with no MSEL role opens /assess
    - expect: 'Access Denied' with the Editor-role explanation after roles load
  2. Add the user to a unit attached to the MSEL (a MSEL role alone grants no API reads), grant Editor and reload
    - expect: Events visible; checkboxes disabled
  3. Replace with Owner and reload
    - expect: Checkboxes enabled; ticking one persists
    - note: Evaluator is the intended role here, but the page and the API disagree on what an Evaluator may do (pending upstream)

### 22. Data Fields and Options

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 22.1. Add a Data Field

**File:** `blueprint/tests/data-fields-and-options/data-field-edit-dialog.spec.ts`

**Steps:**
  1. Open a MSEL's Data Fields section
    - expect: System-defined rows (Move, Group, Execution Time, Integration Target) show '*System Defined*' and have no Edit/Delete actions
  2. Click 'Add data Field' → 'New Data Field'
    - expect: 'Add a Data Field' dialog opens with Display Order one past the existing fields, and 'Display on the Events list', 'Display on the Exercise View' and 'Display on "Default" edit tab' checked
    - expect: Save is disabled without a Name, and with a Display Order of 0 or empty
  3. Enter a name, choose Integer, and Save
    - expect: The field appears in the grid with its order and type
    - expect: The field is a column of the Scenario Events grid and a text input on the Edit Event dialog's Default tab

#### 22.2. Edit and Delete a Data Field

**File:** `blueprint/tests/data-fields-and-options/data-field-edit-dialog.spec.ts`

**Steps:**
  1. Click 'Edit {name}' on a field
    - expect: 'Edit Data Field' dialog opens prefilled; clearing Name disables Save
  2. Rename and Save
    - expect: The grid shows the new name and not the old one
  3. Click 'Delete {name}' and answer No
    - expect: 'Delete Data Field' asks 'Are you sure that you want to delete {name}?'; the field remains
  4. Delete again and answer Yes
    - expect: The field is removed from the grid and from the Scenario Events columns

#### 22.3. Data Type Drives the Option-List Controls

**File:** `blueprint/tests/data-fields-and-options/data-field-edit-dialog.spec.ts`

**Steps:**
  1. In the Add dialog choose DateTime, Boolean and Html in turn
    - expect: 'Use Option List' is disabled
  2. Choose String and check 'Use Option List'
    - expect: 'Multi-select' appears unchecked and a '0 options' link is shown
  3. Switch to DateTime
    - expect: Both checkboxes are disabled and the options link is hidden
  4. Choose Competency
    - expect: 'Use Option List' and 'Multi-select' are checked and locked, 'Facilitation Data Field' is checked, the link reads 'Manage', and Save is disabled until a competency is chosen
  5. Cancel
    - expect: No field is added

#### 22.4. Manage Options in the Edit Data Field Dialog

**File:** `blueprint/tests/data-fields-and-options/data-option-list-dialog.spec.ts`

**Steps:**
  1. Edit an option-list field and click its 'N options' link
    - expect: 'Manage Options (N)' lists options by display order
  2. Add an option ('Add new option')
    - expect: 'Edit Option' proposes the next display order; Save needs both ID and Name; the title count increases
  3. Edit an option and delete another
    - expect: The table and title update; no request is sent while the field dialog is open
  4. Close and Save the field
    - expect: The field is saved once; the Edit Event dialog offers exactly the current option IDs in a drop-down

#### 22.5. Browse Options from the Data Fields Grid

**File:** `blueprint/tests/data-fields-and-options/data-option-list-dialog.spec.ts`

**Steps:**
  1. Click a field's 'N options' cell
    - expect: 'Manage Options (N)' opens; search filters by ID or description, case-insensitively; clicking the ID header sorts by ID
  2. Add, edit, delete and import options
    - expect: Each change is saved to the field (currently each fails with a TypeError alert and nothing is saved; see BP-DF3)

#### 22.6. Cancel Discards Option Changes

**File:** `blueprint/tests/data-fields-and-options/data-option-list-dialog.spec.ts`

**Steps:**
  1. In the Edit Data Field dialog delete an option, close the list, then Cancel
    - expect: The link showed one fewer option, but the grid, the reopened list and the stored field keep all options; no update is sent

#### 22.7. Option-List Fields in the Event Editor

**File:** `blueprint/tests/data-fields-and-options/data-option-list-dialog.spec.ts`

**Steps:**
  1. Open Edit Event for a MSEL with Integer and Double option-list fields
    - expect: Each renders as a drop-down only (currently the Double field also renders a stray text input; see BP-DF1)

#### 22.8. Import Options from a File

**File:** `blueprint/tests/data-fields-and-options/data-option-import-dialog.spec.ts`

**Steps:**
  1. From the Manage Options dialog click the import button
    - expect: 'Import Options' shows the supported-formats instructions, a 'Choose File' button and a disabled 'Import 0 Options'
  2. Choose a CSV whose rows include an existing ID in different case
    - expect: The file name and 'Preview (X to import, Y to skip)' are shown; the existing row is disabled and unchecked
  3. Uncheck a row, then use the header checkbox
    - expect: Counts and the 'Import N Option(s)' label update; the header box is indeterminate for a partial selection and never selects the existing row
  4. Import, then Save the field
    - expect: New options are appended after the existing ones, which are unchanged

#### 22.9. Import File Errors

**File:** `blueprint/tests/data-fields-and-options/data-option-import-dialog.spec.ts`

**Steps:**
  1. Choose a CSV with only a header row
    - expect: 'CSV file must have a header row and at least one data row.' is shown and nothing can be imported
  2. Choose a valid CSV with the columns in a different order
    - expect: The error clears and the preview maps columns by header
  3. Cancel
    - expect: No options are added

#### 22.10. Import into an Unsaved Field

**File:** `blueprint/tests/data-fields-and-options/data-option-import-dialog.spec.ts`

**Steps:**
  1. In a new String field with 'Use Option List', open the options list and click import
    - expect: The field is created first, then 'Import Options' opens
  2. Import options, close the list, and Save
    - expect: The link shows the imported count; Save stores them, and the grid has one row for the field

### 23. Admin - Gallery Cards and CITE

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 23.1. Gallery Card Template Lifecycle

**File:** `blueprint/tests/admin-gallery-and-cite/gallery-card-templates.spec.ts`

**Steps:**
  1. Navigate to Admin 'Gallery Cards', click 'Add a template card', enter a Name and Card Description, and click 'Save'
    - expect: The dialog offers no Move picker
    - expect: Searching by the description lists the new template
  2. Edit the card, change the description, press Escape, then click 'Cancel'
    - expect: Escape does not close the dialog while there are unsaved changes
    - expect: Cancel discards the change
  3. Edit the description again and click 'Save'
    - expect: A search for the old description no longer matches; a search for the new one does
  4. Delete the card, answer 'No', then repeat and answer 'Yes'
    - expect: Declining keeps the row; confirming removes it

#### 23.2. MSEL Gallery Cards and Card Teams

**File:** `blueprint/tests/admin-gallery-and-cite/msel-gallery-cards.spec.ts`

**Steps:**
  1. Open a MSEL that does not use Gallery, then enable Gallery and reopen it
    - expect: The 'Gallery Cards' section appears only once Gallery is enabled
  2. In Gallery Cards, open 'Add card' and choose a template, pick Move 2, and click 'Save'
    - expect: The menu offers 'New Card' plus each template, and the template pre-fills Name and Description
    - expect: The card is listed with Move 2
  3. Click the card row, add a MSEL team, toggle 'Is Shown', then remove the team
    - expect: The team moves between the MSEL-teams list and the card-teams list
  4. Delete the card
    - expect: The card is removed and the template is still offered in the add menu

#### 23.3. CITE Actions

**File:** `blueprint/tests/admin-gallery-and-cite/cite-actions.spec.ts`

**Steps:**
  1. In Admin 'CITE Actions', add a template, then edit it and delete it
    - expect: The dialog has no Move, Team or Display Order fields, and Save is disabled until a description is entered
  2. In a MSEL with CITE enabled, 2 teams and 2 moves, add a new CITE action with 'All Moves' and 'All Teams'
    - expect: 4 rows are created, one per team per move
  3. Use the Move and Team filters, then search by a team's short name
    - expect: Each narrows the list client-side
  4. Delete one row
    - expect: Only that row is removed

#### 23.4. CITE Duties

**File:** `blueprint/tests/admin-gallery-and-cite/cite-duties.spec.ts`

**Steps:**
  1. In Admin 'CITE Duties', add a template, then edit it and delete it
    - expect: Save is disabled while the Name is empty, including when an edit clears it
  2. In a MSEL with CITE enabled and 2 teams, add a new CITE duty with 'All Teams'
    - expect: 2 rows are created, each showing 'shortName - name' for its team
  3. Filter by one team, then edit that duty
    - expect: The filter narrows the list, and the edit dialog lists the MSEL's teams without 'All Teams'
  4. Delete the duty
    - expect: The duty is removed

### 24. Admin - Groups

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 24.1. Group Lifecycle With Membership

**File:** `blueprint/tests/admin-groups/group-lifecycle.spec.ts`

**Steps:**
  1. Navigate to Admin 'Groups', click the add button, enter a name, and click 'Save'
    - expect: 'Create New Group?' is shown and Save is disabled until a name is entered
    - expect: Searching 'Search Groups' lists the new group
  2. Click 'Rename', then click 'Cancel'; click 'Rename' again, enter a new name, and click 'Save'
    - expect: The dialog opens pre-filled, with Save disabled until the name changes
    - expect: The old name no longer matches the search and the new one does
  3. Expand the group row, search for a user in the Users panel, click 'Add <user>', then click 'Remove <user>'
    - expect: The group starts with 'This Group currently has no members'
    - expect: The user moves into Group Members, then back into Users
  4. Delete the group and confirm with 'Delete'
    - expect: The confirmation reads 'Delete Group <name>?' and the group is removed
