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
  1. Log in as admin user and click user menu, select 'Administration'
    - expect: Navigation to /admin occurs
    - expect: The admin interface loads with sidebar navigation
    - expect: Admin sections are visible: Units, Data Fields, Inject Types, Catalogs, Organizations, Gallery Cards, CITE Actions, CITE Duties, Users, Roles, Groups
    - expect: A version display at the bottom of the admin sidebar shows 'Versions: UI 0.0.0, API 1.6.1' or similar

#### 2.6. Theme Toggle Light Dark Mode

**File:** `blueprint/tests/event-dashboard-and-navigation/theme-toggle-light-dark-mode.spec.ts`

**Steps:**
  1. Navigate to Event Dashboard and click user menu, toggle 'Dark Theme' switch
    - expect: The application theme switches between light and dark mode
    - expect: Theme preference is saved in local storage
  2. Refresh the page
    - expect: The selected theme persists after page reload

#### 2.7. Dashboard Loading State

**File:** `blueprint/tests/event-dashboard-and-navigation/dashboard-loading-state.spec.ts`

**Steps:**
  1. Navigate to Event Dashboard immediately after login
    - expect: During data initialization, a loading card is displayed
    - expect: Loading card shows 'Initializing Data' title with 'Please wait ...' subtitle
    - expect: A progress spinner is visible
    - expect: After data loads, dashboard shows available cards

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
  1. Navigate to an existing MSEL Config tab and type in the Name field
    - expect: A character counter is shown (e.g., '31 / 70 characters')
    - expect: The maximum allowed name length is 70 characters
  2. Type in the Description field
    - expect: A character counter is shown (e.g., '176 / 600 characters')
    - expect: The maximum allowed description length is 600 characters
  3. Try to save with an empty name field
    - expect: Validation error is displayed
    - expect: Form submission is prevented

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

#### 9.1. View Units List

**File:** `blueprint/tests/admin-units-management/view-units-list.spec.ts`

**Steps:**
  1. Navigate to Admin section and select 'Units'
    - expect: Units list is displayed in a table format with Short Name and Name columns
    - expect: Search functionality is available
    - expect: Pagination controls are visible
    - expect: Edit and Delete action buttons are shown

#### 9.2. Create New Unit

**File:** `blueprint/tests/admin-units-management/create-new-unit.spec.ts`

**Steps:**
  1. Navigate to Units admin section and click 'Add Unit' button, enter 'CU' in Short Name and 'Cyber Unit' in Name, then click 'Save'
    - expect: Unit is created successfully
    - expect: New unit appears in the units table

#### 9.3. Edit Unit

**File:** `blueprint/tests/admin-units-management/edit-unit.spec.ts`

**Steps:**
  1. Navigate to Units list and click edit icon for a unit, modify details, and click 'Save'
    - expect: Unit is updated successfully
    - expect: Changes are reflected in the table

#### 9.4. Delete Unit

**File:** `blueprint/tests/admin-units-management/delete-unit.spec.ts`

**Steps:**
  1. Navigate to Units list and click delete icon for a unit, then confirm
    - expect: Unit is deleted successfully and removed from table

#### 9.5. Search and Filter Units

**File:** `blueprint/tests/admin-units-management/search-and-filter-units.spec.ts`

**Steps:**
  1. Navigate to Units list and enter search term in search field
    - expect: Table filters to show matching units on Short Name and Name
  2. Click clear button
    - expect: All units are displayed again

#### 9.6. View and Manage Unit Users

**File:** `blueprint/tests/admin-units-management/view-and-manage-unit-users.spec.ts`

**Steps:**
  1. Navigate to Units list and click on a unit row to expand it
    - expect: Row expands to show users assigned to this unit
    - expect: If user has manage permissions, can add/remove users from unit
  2. Click on the same row again
    - expect: Row collapses

### 10. Admin - Inject Types and Catalogs Management

**Seed:** `/mnt/data/crucible-tests/blueprint/tests/seed.setup.ts`

#### 10.1. View Inject Types List

**File:** `blueprint/tests/admin-inject-types-and-catalogs/view-inject-types-list.spec.ts`

**Steps:**
  1. Navigate to Admin section and select 'Inject Types'
    - expect: Inject Types list is displayed with Name and Description columns
    - expect: Search functionality is available
    - expect: Add, Edit, and Delete buttons are available

