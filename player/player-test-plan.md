# Player UI Test Plan

## Application Overview

The Player application is the main learning platform in the Crucible ecosystem. It provides views (training scenarios/exercises), team management, user roles and permissions, application templates for integrating with other Crucible services, and webhook subscriptions. The application uses Keycloak for authentication and supports multiple teams per view with different permission levels.

## Test Scenarios

### 1. Authentication

**Seed:** `seed.spec.ts`

#### 1.1. User Login

**File:** `player/tests/authentication/user-login.spec.ts`

**Steps:**
  1. Navigate to the Player UI at http://localhost:4301
    - expect: The application redirects to Keycloak login page
    - expect: The page displays username and password fields
    - expect: The page shows 'Sign in to your account' heading
  2. Enter 'admin' as username
    - expect: The username field accepts the input
  3. Enter 'admin' as password
    - expect: The password field accepts the input and masks the characters
  4. Click the 'Sign In' button
    - expect: The user is redirected back to Player UI
    - expect: The page displays 'My Views' section
    - expect: The page shows the user's name 'Admin User' in the menu button

#### 1.2. User Logout

**File:** `player/tests/authentication/user-logout.spec.ts`

**Steps:**
  1. Log in as admin user
    - expect: User is successfully authenticated and on the home page
  2. Click the Menu button with user name
    - expect: A dropdown menu appears with 'Administration', 'Logout', and 'Dark Theme' options
  3. Click the 'Logout' option
    - expect: User is logged out
    - expect: User is redirected to Keycloak or login page

#### 1.3. Invalid Login Credentials

**File:** `player/tests/authentication/invalid-login.spec.ts`

**Steps:**
  1. Navigate to the Player UI
    - expect: The application redirects to Keycloak login page
  2. Enter 'invaliduser' as username and 'wrongpassword' as password
    - expect: The credentials are entered in the fields
  3. Click the 'Sign In' button
    - expect: An error message is displayed
    - expect: User remains on the login page
    - expect: User is not authenticated

#### 1.4. Failed Authentication - Empty Credentials

**File:** `player/tests/authentication/failed-authentication-empty-credentials.spec.ts`

**Steps:**
  1. Navigate to Player UI at http://localhost:4301
    - expect: User is redirected to Keycloak login page
  2. Leave username field empty
    - expect: Username field is empty
  3. Leave password field empty
    - expect: Password field is empty
  4. Click the 'Sign In' button
    - expect: Validation error appears
    - expect: Error message indicates required fields
    - expect: User cannot proceed without credentials

#### 1.5. Session Persistence After Refresh

**File:** `player/tests/authentication/session-persistence.spec.ts`

**Steps:**
  1. Log in with valid credentials (admin/admin)
    - expect: User is successfully authenticated and viewing Player home page
  2. Refresh the browser page
    - expect: User remains authenticated
    - expect: Home page loads without redirecting to Keycloak
    - expect: User session is maintained

#### 1.6. Unauthorized Access Protection

**File:** `player/tests/authentication/unauthorized-access.spec.ts`

**Steps:**
  1. Clear all cookies and local storage to simulate unauthenticated state
    - expect: Session is cleared
  2. Attempt to navigate directly to a protected route (e.g., http://localhost:4301/admin)
    - expect: User is redirected to Keycloak login page
    - expect: Protected route is not accessible without authentication

### 2. Home Page - My Views

**Seed:** `seed.spec.ts`

#### 2.1. View My Views List

**File:** `player/tests/home/view-my-views-list.spec.ts`

**Steps:**
  1. Log in as admin user
    - expect: User is on the home page
  2. Observe the 'My Views' section
    - expect: A table is displayed with columns 'Name' and 'Description'
    - expect: The table shows views the user has access to
    - expect: Each view is clickable to navigate to the view details

#### 2.2. Search Views

**File:** `player/tests/home/search-views.spec.ts`

**Steps:**
  1. Log in as admin user
    - expect: User is on the home page with views displayed
  2. Enter a search term in the Search textbox
    - expect: The views list filters to show only matching views
    - expect: Non-matching views are hidden
  3. Clear the search field
    - expect: All views are displayed again

#### 2.3. Sort Views by Name

**File:** `player/tests/home/sort-views.spec.ts`

**Steps:**
  1. Log in as admin user
    - expect: User is on the home page with multiple views displayed
  2. Click the 'Name' column header
    - expect: Views are sorted by name in ascending order
  3. Click the 'Name' column header again
    - expect: Views are sorted by name in descending order

#### 2.4. Navigate to View

**File:** `player/tests/home/navigate-to-view.spec.ts`

**Steps:**
  1. Log in as admin user
    - expect: User is on the home page with views displayed
  2. Click on a view name link
    - expect: User is navigated to the view details page
    - expect: The URL changes to /view/{viewId}
    - expect: The page displays the view name in the header
    - expect: The page shows team selector and view content

#### 2.5. Dark Theme Toggle

**File:** `player/tests/home/dark-theme-toggle.spec.ts`

**Steps:**
  1. Log in as admin user
    - expect: User is on the home page
  2. Click the Menu button
    - expect: A dropdown menu appears showing a 'Dark Theme' toggle switch
  3. Toggle the Dark Theme switch
    - expect: The application theme changes to dark mode
    - expect: Colors and backgrounds update to dark theme
  4. Toggle the Dark Theme switch again
    - expect: The application theme changes back to light mode

#### 2.6. Create New View - Authorized User

**File:** `player/tests/home/create-view-authorized.spec.ts`

**Steps:**
  1. Log in as user with 'CreateViews' permission
    - expect: User is on home page
  2. Look for 'Create' or 'New View' button
    - expect: Button to create new view is visible and enabled
  3. Click the create view button
    - expect: Create view dialog opens
    - expect: Dialog prompts for view name

#### 2.7. Create New View - Unauthorized User

**File:** `player/tests/home/create-view-unauthorized.spec.ts`

**Steps:**
  1. Log in as user without 'CreateViews' permission
    - expect: User is on home page
  2. Look for 'Create' or 'New View' button
    - expect: Button to create new view is not visible or is disabled

### 3. View Details

**Seed:** `seed.spec.ts`

#### 3.1. View Basic Information

**File:** `player/tests/view-details/view-basic-info.spec.ts`

**Steps:**
  1. Log in and navigate to a view
    - expect: User is on the view details page
  2. Observe the view header
    - expect: View name is displayed
    - expect: Current team is shown with 'Team:' label
    - expect: Team selector dropdown is available
    - expect: Users button is visible
    - expect: Menu button is visible
    - expect: Notifications button is visible

#### 3.2. Switch Teams

**File:** `player/tests/view-details/switch-teams.spec.ts`

**Steps:**
  1. Log in and navigate to a view that has multiple teams
    - expect: User is on the view details page
  2. Click the 'Select a Team' button
    - expect: A dropdown menu appears showing all available teams for this view
  3. Click on a different team from the list
    - expect: The current team updates to the selected team
    - expect: The team label shows the new team name
    - expect: The view content updates to reflect the selected team's context

#### 3.3. View Users by Team

**File:** `player/tests/view-details/view-users-by-team.spec.ts`

**Steps:**
  1. Log in and navigate to a view
    - expect: User is on the view details page
  2. Click the 'Users' button
    - expect: A dialog opens showing all teams in the view
    - expect: Each team shows its name and user count
    - expect: Teams are displayed as expandable sections
  3. Click on a team to expand it
    - expect: The team expands to show a table of users
    - expect: The table displays user names and their online/offline status
  4. Click the 'Hide Offline' checkbox
    - expect: Only online users are displayed
    - expect: Offline users are hidden from the list
  5. Click 'Close' button
    - expect: The dialog closes
    - expect: User returns to the view details page

#### 3.4. Expand/Collapse All Teams

**File:** `player/tests/view-details/expand-collapse-teams.spec.ts`

**Steps:**
  1. Log in and navigate to a view, then open the Users dialog
    - expect: The Users dialog is open showing multiple teams
  2. Click the 'Expand All' button
    - expect: All teams expand to show their user lists
  3. Click the 'Collapse All' button
    - expect: All teams collapse to hide their user lists
    - expect: Only team names and counts are visible

#### 3.5. Search Users

**File:** `player/tests/view-details/search-users.spec.ts`

**Steps:**
  1. Log in and navigate to a view, then open the Users dialog
    - expect: The Users dialog is open
  2. Enter a user name in the Search field
    - expect: The teams list filters to show only teams with matching users
    - expect: Teams without matching users are hidden
  3. Clear the search field
    - expect: All teams are displayed again

#### 3.6. Send System Notification

**File:** `player/tests/view-details/send-notification.spec.ts`

**Steps:**
  1. Log in and navigate to a view
    - expect: User is on the view details page
  2. Click the 'Notifications' button
    - expect: A notification panel opens
    - expect: A text field for entering notification message is shown
    - expect: A character counter shows '0 / 225'
    - expect: A 'Send' button is visible
  3. Enter a notification message
    - expect: The message is entered in the text field
    - expect: The character counter updates to show characters used
  4. Click the 'Send' button
    - expect: The notification is sent to all users in the view
    - expect: The text field is cleared

#### 3.7. Notification Character Limit

**File:** `player/tests/view-details/notification-character-limit.spec.ts`

**Steps:**
  1. Log in and navigate to a view, then open the Notifications panel
    - expect: The notification panel is open
  2. Enter a message exceeding 225 characters
    - expect: The text field prevents entering more than 225 characters
    - expect: The character counter shows '225 / 225'

#### 3.8. Return to Home from View

**File:** `player/tests/view-details/return-to-home.spec.ts`

**Steps:**
  1. Log in and navigate to a view
    - expect: User is on the view details page
  2. Click the 'Player' link in the header
    - expect: User is navigated back to the home page
    - expect: The URL changes to '/'
    - expect: The 'My Views' list is displayed

### 4. View Player Interface

**Seed:** `seed.spec.ts`

#### 4.1. View Player Sidebar - Applications List

**File:** `player/tests/view-player/applications-list.spec.ts`

**Steps:**
  1. Navigate to view player page
    - expect: Sidebar displays list of applications available in the view
    - expect: Each application shows name/icon

#### 4.2. View Player Sidebar - Collapse/Expand

**File:** `player/tests/view-player/sidebar-collapse-expand.spec.ts`

**Steps:**
  1. Navigate to view player page with sidebar expanded
    - expect: Sidebar is fully visible with application names
  2. Click the collapse button (chevron-double-left icon)
    - expect: Sidebar collapses to mini mode showing only icons
    - expect: More space is available for main content
  3. Click the expand button (chevron-double-right icon)
    - expect: Sidebar expands back to full width
    - expect: Application names are visible again

#### 4.3. View Player Sidebar - Resize

**File:** `player/tests/view-player/sidebar-resize.spec.ts`

**Steps:**
  1. Navigate to view player page
    - expect: Sidebar is visible
  2. Hover over the right edge of the sidebar (resize handle)
    - expect: Cursor changes to indicate resize capability
  3. Drag the resize handle to increase sidebar width
    - expect: Sidebar width increases
    - expect: Main content area adjusts accordingly
  4. Drag the resize handle to decrease sidebar width
    - expect: Sidebar width decreases
    - expect: Main content area expands

#### 4.4. Application Selection and Launch

**File:** `player/tests/view-player/application-launch.spec.ts`

**Steps:**
  1. Navigate to view player page with applications
    - expect: Applications are listed in sidebar
  2. Click on an application in the sidebar
    - expect: Application is selected/highlighted
    - expect: Application opens in the main content area or new window/tab
    - expect: Application interface is functional

### 5. File Browser

**Seed:** `seed.spec.ts`

#### 5.1. File Browser Access

**File:** `player/tests/file-browser/file-browser-access.spec.ts`

**Steps:**
  1. Navigate to file browser route /view/:id/files
    - expect: File browser interface loads
    - expect: File list or directory structure is displayed

#### 5.2. File Browser - Directory Navigation

**File:** `player/tests/file-browser/directory-navigation.spec.ts`

**Steps:**
  1. Open file browser with nested directories
    - expect: Root directory contents are displayed
  2. Click on a directory/folder
    - expect: Directory opens and shows its contents
    - expect: Breadcrumb or path updates to show current location
  3. Click on parent directory or 'back' button
    - expect: User navigates back to parent directory

#### 5.3. File Browser - File Selection

**File:** `player/tests/file-browser/file-selection.spec.ts`

**Steps:**
  1. Open file browser with files
    - expect: Files are listed
  2. Click on a file
    - expect: File is selected/highlighted
    - expect: File actions (download, open, etc.) become available

#### 5.4. File Download

**File:** `player/tests/file-browser/file-download.spec.ts`

**Steps:**
  1. Navigate to file browser and select a file
    - expect: File is selected
  2. Click download button or link
    - expect: File download begins
    - expect: Browser shows download progress
    - expect: File is downloaded successfully

#### 5.5. File Browser - Empty Directory

**File:** `player/tests/file-browser/empty-directory.spec.ts`

**Steps:**
  1. Navigate to file browser for a directory with no files
    - expect: File browser displays empty state message
    - expect: Message indicates no files are available
    - expect: No errors are displayed

### 6. User Presence

**Seed:** `seed.spec.ts`

#### 6.1. User Presence Page Access

**File:** `player/tests/user-presence/presence-page-access.spec.ts`

**Steps:**
  1. Navigate to user presence route /view/:id/presence
    - expect: User presence page loads
    - expect: List of users in the view is displayed

#### 6.2. User Presence - Online Status

**File:** `player/tests/user-presence/online-status.spec.ts`

**Steps:**
  1. Navigate to user presence page
    - expect: User presence list displays
    - expect: Current user appears as online/present
    - expect: Online status indicator is visible

#### 6.3. User Presence - Team Filter

**File:** `player/tests/user-presence/team-filter.spec.ts`

**Steps:**
  1. Navigate to user presence page in a view with multiple teams
    - expect: User presence page displays
  2. Select a specific team from filter/dropdown
    - expect: User list filters to show only members of selected team
    - expect: Team members' presence status is displayed

### 7. Administration - Views

**Seed:** `seed.spec.ts`

#### 7.1. Access Administration Section

**File:** `player/tests/administration/access-admin.spec.ts`

**Steps:**
  1. Log in as admin user
    - expect: User is on the home page
  2. Click the Menu button and select 'Administration'
    - expect: User is navigated to the administration page
    - expect: The URL changes to /admin
    - expect: Five sections are shown: Views, Application Templates, Users, Roles, Subscriptions

#### 7.2. View All Views as Admin

**File:** `player/tests/administration/view-all-views.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration
    - expect: The Administration page is displayed with Views section active
  2. Observe the Views table
    - expect: A table displays all views with columns: checkbox, View Name, Description, Status
    - expect: Each view has a copy button for the view ID
    - expect: Each view shows its status (Active/Inactive)
    - expect: Views marked as TEMPLATE are indicated

#### 7.3. Search Views in Admin

**File:** `player/tests/administration/search-views-admin.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Views
    - expect: The Views admin section is displayed
  2. Enter a search term in the Search field
    - expect: The views list filters to show only matching views
  3. Clear the search field
    - expect: All views are displayed again

#### 7.4. Sort Views in Admin

**File:** `player/tests/administration/sort-views-admin.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Views
    - expect: The Views admin section displays multiple views
  2. Click the 'View Name' column header
    - expect: Views are sorted by name in ascending order
  3. Click the 'Status' column header
    - expect: Views are sorted by status

#### 7.5. Select Multiple Views

**File:** `player/tests/administration/select-multiple-views.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Views
    - expect: The Views admin section is displayed
  2. Click the checkbox in the header row
    - expect: All views are selected
    - expect: All individual checkboxes are checked
  3. Click the header checkbox again
    - expect: All views are deselected
  4. Click individual view checkboxes
    - expect: Only selected views have checked checkboxes

#### 7.6. Copy View ID

**File:** `player/tests/administration/copy-view-id.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Views
    - expect: The Views admin section is displayed
  2. Click the copy icon next to a view
    - expect: The view's ID is copied to the clipboard
    - expect: A visual confirmation may appear

#### 7.7. Edit View Details

**File:** `player/tests/administration/edit-view.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Views
    - expect: The Views admin section is displayed
  2. Click on a view name
    - expect: A view edit dialog or form opens
    - expect: View details are displayed for editing
  3. Modify view name or description
    - expect: Fields accept modifications
  4. Click 'Save' or 'Update' button
    - expect: View is updated successfully
    - expect: Updated information is reflected in views list

#### 7.8. Create View

**File:** `player/tests/administration/admin-create-view.spec.ts`

**Steps:**
  1. Navigate to admin views section
    - expect: Views list is displayed
  2. Click 'Create' or 'Add View' button
    - expect: Create view dialog/form opens
  3. Enter view name 'Test View'
    - expect: Name field accepts input
  4. Enter view description 'Test Description'
    - expect: Description field accepts input
  5. Click 'Save' or 'Create' button
    - expect: View is created successfully
    - expect: Success message is displayed
    - expect: New view appears in views list

#### 7.9. Delete View

**File:** `player/tests/administration/admin-delete-view.spec.ts`

**Steps:**
  1. Navigate to admin views section
    - expect: Views list displays
  2. Click delete button for a test view
    - expect: Confirmation dialog appears
    - expect: Dialog warns about view deletion
  3. Click 'Cancel' in confirmation dialog
    - expect: Dialog closes
    - expect: View is not deleted
  4. Click delete button again
    - expect: Confirmation dialog appears
  5. Click 'Confirm' or 'Delete' in dialog
    - expect: View is deleted successfully
    - expect: View is removed from list

#### 7.10. Export View

**File:** `player/tests/administration/admin-export-view.spec.ts`

**Steps:**
  1. Navigate to admin views section
    - expect: Views list displays
  2. Click export button for a view
    - expect: Export dialog opens or export begins
    - expect: Export options are presented if applicable
  3. Confirm export action
    - expect: View data is exported
    - expect: Export file is downloaded or save location is prompted

#### 7.11. Import View

**File:** `player/tests/administration/admin-import-view.spec.ts`

**Steps:**
  1. Navigate to admin views section
    - expect: Views section displays
  2. Click 'Import' button
    - expect: Import dialog opens
    - expect: File upload interface is presented
  3. Select a valid view export file
    - expect: File is accepted
  4. Click 'Import' or 'Upload' button
    - expect: Import process begins
    - expect: Success message displays upon completion
    - expect: Imported view appears in views list

### 8. Administration - Application Templates

**Seed:** `seed.spec.ts`

#### 8.1. View Application Templates

**File:** `player/tests/administration/view-app-templates.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration
    - expect: The Administration page is displayed
  2. Click the 'Application Templates' button
    - expect: The Application Templates section is displayed
    - expect: A table shows templates with columns: checkbox, Template Name, Url
    - expect: Templates include Dashboard, Map, and Virtual Machines with their respective URLs

#### 8.2. Search Application Templates

**File:** `player/tests/administration/search-app-templates.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Application Templates
    - expect: The Application Templates section is displayed
  2. Enter a search term in the Search field
    - expect: The templates list filters to show only matching templates

#### 8.3. Sort Application Templates

**File:** `player/tests/administration/sort-app-templates.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Application Templates
    - expect: The Application Templates section is displayed
  2. Click the 'Template Name' column header
    - expect: Templates are sorted by name in ascending order
  3. Click the 'Url' column header
    - expect: Templates are sorted by URL

#### 8.4. View Template URL

**File:** `player/tests/administration/view-template-url.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Application Templates
    - expect: The Application Templates section is displayed
  2. Observe the template URLs
    - expect: URLs contain placeholders like {viewId} and {theme}
    - expect: URLs point to different Crucible services (Alloy, VM API)

#### 8.5. Add New Application Template

**File:** `player/tests/administration/add-app-template.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Application Templates
    - expect: The Application Templates section is displayed
  2. Click the add button (if available)
    - expect: A form or dialog opens to create a new application template
    - expect: Fields for template name, icon, and URL are available

#### 8.6. Paginate Application Templates

**File:** `player/tests/administration/paginate-app-templates.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Application Templates
    - expect: The Application Templates section is displayed with pagination controls
  2. Observe the pagination section
    - expect: Shows '1 - 3 of 3' indicating the current page range
    - expect: Shows 'Items per page' dropdown
    - expect: Shows First, Previous, Next, Last page buttons
  3. Change the 'Items per page' value
    - expect: The table updates to show the specified number of items per page
    - expect: Pagination controls update accordingly

#### 8.7. Export Application Template

**File:** `player/tests/administration/admin-export-app-template.spec.ts`

**Steps:**
  1. Navigate to admin application templates section
    - expect: Templates list displays
  2. Click export button for a template
    - expect: Export process begins
    - expect: Template file is downloaded

#### 8.8. Import Application Template

**File:** `player/tests/administration/admin-import-app-template.spec.ts`

**Steps:**
  1. Navigate to admin application templates section
    - expect: Templates section displays
  2. Click 'Import' button
    - expect: Import dialog opens
  3. Select a valid template file
    - expect: File is accepted
  4. Confirm import
    - expect: Template is imported successfully
    - expect: Imported template appears in list

### 9. Administration - Users

**Seed:** `seed.spec.ts`

#### 9.1. View All Users

**File:** `player/tests/administration/view-all-users.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration
    - expect: The Administration page is displayed
  2. Click the 'Users' button
    - expect: The Users section is displayed
    - expect: A table shows users with columns: ID, Name, Role
    - expect: Each user has a copy button for their ID
    - expect: Each user has a role dropdown and delete button

#### 9.2. Search Users

**File:** `player/tests/administration/search-users.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Users
    - expect: The Users section is displayed
  2. Enter a user name in the Search field
    - expect: The users list filters to show only matching users

#### 9.3. Sort Users

**File:** `player/tests/administration/sort-users.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Users
    - expect: The Users section is displayed
  2. Click the 'ID' column header
    - expect: Users are sorted by ID
  3. Click the 'Name' column header
    - expect: Users are sorted by name

#### 9.4. Copy User ID

**File:** `player/tests/administration/copy-user-id.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Users
    - expect: The Users section is displayed
  2. Click the copy icon next to a user ID
    - expect: The user's ID is copied to the clipboard

#### 9.5. Assign Role to User

**File:** `player/tests/administration/assign-user-role.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Users
    - expect: The Users section is displayed
  2. Click the role dropdown for a user showing 'None'
    - expect: A dropdown opens showing available roles
  3. Select a role from the dropdown
    - expect: The user's role is updated
    - expect: The dropdown shows the selected role

#### 9.6. Edit User

**File:** `player/tests/administration/edit-user.spec.ts`

**Steps:**
  1. Navigate to admin users section
    - expect: Users list displays
  2. Click on a user or edit button
    - expect: User edit dialog/page opens
    - expect: User details are displayed in editable form
  3. Modify user details (e.g., name, roles)
    - expect: Fields accept modifications
  4. Click 'Save' button
    - expect: User details are updated
    - expect: Success message is displayed

#### 9.7. Delete User

**File:** `player/tests/administration/delete-user.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Users
    - expect: The Users section is displayed
  2. Click the delete button for a user
    - expect: A confirmation dialog appears asking to confirm deletion
  3. Confirm the deletion
    - expect: The user is removed from the list

#### 9.8. Paginate Users

**File:** `player/tests/administration/paginate-users.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Users
    - expect: The Users section is displayed with pagination controls
  2. Change the 'Items per page' value from 20 to another value
    - expect: The table updates to show the specified number of users per page
  3. Click the 'Next page' button (if there are multiple pages)
    - expect: The next set of users is displayed

### 10. Administration - Roles and Permissions

**Seed:** `seed.spec.ts`

#### 10.1. View Roles

**File:** `player/tests/administration/view-roles.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration
    - expect: The Administration page is displayed
  2. Click the 'Roles' button
    - expect: The Roles/Permissions section is displayed
    - expect: Two tabs are shown: 'Roles' and 'Team Roles'
    - expect: The 'Roles' tab is active by default
    - expect: A permissions matrix is displayed showing roles and permissions

#### 10.2. View System Roles Permissions Matrix

**File:** `player/tests/administration/view-system-roles-matrix.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Roles
    - expect: The Roles tab is active
  2. Observe the permissions matrix
    - expect: Columns show 'Administrator' and 'Content Developer' roles
    - expect: Rows show permissions like 'All', 'CreateViews', 'EditViews', 'ManageApplications', 'ManageRoles', 'ManageUsers', 'ManageViews', 'ManageWebhookSubscriptions', 'ViewApplications', 'ViewRoles', 'ViewUsers', 'ViewViews', 'ViewWebhookSubscriptions', 'ManageNetworks', 'ViewNetworks'
    - expect: Checkboxes indicate which permissions are assigned to each role
    - expect: Administrator role has 'All' permission checked and disabled

#### 10.3. Modify Role Permissions

**File:** `player/tests/administration/modify-role-permissions.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Roles
    - expect: The Roles tab displays the permissions matrix
  2. Click a checkbox to assign or remove a permission from a role
    - expect: The checkbox state toggles
    - expect: The permission is assigned or removed from the role

#### 10.4. Add New Role

**File:** `player/tests/administration/add-new-role.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Roles
    - expect: The Roles tab is displayed
  2. Click the add role button
    - expect: A dialog or form opens to create a new role
    - expect: Fields for role name are available
  3. Enter a role name and save
    - expect: A new column is added to the permissions matrix
    - expect: The new role appears with no permissions assigned

#### 10.5. Rename Role

**File:** `player/tests/administration/rename-role.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Roles
    - expect: The Roles tab is displayed
  2. Click the rename button for 'Content Developer' role
    - expect: A dialog opens to edit the role name
  3. Change the role name and save
    - expect: The role column header updates with the new name

#### 10.6. Delete Role

**File:** `player/tests/administration/delete-role.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Roles
    - expect: The Roles tab is displayed
  2. Click the delete button for a role
    - expect: A confirmation dialog appears
  3. Confirm the deletion
    - expect: The role column is removed from the matrix

#### 10.7. View Team Roles

**File:** `player/tests/administration/view-team-roles.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Roles
    - expect: The Roles section is displayed
  2. Click the 'Team Roles' tab
    - expect: The Team Roles tab becomes active
    - expect: A permissions matrix is displayed showing team-specific roles
    - expect: Columns show 'View Admin', 'Observer', and 'View Member' roles
    - expect: Rows show team permissions like 'All', 'EditTeam', 'EditView', 'ManageTeam', 'ManageView', 'ViewTeam', 'ViewView', 'DownloadVmFiles', 'ManageNetworks', 'RevertVms', 'UploadTeamIsos', 'UploadViewIsos', 'UploadVmFiles', 'ViewNetworks'

#### 10.8. Modify Team Role Permissions

**File:** `player/tests/administration/modify-team-role-permissions.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Roles > Team Roles tab
    - expect: The Team Roles permissions matrix is displayed
  2. Click a checkbox to assign or remove a permission from a team role
    - expect: The checkbox state toggles
    - expect: The permission is assigned or removed from the team role

#### 10.9. Add New Team Role

**File:** `player/tests/administration/add-new-team-role.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Roles > Team Roles tab
    - expect: The Team Roles tab is displayed
  2. Click the add role button
    - expect: A dialog opens to create a new team role
  3. Enter a role name and save
    - expect: A new column is added to the team roles matrix

#### 10.10. Expand/Collapse Permission Groups

**File:** `player/tests/administration/expand-collapse-permissions.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Roles
    - expect: The Roles tab displays the permissions matrix
  2. Click the expand button next to a permission group
    - expect: The permission group expands to show sub-permissions (if any)
  3. Click the collapse button
    - expect: The permission group collapses

### 11. Administration - Subscriptions

**Seed:** `seed.spec.ts`

#### 11.1. View Subscriptions

**File:** `player/tests/administration/view-subscriptions.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration
    - expect: The Administration page is displayed
  2. Click the 'Subscriptions' button
    - expect: The Subscriptions section is displayed
    - expect: A table shows subscriptions with columns: Subscription Name, Last Error, Event Types
    - expect: An 'Add New Subscription' button is visible

#### 11.2. Search Subscriptions

**File:** `player/tests/administration/search-subscriptions.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Subscriptions
    - expect: The Subscriptions section is displayed
  2. Enter a subscription name in the Search field
    - expect: The subscriptions list filters to show only matching subscriptions

#### 11.3. Sort Subscriptions

**File:** `player/tests/administration/sort-subscriptions.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Subscriptions
    - expect: The Subscriptions section is displayed
  2. Click the 'Subscription Name' column header
    - expect: Subscriptions are sorted by name
  3. Click the 'Event Types' column header
    - expect: Subscriptions are sorted by event types

#### 11.4. Add New Subscription

**File:** `player/tests/administration/add-subscription.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Subscriptions
    - expect: The Subscriptions section is displayed
  2. Click the 'Add New Subscription' button
    - expect: A dialog or form opens to create a new webhook subscription
    - expect: Fields for subscription name, URL, event types are available
  3. Fill in subscription details and save
    - expect: The new subscription is added to the list

#### 11.5. Edit Subscription

**File:** `player/tests/administration/edit-subscription.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Subscriptions
    - expect: The Subscriptions section is displayed with existing subscriptions
  2. Click on a subscription name
    - expect: A dialog opens showing subscription details for editing
  3. Modify subscription details and save
    - expect: The subscription is updated in the list

#### 11.6. Delete Subscription

**File:** `player/tests/administration/delete-subscription.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Subscriptions
    - expect: The Subscriptions section is displayed with existing subscriptions
  2. Click the delete button for a subscription
    - expect: A confirmation dialog appears
  3. Confirm the deletion
    - expect: The subscription is removed from the list

#### 11.7. View Subscription Error Details

**File:** `player/tests/administration/view-subscription-errors.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Subscriptions
    - expect: The Subscriptions section is displayed
  2. Observe a subscription with an error in the 'Last Error' column
    - expect: The error message is displayed
    - expect: Error details help diagnose webhook issues

### 12. Navigation

**Seed:** `seed.spec.ts`

#### 12.1. Breadcrumb Navigation

**File:** `player/tests/navigation/breadcrumb-navigation.spec.ts`

**Steps:**
  1. Navigate to a nested page (e.g., admin view edit)
    - expect: Breadcrumb trail is visible showing navigation path
  2. Click on a breadcrumb link
    - expect: User navigates to the selected level in the hierarchy

#### 12.2. Admin Sidebar Navigation

**File:** `player/tests/navigation/admin-sidebar-navigation.spec.ts`

**Steps:**
  1. Navigate to admin page
    - expect: Admin sidebar is visible with section links
  2. Click on different section links in sidebar
    - expect: Each section loads correctly
    - expect: Active section is highlighted in sidebar

### 13. Error Handling and Edge Cases

**Seed:** `seed.spec.ts`

#### 13.1. Navigate to Non-Existent View

**File:** `player/tests/errors/non-existent-view.spec.ts`

**Steps:**
  1. Log in as admin user
    - expect: User is authenticated
  2. Navigate to /view/00000000-0000-0000-0000-000000000000 (invalid view ID)
    - expect: An error message is displayed
    - expect: User is informed the view does not exist or they don't have access
    - expect: User can navigate back to home

#### 13.2. Network Error Handling

**File:** `player/tests/errors/network-error.spec.ts`

**Steps:**
  1. Log in and navigate to home page
    - expect: User is on the home page
  2. Simulate a network disconnection (using browser DevTools or test utilities)
    - expect: The application displays an error message indicating connection issues
    - expect: User is notified to check their connection

#### 13.3. Session Expiration

**File:** `player/tests/errors/session-expiration.spec.ts`

**Steps:**
  1. Log in as admin user
    - expect: User is authenticated
  2. Wait for the session to expire (or manipulate token expiration)
    - expect: User is redirected to login page
    - expect: A message indicates the session has expired

#### 13.4. Empty Views List

**File:** `player/tests/errors/empty-views-list.spec.ts`

**Steps:**
  1. Log in as a user with no assigned views
    - expect: The home page displays an empty views list
    - expect: A message indicates 'No views available' or similar

#### 13.5. Permission Denied on Admin Access

**File:** `player/tests/errors/admin-permission-denied.spec.ts`

**Steps:**
  1. Log in as a non-admin user
    - expect: User is authenticated
  2. Attempt to navigate to /admin
    - expect: User is redirected or shown an error message
    - expect: Access to administration is denied

#### 13.6. Long View Names Display

**File:** `player/tests/errors/long-view-names.spec.ts`

**Steps:**
  1. Log in and view a list containing a view with a very long name
    - expect: The long name is truncated with ellipsis or wrapped appropriately
    - expect: The table layout remains intact

#### 13.7. Special Characters in Search

**File:** `player/tests/errors/special-chars-search.spec.ts`

**Steps:**
  1. Log in and navigate to home page
    - expect: User is on the home page
  2. Enter special characters like <, >, &, quotes in the search field
    - expect: The search handles special characters gracefully without errors
    - expect: Results are filtered correctly or no results are shown

#### 13.8. Server Error (500) Handling

**File:** `player/tests/errors/server-error.spec.ts`

**Steps:**
  1. Log in successfully
    - expect: User is authenticated
  2. Trigger an API call that returns 500 error (or mock such response)
    - expect: Application handles error gracefully
    - expect: Error message is displayed to user
    - expect: No uncaught exceptions in console

#### 13.9. Form Validation - Required Fields

**File:** `player/tests/errors/form-validation-required.spec.ts`

**Steps:**
  1. Navigate to a form (e.g., create view dialog)
    - expect: Form is displayed
  2. Leave required fields empty
    - expect: Required fields are marked
  3. Attempt to submit form
    - expect: Form validation prevents submission
    - expect: Error messages indicate required fields

#### 13.10. Form Validation - Invalid Input Format

**File:** `player/tests/errors/form-validation-format.spec.ts`

**Steps:**
  1. Navigate to a form with formatted fields (e.g., URL, email)
    - expect: Form is displayed
  2. Enter invalid format (e.g., malformed URL)
    - expect: Field shows validation error
  3. Attempt to submit
    - expect: Form validation prevents submission
    - expect: Specific format error is displayed

#### 13.11. Browser Back Button Navigation

**File:** `player/tests/errors/back-button-navigation.spec.ts`

**Steps:**
  1. Navigate through multiple pages (home -> view player -> admin)
    - expect: Navigation history is recorded
  2. Click browser back button
    - expect: User navigates back to previous page
    - expect: Page state is preserved or reloaded correctly
    - expect: No errors occur

#### 13.12. Deep Link Access

**File:** `player/tests/errors/deep-link-access.spec.ts`

**Steps:**
  1. Copy a deep link URL (e.g., /view/:id)
    - expect: URL is copied
  2. Log out or open in incognito mode
    - expect: User is not authenticated
  3. Paste and navigate to deep link URL
    - expect: User is redirected to login
    - expect: After login, user is redirected back to intended deep link

#### 13.13. XSS Protection - Script Injection in Forms

**File:** `player/tests/errors/xss-protection.spec.ts`

**Steps:**
  1. Navigate to a form (e.g., create view)
    - expect: Form is displayed
  2. Enter script tags in text fields (e.g., `<script>alert('XSS')</script>`)
    - expect: Input is accepted
  3. Submit form
    - expect: Script is sanitized and not executed
    - expect: No XSS vulnerability is present
    - expect: Data is stored safely

#### 13.14. SQL Injection Protection - Search Fields

**File:** `player/tests/errors/sql-injection-protection.spec.ts`

**Steps:**
  1. Navigate to a search field (e.g., view list search)
    - expect: Search field is visible
  2. Enter SQL injection attempt (e.g., `' OR '1'='1`)
    - expect: Input is accepted
  3. Execute search
    - expect: Application handles input safely
    - expect: No SQL errors occur
    - expect: Search results are appropriate or empty

#### 13.15. Large Data Set Handling - Pagination

**File:** `player/tests/errors/large-dataset-pagination.spec.ts`

**Steps:**
  1. Navigate to a list with many items (e.g., large view list)
    - expect: List loads with pagination or virtual scrolling
  2. Navigate through pages or scroll through list
    - expect: Data loads smoothly without freezing
    - expect: Performance remains acceptable
    - expect: All items are accessible

#### 13.16. File Upload - Invalid File Type

**File:** `player/tests/errors/file-upload-invalid-type.spec.ts`

**Steps:**
  1. Navigate to file upload interface (e.g., import view)
    - expect: Upload interface is displayed
  2. Select a file with invalid type (e.g., .exe instead of .json)
    - expect: File is selected
  3. Attempt to upload
    - expect: Validation error is displayed
    - expect: Error indicates invalid file type
    - expect: Upload is prevented

#### 13.17. File Upload - Oversized File

**File:** `player/tests/errors/file-upload-oversized.spec.ts`

**Steps:**
  1. Navigate to file upload interface
    - expect: Upload interface is displayed
  2. Select a file larger than maximum allowed size
    - expect: File is selected
  3. Attempt to upload
    - expect: Validation error is displayed
    - expect: Error indicates file is too large
    - expect: Upload is prevented or gracefully fails

#### 13.18. Concurrent User Actions - Race Conditions

**File:** `player/tests/errors/concurrent-actions.spec.ts`

**Steps:**
  1. Open two browser instances with same user logged in
    - expect: Both instances are authenticated
  2. Perform conflicting actions in both instances (e.g., edit same view)
    - expect: Application handles concurrent edits
    - expect: Changes are synchronized or conflict is detected
    - expect: No data corruption occurs

### 14. Performance

**Seed:** `seed.spec.ts`

#### 14.1. Page Load Performance - Home Page

**File:** `player/tests/performance/home-page-load-time.spec.ts`

**Steps:**
  1. Measure time from navigation to home page until page is fully loaded
    - expect: Home page loads within acceptable time (e.g., under 3 seconds)
    - expect: No blocking resources delay rendering

#### 14.2. Page Load Performance - View Player

**File:** `player/tests/performance/view-player-load-time.spec.ts`

**Steps:**
  1. Measure time from navigation to view player until page is interactive
    - expect: View player loads within acceptable time
    - expect: Applications list renders promptly

#### 14.3. API Response Time - View List

**File:** `player/tests/performance/api-response-view-list.spec.ts`

**Steps:**
  1. Monitor network requests when loading view list
    - expect: API response time is under acceptable threshold (e.g., 1 second)
    - expect: No unnecessary API calls are made

#### 14.4. Memory Usage - Extended Session

**File:** `player/tests/performance/memory-usage-extended-session.spec.ts`

**Steps:**
  1. Log in and navigate through various pages for extended period
    - expect: Memory usage remains stable
    - expect: No significant memory leaks are detected
    - expect: Application performance does not degrade over time

### 15. Responsive Design and Accessibility

**Seed:** `seed.spec.ts`

#### 15.1. Mobile View - Home Page

**File:** `player/tests/responsive/mobile-home-page.spec.ts`

**Steps:**
  1. Set browser viewport to mobile size (e.g., 375x667)
    - expect: The viewport is set to mobile dimensions
  2. Log in and view the home page
    - expect: The layout adapts to mobile view
    - expect: The views table is responsive
    - expect: All elements are accessible without horizontal scrolling

#### 15.2. Mobile View - Administration

**File:** `player/tests/responsive/mobile-administration.spec.ts`

**Steps:**
  1. Set browser viewport to mobile size
    - expect: The viewport is set to mobile dimensions
  2. Log in as admin and navigate to Administration
    - expect: The administration sections are accessible
    - expect: Tables and buttons are responsive
    - expect: Navigation is possible without horizontal scrolling

#### 15.3. Keyboard Navigation - Home Page

**File:** `player/tests/accessibility/keyboard-navigation-home.spec.ts`

**Steps:**
  1. Log in and navigate to home page
    - expect: User is on the home page
  2. Use Tab key to navigate through interactive elements
    - expect: Focus moves logically through menu, search field, view links
    - expect: All interactive elements are reachable via keyboard
    - expect: Focus indicators are visible
  3. Press Enter on a view link while focused
    - expect: The view opens as if clicked with a mouse

#### 15.4. Keyboard Navigation - Administration

**File:** `player/tests/accessibility/keyboard-navigation-admin.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration
    - expect: User is on the administration page
  2. Use Tab and arrow keys to navigate through sections and tables
    - expect: All sections are reachable via keyboard
    - expect: Checkboxes and buttons can be activated with Enter or Space
    - expect: Focus indicators are clear

#### 15.5. Keyboard Navigation - Enter Key Submission

**File:** `player/tests/accessibility/keyboard-enter-submission.spec.ts`

**Steps:**
  1. Navigate to a form (e.g., create view dialog)
    - expect: Form is displayed
  2. Fill in form fields using keyboard only
    - expect: Fields can be filled via keyboard
  3. Press Enter key to submit
    - expect: Form submits successfully without mouse click

#### 15.6. Screen Reader Compatibility

**File:** `player/tests/accessibility/screen-reader.spec.ts`

**Steps:**
  1. Enable screen reader simulation or use accessibility testing tools
    - expect: Screen reader tools are active
  2. Navigate through the application
    - expect: All headings, labels, and buttons have appropriate ARIA labels
    - expect: Tables have proper row and column headers
    - expect: Interactive elements announce their purpose and state

#### 15.7. Screen Reader - Form Labels

**File:** `player/tests/accessibility/screen-reader-form-labels.spec.ts`

**Steps:**
  1. Navigate to a form
    - expect: All form fields have associated labels
    - expect: Labels are programmatically linked to inputs
    - expect: Screen reader announces labels correctly

#### 15.8. Color Contrast

**File:** `player/tests/accessibility/color-contrast.spec.ts`

**Steps:**
  1. Log in and view the application in both light and dark themes
    - expect: Text and background colors meet WCAG contrast requirements
    - expect: All text is readable
    - expect: Interactive elements are visually distinguishable

#### 15.9. Focus Management - Modal Dialogs

**File:** `player/tests/accessibility/focus-management-modals.spec.ts`

**Steps:**
  1. Open a modal dialog (e.g., create view)
    - expect: Focus moves to modal when opened
    - expect: Focus is trapped within modal
    - expect: Background content is not accessible via Tab
  2. Close modal
    - expect: Focus returns to element that triggered modal