#### 10.2. Create Inject Type

**File:** `blueprint/tests/admin-inject-types-and-catalogs/create-inject-type.spec.ts`

**Steps:**
  1. Navigate to Inject Types admin section, click 'Add' button, enter a name and description, then click 'Save'
    - expect: Inject type is created and appears in the list

#### 10.3. Edit and Delete Inject Type

**File:** `blueprint/tests/admin-inject-types-and-catalogs/edit-and-delete-inject-type.spec.ts`

**Steps:**
  1. Click edit icon for an inject type, modify values, and save
    - expect: Inject type is updated
  2. Click delete icon and confirm
    - expect: Inject type is deleted

#### 10.4. View Catalogs List

**File:** `blueprint/tests/admin-inject-types-and-catalogs/view-catalogs-list.spec.ts`

**Steps:**
  1. Navigate to Admin section and select 'Catalogs'
    - expect: Catalogs list is displayed with columns: Public (checkbox), Name, Inject Type, Description
    - expect: Search functionality is available
    - expect: Actions include: Add new Catalog button, Upload a new catalog from a file button
    - expect: For each catalog row: Download (JSON), Upload xlsx, Delete, and Copy action buttons

#### 10.5. Create Catalog

**File:** `blueprint/tests/admin-inject-types-and-catalogs/create-catalog.spec.ts`

**Steps:**
  1. Navigate to Catalogs admin section, click 'Add new Catalog', fill in name and select an inject type, then save
    - expect: Catalog is created successfully and appears in the list

#### 10.6. Upload Catalog from File

**File:** `blueprint/tests/admin-inject-types-and-catalogs/upload-catalog-from-file.spec.ts`

**Steps:**
  1. Click 'Upload a new catalog from a file' button and select a valid JSON file
    - expect: The catalog is uploaded and a new catalog entry appears in the list

#### 10.7. Download Catalog as JSON

**File:** `blueprint/tests/admin-inject-types-and-catalogs/download-catalog-as-json.spec.ts`

**Steps:**
  1. Click the download button for a catalog
    - expect: A JSON file is downloaded named '{catalogName}-catalog.json'
    - expect: The file contains the catalog data including its injects

#### 10.8. Copy Catalog

**File:** `blueprint/tests/admin-inject-types-and-catalogs/copy-catalog.spec.ts`

**Steps:**
  1. Click the Copy button for a catalog and confirm
    - expect: A copy of the catalog is created and appears in the list

#### 10.9. Expand Catalog to View Injects

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

#### 14.2. Required Field Validation

**File:** `blueprint/tests/error-handling-and-validation/required-field-validation.spec.ts`

**Steps:**
  1. Leave required fields empty in any form and attempt to submit
    - expect: Validation errors are displayed for each required field
    - expect: Form submission is prevented

#### 14.3. Unauthorized Action Handling

**File:** `blueprint/tests/error-handling-and-validation/unauthorized-action-handling.spec.ts`

**Steps:**
  1. Log in as a user without admin permissions and attempt to access admin-only features
    - expect: Access is denied with appropriate error message
    - expect: Admin menu option is not visible if user lacks permissions

#### 14.4. API Health Check Error

**File:** `blueprint/tests/error-handling-and-validation/api-health-check-error.spec.ts`

**Steps:**
  1. Navigate to build page when API is unavailable
    - expect: Application detects API health check failure
    - expect: Error message explains API unavailability
    - expect: 'Please refresh this page' message is shown

#### 14.5. MSEL Character Limit Validation

**File:** `blueprint/tests/error-handling-and-validation/msel-character-limit-validation.spec.ts`

**Steps:**
  1. Navigate to a MSEL Config tab and observe character counts while typing
    - expect: Name field shows character counter (e.g., '31 / 70 characters') with 70 character maximum
    - expect: Description field shows character counter (e.g., '176 / 600 characters') with 600 character maximum
    - expect: Attempting to exceed limits is prevented or shows a validation error

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
  1. Navigate to Event Dashboard and use Tab key to navigate through interactive elements
    - expect: Focus moves sequentially through all interactive elements
    - expect: Focus indicator is clearly visible
    - expect: Dashboard cards are accessible via keyboard
  2. Use Enter or Space to activate focused cards
    - expect: Cards respond to keyboard activation and navigate to the corresponding section

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
