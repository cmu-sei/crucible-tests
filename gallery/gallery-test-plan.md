# Gallery Application Comprehensive Test Plan

## Application Overview

Gallery is a content management application for the Crucible cybersecurity training and simulation platform. It provides a My Exhibits landing page, Wall view for displaying cards with unread article counts, an Archive view for browsing and filtering articles, and comprehensive admin capabilities. The admin section includes Collection management (with copy/upload/download JSON), Exhibit management (with copy/upload/download JSON, move/inject progression), Card management, Article management, Team management, User management (with inline role assignment), Role management (with permission matrix for system roles, collection roles, and exhibit roles), and Group management. The application uses a granular permission model with SystemPermission, CollectionPermission, ExhibitPermission, and TeamPermission levels. Authentication is via Keycloak OIDC, and real-time updates are delivered via SignalR.

## Test Scenarios

### 1. Authentication and Authorization

**Seed:** `tests/seed.spec.ts`

#### 1.1. User Login and Session Management

**File:** `tests/authentication/user-login.spec.ts`

**Steps:**
  1. Navigate to http://localhost:4723
    - expect: The application redirects to Keycloak login page
  2. Enter valid credentials (admin/admin) and click Sign In
    - expect: User is authenticated and redirected to the Gallery home page
    - expect: The page title shows 'Gallery'
    - expect: The 'My Exhibits' table is visible
    - expect: User's name 'Admin User' appears in the top navigation bar
  3. Verify the home page loads the My Exhibits table with columns: Name, Collection, Created By, Created
    - expect: All four columns are visible and sortable
    - expect: Exhibit names are clickable links

#### 1.2. Unauthorized Access Prevention

**File:** `tests/authentication/unauthorized-access.spec.ts`

**Steps:**
  1. Without authentication, attempt to access http://localhost:4723
    - expect: The application redirects to Keycloak login page
  2. Without authentication, attempt to access http://localhost:4723/admin
    - expect: The application redirects to Keycloak login page

#### 1.3. Session Logout

**File:** `tests/authentication/session-logout.spec.ts`

**Steps:**
  1. Log in successfully and verify the user's session
    - expect: User is logged in and can see the My Exhibits page
  2. Click 'Admin User' button in the top navigation to open the user menu
    - expect: A dropdown menu appears with 'Administration', 'Logout', and 'Dark Theme' options
  3. Click the 'Logout' menu item
    - expect: User is logged out
    - expect: User is redirected to Keycloak login page or public landing page
  4. Attempt to access http://localhost:4723 after logout
    - expect: User is redirected to Keycloak login page

#### 1.4. Dark Theme Toggle

**File:** `tests/authentication/dark-theme.spec.ts`

**Steps:**
  1. Log in and click 'Admin User' button in the top navigation
    - expect: User menu dropdown appears with a 'Dark Theme' switch
  2. Toggle the 'Dark Theme' switch on
    - expect: The application switches to dark theme
    - expect: Background colors change to dark tones
  3. Toggle the 'Dark Theme' switch off
    - expect: The application switches back to light theme

### 2. My Exhibits Landing Page

**Seed:** `tests/seed.spec.ts`

#### 2.1. My Exhibits Table Display

**File:** `tests/home/my-exhibits-display.spec.ts`

**Steps:**
  1. Log in and navigate to http://localhost:4723
    - expect: The My Exhibits page loads with the Gallery logo and title 'Gallery - Exercise Information Sharing'
    - expect: A table is displayed with columns: Name, Collection, Created By, Created
    - expect: Each row shows an exhibit with its name as a clickable link, collection name, creator name, and creation date
  2. Observe the Administration button (gear icon) above the table
    - expect: The Administration button is visible for admin users

#### 2.2. My Exhibits Table Sorting

**File:** `tests/home/my-exhibits-sorting.spec.ts`

**Steps:**
  1. Click the 'Name' column header
    - expect: Exhibits are sorted by name
    - expect: A sort indicator arrow is visible
  2. Click the 'Name' column header again
    - expect: Sort order reverses
  3. Click the 'Collection' column header
    - expect: Exhibits are sorted by collection name
  4. Click the 'Created By' column header
    - expect: Exhibits are sorted by creator name
  5. Click the 'Created' column header
    - expect: Exhibits are sorted by creation date

#### 2.3. My Exhibits Search

**File:** `tests/home/my-exhibits-search.spec.ts`

**Steps:**
  1. Locate the Search text field above the table
    - expect: A search input field is visible
  2. Enter a search term that matches an exhibit name
    - expect: The table filters to show only matching exhibits
  3. Clear the search field
    - expect: All exhibits are displayed again
  4. Enter a search term that matches no exhibits
    - expect: The table shows 'No results found' message

#### 2.4. My Exhibits Navigation to Exhibit

**File:** `tests/home/my-exhibits-navigation.spec.ts`

**Steps:**
  1. Click on an exhibit name link in the table
    - expect: User is navigated to the exhibit's Wall view
    - expect: URL updates to include '?exhibit={exhibitId}'
    - expect: The Wall view shows the exhibit's cards with unread article counts

### 3. Wall View Functionality

**Seed:** `tests/seed.spec.ts`

#### 3.1. Wall Page Display

**File:** `tests/wall/wall-display.spec.ts`

**Steps:**
  1. Log in and navigate to an exhibit from the My Exhibits page
    - expect: The Wall page loads with the page title 'Gallery Wall'
    - expect: The Move/Inject indicator is displayed (e.g. 'Move 0, Inject 0')
    - expect: The team indicator shows the current team name
    - expect: Cards are displayed in a grid layout
    - expect: Each card shows: name, description, date posted, and unread article count
  2. Observe the navigation controls at the top
    - expect: An 'Archive' button is visible
    - expect: An 'Administration' button is visible (for admin users)
    - expect: The 'Advance' button is visible (if ShowAdvanceButton is enabled)

#### 3.2. Wall Card Details Navigation

**File:** `tests/wall/wall-card-details.spec.ts`

**Steps:**
  1. Click the 'Details' button on a card
    - expect: Card details are displayed showing associated articles
    - expect: Article information is visible

#### 3.3. Wall Advance Move and Inject

**File:** `tests/wall/wall-advance.spec.ts`

**Steps:**
  1. Navigate to an exhibit's Wall view that has the Advance button enabled
    - expect: The 'Advance' button is visible
    - expect: Current move and inject values are displayed (e.g. 'Move 0, Inject 0')
  2. Click the 'Advance' button
    - expect: The move/inject indicator updates to show the next move or inject values
    - expect: The cards displayed on the wall update to reflect articles for the new move/inject

#### 3.4. Wall Navigation to Archive

**File:** `tests/wall/wall-navigation.spec.ts`

**Steps:**
  1. Click the 'Archive' button on the Wall page
    - expect: User is navigated to the Archive view for the same exhibit
    - expect: The page title changes to 'Gallery Archive'
    - expect: Articles are listed with source type icons, dates, and action buttons
  2. Click the 'Administration' button on the Wall page
    - expect: User is navigated to the admin section

#### 3.5. Wall Unread Article Count

**File:** `tests/wall/wall-unread-count.spec.ts`

**Steps:**
  1. Navigate to the Wall view and observe unread article counts on cards
    - expect: Each card shows the unread article count (e.g. '5 unread articles', '1 unread article')
    - expect: Cards with unread articles display the count prominently
  2. Navigate to the Archive view and mark an article as 'Read' using the Read button
    - expect: The Read button toggles to indicate the article has been read
  3. Navigate back to the Wall view
    - expect: The unread article count on the corresponding card decreases

### 4. Archive Functionality

**Seed:** `tests/seed.spec.ts`

#### 4.1. Archive Page Display

**File:** `tests/archive/archive-display.spec.ts`

**Steps:**
  1. Log in and navigate to an exhibit, then click the 'Archive' button
    - expect: The Archive page loads with the title 'Gallery Archive (N)' where N is the article count
    - expect: Articles are displayed as cards showing source type icon, title, source name, date, description
    - expect: Each article has 'View', 'Read', and 'Share' action buttons
    - expect: Source type filter buttons are visible: Intel, Reporting, Orders, News, Social, Phone, Email
    - expect: A search field 'Search the Archive' is visible
    - expect: A card filter dropdown 'All Cards' is visible
    - expect: Team indicator shows current team name

#### 4.2. Archive Source Type Filtering

**File:** `tests/archive/archive-source-filter.spec.ts`

**Steps:**
  1. Click the 'Intel' source type filter button
    - expect: Only articles with Intel source type are displayed
    - expect: The Intel button appears selected/active
  2. Click the 'News' source type filter button
    - expect: Only articles with News source type are displayed
  3. Click the active filter button again to deselect it
    - expect: All articles are displayed again
  4. Click the 'Reporting' source type filter button
    - expect: Only articles with Reporting source type are displayed
  5. Test each remaining source type button (Orders, Social, Phone, Email)
    - expect: Each button correctly filters to show only articles of that source type

#### 4.3. Archive Search

**File:** `tests/archive/archive-search.spec.ts`

**Steps:**
  1. Enter a keyword in the 'Search the Archive' field that matches an article title
    - expect: Only articles with matching titles or content are displayed
  2. Clear the search field
    - expect: All articles are displayed again
  3. Enter a keyword that matches no articles
    - expect: No articles are displayed
    - expect: An empty state or 'no results' message appears

#### 4.4. Archive Card Filtering

**File:** `tests/archive/archive-card-filter.spec.ts`

**Steps:**
  1. Click the 'All Cards' dropdown
    - expect: A list of available cards is displayed
  2. Select a specific card from the dropdown
    - expect: Only articles belonging to the selected card are displayed
  3. Select 'All Cards' or clear the filter
    - expect: All articles are displayed again

#### 4.5. Archive Combined Filters

**File:** `tests/archive/archive-combined-filters.spec.ts`

**Steps:**
  1. Enter a search term AND select a source type filter button
    - expect: Only articles matching both the search term and source type are displayed
  2. Additionally select a specific card from the dropdown
    - expect: Articles are further filtered to match all three criteria
  3. Clear all filters one by one
    - expect: Article list expands as each filter is removed
    - expect: All articles show when all filters are cleared

#### 4.6. Archive Article View Action

**File:** `tests/archive/archive-article-view.spec.ts`

**Steps:**
  1. Click the 'View' button on an article in the archive
    - expect: Article detail view opens
    - expect: Full article content is displayed with all metadata

#### 4.7. Archive Article Read Toggle

**File:** `tests/archive/archive-article-read.spec.ts`

**Steps:**
  1. Observe an article's 'Read' button state (checkbox icon should be unchecked)
    - expect: The Read button shows an unchecked icon indicating the article is unread
  2. Click the 'Read' button on an unread article
    - expect: The Read button icon changes to checked/filled indicating the article is now read
  3. Click the 'Read' button again to toggle back to unread
    - expect: The Read button icon changes back to unchecked

#### 4.8. Archive Article Share

**File:** `tests/archive/archive-article-share.spec.ts`

**Steps:**
  1. Click the 'Share' button on an article
    - expect: A share dialog opens
    - expect: Team selector is available to choose teams to share with
    - expect: A message field may be available
  2. Select one or more teams and click Share/Save
    - expect: Article is shared with the selected teams
    - expect: Success message appears
  3. Cancel the share dialog without sharing
    - expect: Dialog closes without sharing the article

#### 4.9. Archive Navigation

**File:** `tests/archive/archive-navigation.spec.ts`

**Steps:**
  1. Click the 'Wall' button from the Archive view
    - expect: User is navigated to the Wall view for the same exhibit
  2. Click the 'Administration' button from the Archive view
    - expect: User is navigated to the admin section
  3. Click the Gallery logo in the top navigation
    - expect: User is navigated to the My Exhibits home page

### 5. Collection Management

**Seed:** `tests/seed.spec.ts`

#### 5.1. View Collections List

**File:** `tests/collections/view-collections.spec.ts`

**Steps:**
  1. Log in as admin and navigate to Administration > Collections
    - expect: Collections list page loads with a table showing Name, Description, Created columns
    - expect: Pagination controls are visible with 'Items per page' selector
    - expect: Search field is visible
    - expect: Add Collection button (plus icon) is visible
    - expect: Upload Collection button (upload icon) is visible
  2. Observe each collection row
    - expect: Each row has action buttons: Edit (pencil), Copy (clipboard), Download (download), Delete (trash)
    - expect: Collection name, description, and created date are displayed

#### 5.2. Create New Collection

**File:** `tests/collections/create-collection.spec.ts`

**Steps:**
  1. Navigate to admin Collections and click the 'Add Collection' button (plus icon)
    - expect: A collection creation dialog opens with form fields
  2. Enter a collection name and description
    - expect: Text is entered successfully in both fields
  3. Click 'Save' button
    - expect: Collection is created successfully
    - expect: New collection appears in the collections list

#### 5.3. Edit Existing Collection

**File:** `tests/collections/edit-collection.spec.ts`

**Steps:**
  1. Click the Edit button (pencil icon) on a collection row
    - expect: Collection edit dialog opens
    - expect: Current collection name and description are pre-populated
  2. Modify the collection name and description
    - expect: Fields accept the changes
  3. Click 'Save' button
    - expect: Collection is updated successfully
    - expect: Changes are reflected in the collections list

#### 5.4. Copy Collection

**File:** `tests/collections/copy-collection.spec.ts`

**Steps:**
  1. Click the Copy button (clipboard icon) on a collection row
    - expect: A new collection is created as a copy of the original
    - expect: The copied collection appears in the list
    - expect: The copied collection has the same structure (exhibits, cards, articles) as the original

#### 5.5. Download Collection as JSON

**File:** `tests/collections/download-collection.spec.ts`

**Steps:**
  1. Click the Download button (download icon) on a collection row
    - expect: A JSON file download begins
    - expect: The downloaded file contains the collection data including exhibits, cards, and articles

#### 5.6. Upload Collection from JSON

**File:** `tests/collections/upload-collection.spec.ts`

**Steps:**
  1. Click the 'Upload Collection' button (upload icon) in the collections header
    - expect: A file upload dialog or file chooser opens
  2. Select a valid JSON collection file to upload
    - expect: The collection is imported successfully
    - expect: The new collection appears in the list with all its data

#### 5.7. Delete Collection

**File:** `tests/collections/delete-collection.spec.ts`

**Steps:**
  1. Click the Delete button (trash icon) on a collection row
    - expect: A confirmation dialog appears asking to confirm deletion
  2. Click 'Cancel' in the confirmation dialog
    - expect: Dialog closes
    - expect: Collection is not deleted
  3. Click Delete again and confirm
    - expect: Collection is deleted successfully
    - expect: Collection is removed from the list

#### 5.8. Collection List Sorting and Search

**File:** `tests/collections/collection-sorting-search.spec.ts`

**Steps:**
  1. Click the 'Name' column header in the collections table
    - expect: Collections are sorted by name
    - expect: Sort indicator arrow is visible
  2. Click the 'Description' column header
    - expect: Collections are sorted by description
  3. Click the 'Created' column header
    - expect: Collections are sorted by created date
  4. Enter a search term in the Search field
    - expect: Collections list filters to show only matching collections
  5. Clear the search field
    - expect: All collections are displayed again

#### 5.9. Collection List Pagination

**File:** `tests/collections/collection-pagination.spec.ts`

**Steps:**
  1. Observe the pagination controls below the search field
    - expect: Items per page selector is visible (default: 10)
    - expect: Current page range is displayed (e.g. '1 - 6 of 6')
    - expect: Previous/Next page buttons are visible
  2. Change the items per page using the selector
    - expect: The table updates to show the selected number of items per page

### 6. Exhibit Management

**Seed:** `tests/seed.spec.ts`

#### 6.1. View Exhibits List

**File:** `tests/exhibits/view-exhibits.spec.ts`

**Steps:**
  1. Navigate to admin section and click 'Exhibits' in the sidebar
    - expect: Exhibits section loads with a 'Select a Collection' dropdown
    - expect: No exhibits are shown until a collection is selected
  2. Select a collection from the dropdown
    - expect: Exhibits for the selected collection are displayed in a table
    - expect: Table shows columns: Name, Created, User, Move, Inject
    - expect: Each exhibit row has action buttons: Edit, Copy, Download, Delete
    - expect: Add Exhibit and Upload Exhibit buttons appear in the header
    - expect: Pagination controls are visible

#### 6.2. Create New Exhibit

**File:** `tests/exhibits/create-exhibit.spec.ts`

**Steps:**
  1. Select a collection in the Exhibits admin, then click 'Add Exhibit' button
    - expect: An exhibit creation dialog opens with form fields
  2. Enter an exhibit name and description
    - expect: Text is entered successfully
  3. Set Current Move and Current Inject values
    - expect: Numeric values are accepted
  4. Optionally set a Scenario ID
    - expect: Scenario ID field accepts a GUID value
  5. Toggle the 'Show Advance Button' checkbox
    - expect: Checkbox toggles on/off
  6. Click 'Save' button
    - expect: Exhibit is created successfully
    - expect: New exhibit appears in the list with correct Move and Inject values

#### 6.3. Edit Existing Exhibit

**File:** `tests/exhibits/edit-exhibit.spec.ts`

**Steps:**
  1. Click the Edit button (pencil icon) on an exhibit row
    - expect: Exhibit edit dialog opens with 'Edit Exhibit' title
    - expect: ID field is shown but disabled
    - expect: Name, Description, Current Move, Current Inject, Scenario ID fields are populated
    - expect: 'Show Advance Button' checkbox reflects current state
  2. Modify the exhibit name and description
    - expect: Fields accept changes
  3. Change Current Move and Current Inject values
    - expect: Numeric values are updated
  4. Toggle 'Show Advance Button' checkbox
    - expect: Checkbox state changes
  5. Click 'Save' button
    - expect: Exhibit is updated successfully
    - expect: Changes are reflected in the exhibit list
  6. Click 'Cancel' button instead of Save
    - expect: Dialog closes without saving changes

#### 6.4. Copy Exhibit

**File:** `tests/exhibits/copy-exhibit.spec.ts`

**Steps:**
  1. Click the Copy button (clipboard icon) on an exhibit row
    - expect: A new exhibit is created as a copy of the original
    - expect: The copied exhibit appears in the list
    - expect: The copied exhibit retains the same cards and articles as the original

#### 6.5. Download Exhibit as JSON

**File:** `tests/exhibits/download-exhibit.spec.ts`

**Steps:**
  1. Click the Download button (download icon) on an exhibit row
    - expect: A JSON file download begins
    - expect: The downloaded file contains the exhibit data including cards, articles, and teams

#### 6.6. Upload Exhibit from JSON

**File:** `tests/exhibits/upload-exhibit.spec.ts`

**Steps:**
  1. Click the 'Upload Exhibit' button (upload icon) in the exhibits header
    - expect: A file upload dialog or file chooser opens
  2. Select a valid JSON exhibit file to upload
    - expect: The exhibit is imported successfully
    - expect: The new exhibit appears in the list with all its data

#### 6.7. Delete Exhibit

**File:** `tests/exhibits/delete-exhibit.spec.ts`

**Steps:**
  1. Click the Delete button (trash icon) on an exhibit row
    - expect: A confirmation dialog appears
  2. Click 'Cancel' in the confirmation dialog
    - expect: Dialog closes
    - expect: Exhibit is not deleted
  3. Click Delete again and confirm
    - expect: Exhibit is deleted successfully
    - expect: Exhibit is removed from the list

#### 6.8. Exhibit List Sorting

**File:** `tests/exhibits/exhibit-sorting.spec.ts`

**Steps:**
  1. Click the 'Name' column header in the exhibits table
    - expect: Exhibits are sorted by name
  2. Click the 'Created' column header
    - expect: Exhibits are sorted by creation date
  3. Click the 'User' column header
    - expect: Exhibits are sorted by user/creator
  4. Click the 'Move' column header
    - expect: Exhibits are sorted by current move value
  5. Click the 'Inject' column header
    - expect: Exhibits are sorted by current inject value

### 7. User Management

**Seed:** `tests/seed.spec.ts`

#### 7.1. View Users List

**File:** `tests/users/view-users.spec.ts`

**Steps:**
  1. Navigate to admin section and click 'Users' in the sidebar
    - expect: Users list page loads with a table showing ID, Name, Role columns
    - expect: Each user row shows their UUID with a Copy button, full name, and role dropdown
    - expect: Pagination controls with 'Items per page' selector (default: 20) are visible
    - expect: Search field is visible
    - expect: Add User button is visible

#### 7.2. User ID Copy Button

**File:** `tests/users/user-id-copy.spec.ts`

**Steps:**
  1. Click the Copy button (clipboard icon) next to a user's ID
    - expect: The user's UUID is copied to the clipboard

#### 7.3. User Role Assignment

**File:** `tests/users/user-role-assignment.spec.ts`

**Steps:**
  1. Observe the Role dropdown for a user (showing 'None Locally')
    - expect: The role dropdown is visible with current value
  2. Click the Role dropdown for a user
    - expect: Available roles are listed (e.g., None Locally, Administrator, Content Developer, Observer)
  3. Select a different role (e.g., 'Content Developer')
    - expect: The user's role is updated
    - expect: The dropdown reflects the new role
  4. Change the role back to 'None Locally'
    - expect: The user's role is reverted

#### 7.4. Delete User

**File:** `tests/users/delete-user.spec.ts`

**Steps:**
  1. Click the 'Delete User' button (trash icon) on a user row
    - expect: A confirmation dialog appears
  2. Confirm deletion
    - expect: User is deleted successfully
    - expect: User is removed from the list

#### 7.5. User Search and Pagination

**File:** `tests/users/user-search-pagination.spec.ts`

**Steps:**
  1. Enter a search term in the Search field
    - expect: User list filters to show only matching users
  2. Clear the search field
    - expect: All users are displayed again
  3. Change the 'Items per page' selector
    - expect: The number of displayed users changes accordingly

### 8. Role and Permission Management

**Seed:** `tests/seed.spec.ts`

#### 8.1. System Roles Permission Matrix

**File:** `tests/roles/system-roles-matrix.spec.ts`

**Steps:**
  1. Navigate to admin section and click 'Roles' in the sidebar
    - expect: Roles management page loads with three tabs: 'Roles', 'Collection Roles', 'Exhibit Roles'
    - expect: The 'Roles' tab is selected by default
    - expect: A permission matrix table is displayed with permission rows and role columns
    - expect: Default roles shown: Administrator (all checked, disabled), Content Developer, Observer
  2. Observe the permission rows
    - expect: Permissions listed include: All, CreateCollections, ViewCollections, EditCollections, ManageCollections, CreateExhibits, ViewExhibits, EditExhibits, ManageExhibits, ViewUsers, ManageUsers, ViewRoles, ManageRoles, ViewGroups, ManageGroups
    - expect: Each permission row has an info button
    - expect: Administrator column has all checkboxes checked and disabled
  3. Toggle a permission checkbox for the Content Developer role (e.g., toggle ManageCollections)
    - expect: The checkbox state changes
    - expect: The permission is granted or revoked for that role
  4. Click the 'All' row checkbox for a non-Administrator role
    - expect: All permissions for that role are toggled on or off

#### 8.2. Add Custom System Role

**File:** `tests/roles/add-system-role.spec.ts`

**Steps:**
  1. Click the Add Role button (plus icon) in the Roles tab header
    - expect: A dialog or input appears to enter the new role name
  2. Enter a new role name and confirm
    - expect: A new column appears in the permission matrix for the new role
    - expect: All permissions are unchecked by default
  3. Toggle specific permissions for the new role
    - expect: Permissions are assigned to the new role

#### 8.3. Rename System Role

**File:** `tests/roles/rename-system-role.spec.ts`

**Steps:**
  1. Click the 'Rename Role' button (pencil icon) on a custom role column header
    - expect: A rename dialog or inline edit appears
  2. Enter a new name and confirm
    - expect: The role column header updates to show the new name

#### 8.4. Delete System Role

**File:** `tests/roles/delete-system-role.spec.ts`

**Steps:**
  1. Click the 'Delete Role' button (trash icon) on a custom role column header
    - expect: A confirmation dialog appears
  2. Confirm deletion
    - expect: The role column is removed from the permission matrix
    - expect: Users previously assigned this role no longer have it

#### 8.5. Collection Roles Tab

**File:** `tests/roles/collection-roles.spec.ts`

**Steps:**
  1. Click the 'Collection Roles' tab
    - expect: Collection Roles tab content is displayed
    - expect: A permission matrix shows Collection-level roles: Manager, Member, Observer
    - expect: Permission rows: All, ViewCollection, EditCollection, ManageCollection
    - expect: All checkboxes are disabled (read-only display)
  2. Observe the Manager role permissions
    - expect: Manager has all collection permissions checked
  3. Observe the Member role permissions
    - expect: Member has ViewCollection and EditCollection checked
  4. Observe the Observer role permissions
    - expect: Observer has only ViewCollection checked

#### 8.6. Exhibit Roles Tab

**File:** `tests/roles/exhibit-roles.spec.ts`

**Steps:**
  1. Click the 'Exhibit Roles' tab
    - expect: Exhibit Roles tab content is displayed
    - expect: A permission matrix shows Exhibit-level roles: Manager, Member, Observer
    - expect: Permission rows: All, ViewExhibit, EditExhibit, ManageExhibit
    - expect: All checkboxes are disabled (read-only display)
  2. Observe the Manager role permissions
    - expect: Manager has all exhibit permissions checked
  3. Observe the Member role permissions
    - expect: Member has ViewExhibit and EditExhibit checked
  4. Observe the Observer role permissions
    - expect: Observer has only ViewExhibit checked

### 9. Group Management

**Seed:** `tests/seed.spec.ts`

#### 9.1. View Groups List

**File:** `tests/groups/view-groups.spec.ts`

**Steps:**
  1. Navigate to admin section and click 'Groups' in the sidebar
    - expect: Groups list page loads with a table showing 'Group Name' column
    - expect: A 'Search Groups' text field is visible
    - expect: A 'Clear Search' button is visible (disabled when no search term)
    - expect: An Add Group button (plus icon) is visible

#### 9.2. Create Group

**File:** `tests/groups/create-group.spec.ts`

**Steps:**
  1. Click the Add Group button (plus icon)
    - expect: A group creation dialog or form opens
  2. Enter a group name and save
    - expect: Group is created successfully
    - expect: New group appears in the groups list

#### 9.3. Search Groups

**File:** `tests/groups/search-groups.spec.ts`

**Steps:**
  1. Enter a search term in the 'Search Groups' field
    - expect: Groups list filters to show only matching groups
    - expect: Clear Search button becomes enabled
  2. Click the 'Clear Search' button
    - expect: Search field is cleared
    - expect: All groups are displayed again
    - expect: Clear Search button becomes disabled

#### 9.4. Group Membership Management

**File:** `tests/groups/group-memberships.spec.ts`

**Steps:**
  1. Click on a group to view its details
    - expect: Group detail view opens showing group information and memberships
  2. Add a membership (link the group to a collection or exhibit)
    - expect: Membership is created successfully
  3. Remove a membership from the group
    - expect: Membership is removed successfully

### 10. Admin Navigation and UI

**Seed:** `tests/seed.spec.ts`

#### 10.1. Admin Sidebar Navigation

**File:** `tests/ui/admin-sidebar.spec.ts`

**Steps:**
  1. Navigate to admin section
    - expect: The admin page has a left sidebar with sections: Collections, Exhibits, Users, Roles, Groups
    - expect: Each section has an icon and expandable button
    - expect: A 'Versions: UI x.x.x, API x.x.x' label is displayed at the bottom of the sidebar
    - expect: An 'Exit Administration' link with the heading 'Administration' is visible at the top
  2. Click 'Collections' in the sidebar
    - expect: Collections admin view loads
    - expect: URL updates to include section=collections or similar
  3. Click 'Exhibits' in the sidebar
    - expect: Exhibits admin view loads with Collection dropdown
  4. Click 'Users' in the sidebar
    - expect: Users admin view loads
  5. Click 'Roles' in the sidebar
    - expect: Roles admin view loads with three tabs
  6. Click 'Groups' in the sidebar
    - expect: Groups admin view loads

#### 10.2. Exit Administration

**File:** `tests/ui/exit-admin.spec.ts`

**Steps:**
  1. Click the 'Administration' link (with logo) at the top of the admin sidebar
    - expect: User is navigated back to the My Exhibits home page
    - expect: URL changes to /

#### 10.3. Top Navigation Bar

**File:** `tests/ui/top-navigation.spec.ts`

**Steps:**
  1. Log in and observe the top navigation bar
    - expect: Gallery logo/icon is visible on the left as a clickable link
    - expect: Application title 'Gallery - Exercise Information Sharing' is displayed
    - expect: 'Admin User' button is visible on the right
  2. Click the Gallery logo
    - expect: User is navigated to the My Exhibits home page
  3. Click 'Admin User' button
    - expect: Dropdown menu appears with 'Administration', 'Logout', and 'Dark Theme' toggle

#### 10.4. Version Display

**File:** `tests/ui/version-display.spec.ts`

**Steps:**
  1. Navigate to the admin section
    - expect: Version information is displayed at the bottom of the sidebar (e.g. 'Versions: UI 0.0.0, API 0.0.0')

### 11. Article Management

**Seed:** `tests/seed.spec.ts`

#### 11.1. Create New Article

**File:** `tests/articles/create-article.spec.ts`

**Steps:**
  1. Navigate to the Archive view for an exhibit and locate the article creation functionality (or via admin)
    - expect: Article creation interface is accessible
  2. Fill in the article name
    - expect: Name field accepts text
  3. Fill in summary and description/content
    - expect: Summary and description fields accept text
  4. Select a source type from available options (Intel, News, Social, Email, Phone, Reporting, Orders)
    - expect: Source type is selected
  5. Select a card to associate with the article
    - expect: Card dropdown shows available cards
    - expect: Card is selected
  6. Set Move and Inject numbers
    - expect: Move and Inject fields accept numeric values
  7. Set the date posted
    - expect: Date picker allows date selection
  8. Optionally set URL and 'Open in New Tab' option
    - expect: URL field accepts a URL string
    - expect: Open in New Tab checkbox toggles
  9. Click 'Save' or 'Create' button
    - expect: Article is created successfully
    - expect: New article appears in the archive list

#### 11.2. Edit Existing Article

**File:** `tests/articles/edit-article.spec.ts`

**Steps:**
  1. Open the edit dialog for an existing article
    - expect: Article edit form opens with pre-populated data
  2. Modify the article name, summary, and description
    - expect: Fields accept the changes
  3. Change the source type
    - expect: Source type dropdown allows selection change
  4. Change the status (Unused, Closed, Critical, Affected, Open)
    - expect: Status dropdown allows selection
  5. Click 'Save' button
    - expect: Article is updated successfully
    - expect: Changes are reflected in the archive and wall views

#### 11.3. Delete Article

**File:** `tests/articles/delete-article.spec.ts`

**Steps:**
  1. Open the delete action for an article
    - expect: Confirmation dialog appears
  2. Click 'Cancel' in the confirmation dialog
    - expect: Dialog closes
    - expect: Article is not deleted
  3. Click Delete again and confirm
    - expect: Article is deleted successfully
    - expect: Article is removed from the list

#### 11.4. Article Status Workflow

**File:** `tests/articles/article-status.spec.ts`

**Steps:**
  1. Create or edit an article and set status to 'Unused' (0)
    - expect: Article status is set to Unused
  2. Change status to 'Open' (50)
    - expect: Status updates to Open
  3. Change status to 'Affected' (40)
    - expect: Status updates to Affected
  4. Change status to 'Critical' (20)
    - expect: Status updates to Critical
  5. Change status to 'Closed' (10)
    - expect: Status updates to Closed
  6. Verify status is displayed correctly in the archive and wall views
    - expect: Status indicator reflects the current status across all views

### 12. Card Management

**Seed:** `tests/seed.spec.ts`

#### 12.1. View and Create Cards

**File:** `tests/cards/view-create-cards.spec.ts`

**Steps:**
  1. Navigate to a collection's card management in admin (via exhibit or collection editing)
    - expect: Cards list is accessible with card details
  2. Create a new card with name and description
    - expect: Card is created and appears in the list

#### 12.2. Edit and Delete Cards

**File:** `tests/cards/edit-delete-cards.spec.ts`

**Steps:**
  1. Edit an existing card by modifying its name and description
    - expect: Changes are saved successfully
  2. Delete a card
    - expect: Card is removed from the list
    - expect: Associated articles are handled appropriately

### 13. Team Management

**Seed:** `tests/seed.spec.ts`

#### 13.1. View Exhibit Teams

**File:** `tests/teams/view-exhibit-teams.spec.ts`

**Steps:**
  1. Navigate to an exhibit's team management in admin
    - expect: List of teams associated with the exhibit is displayed

#### 13.2. Create and Manage Teams

**File:** `tests/teams/create-manage-teams.spec.ts`

**Steps:**
  1. Create a new team for an exhibit
    - expect: Team is created and appears in the team list
  2. Edit the team name
    - expect: Team name is updated
  3. Delete the team
    - expect: Team is removed from the list

#### 13.3. Team Selector in Wall and Archive

**File:** `tests/teams/team-selector.spec.ts`

**Steps:**
  1. Navigate to the Wall view and observe the team indicator
    - expect: Team name is displayed (e.g. 'Team: CONTROL')
  2. Navigate to the Archive view and observe the team indicator
    - expect: The same team is displayed

### 14. Integration and API

**Seed:** `tests/seed.spec.ts`

#### 14.1. API Health Check

**File:** `tests/integration/api-health-check.spec.ts`

**Steps:**
  1. Make a request to http://localhost:4722/api/health/live
    - expect: Health endpoint responds with status 200
    - expect: Response body contains status: 'Healthy'
  2. Make a request to http://localhost:4722/api/health/ready
    - expect: Readiness endpoint responds with status 200
    - expect: Response body contains status: 'Healthy'
  3. Make a request to http://localhost:4722/api/version
    - expect: Version endpoint responds with the current API version string

#### 14.2. Keycloak Authentication Integration

**File:** `tests/integration/keycloak-auth.spec.ts`

**Steps:**
  1. Navigate to http://localhost:4723
    - expect: Application redirects to Keycloak login page at https://localhost:8443/realms/crucible
  2. Enter valid credentials and submit
    - expect: Keycloak authenticates the user
    - expect: User is redirected back to Gallery via auth-callback
    - expect: User lands on the My Exhibits page

#### 14.3. SignalR Real-Time Connection

**File:** `tests/integration/signalr-connection.spec.ts`

**Steps:**
  1. Log in and navigate to an exhibit Wall or Archive view
    - expect: Console logs show SignalR WebSocket transport connected successfully

#### 14.4. Data Persistence

**File:** `tests/integration/data-persistence.spec.ts`

**Steps:**
  1. Create a new collection in admin
    - expect: Collection is created and appears in the list
  2. Refresh the page
    - expect: The created collection persists and is still displayed
  3. Edit the collection name
    - expect: Changes are saved
  4. Refresh the page again
    - expect: Updated name persists
  5. Delete the collection
    - expect: Collection is removed
  6. Refresh the page
    - expect: The deleted collection no longer appears

### 15. Edge Cases and Negative Testing

**Seed:** `tests/seed.spec.ts`

#### 15.1. Empty States

**File:** `tests/edge-cases/empty-states.spec.ts`

**Steps:**
  1. Navigate to the My Exhibits page with no exhibits assigned to the user
    - expect: 'No results found' message is displayed in the table
  2. Navigate to the admin Collections page and search for a non-existent collection
    - expect: Empty table is displayed
    - expect: Pagination shows '0 of 0'
  3. Navigate to Exhibits admin with a collection that has no exhibits
    - expect: Empty table with no rows
    - expect: Pagination shows '0 of 0'
  4. Navigate to admin Groups with no groups defined
    - expect: Empty group list is displayed

#### 15.2. Special Characters and Input Sanitization

**File:** `tests/edge-cases/special-characters.spec.ts`

**Steps:**
  1. Create a collection with special characters in the name (e.g., <script>alert('xss')</script>)
    - expect: Special characters are handled correctly
    - expect: No XSS vulnerabilities
    - expect: Name is stored and displayed properly escaped
  2. Create a collection with Unicode characters (e.g., emojis, CJK characters)
    - expect: Unicode characters are stored and displayed correctly
  3. Enter HTML tags in a description field
    - expect: HTML is escaped or rendered harmless

#### 15.3. Advance at Last Move or Inject

**File:** `tests/edge-cases/advance-boundary.spec.ts`

**Steps:**
  1. Navigate to an exhibit at the last move/inject and click the 'Advance' button
    - expect: An error message or notification appears indicating 'Already at the last move/inject'
    - expect: The move/inject values do not change

#### 15.4. Invalid Upload Files

**File:** `tests/edge-cases/invalid-upload.spec.ts`

**Steps:**
  1. Attempt to upload a non-JSON file as a collection
    - expect: An error message appears indicating invalid file format
  2. Attempt to upload a malformed JSON file as a collection
    - expect: An error message appears indicating invalid JSON structure
  3. Attempt to upload a non-JSON file as an exhibit
    - expect: An error message appears indicating invalid file format

#### 15.5. Navigation to Non-Existent Resources

**File:** `tests/edge-cases/non-existent-resources.spec.ts`

**Steps:**
  1. Navigate to http://localhost:4723/?exhibit=00000000-0000-0000-0000-000000000000 (non-existent exhibit ID)
    - expect: An error is handled gracefully
    - expect: User is shown an appropriate message or redirected
  2. Navigate to http://localhost:4723/invalid-route
    - expect: Application handles the invalid route gracefully

#### 15.6. Concurrent Operations

**File:** `tests/edge-cases/concurrent-operations.spec.ts`

**Steps:**
  1. Rapidly click the Advance button multiple times
    - expect: The application handles rapid clicks gracefully without errors
    - expect: Move/inject advances correctly without skipping
  2. Open the same article in two browser contexts and mark Read in both
    - expect: Both operations complete without errors

#### 15.7. Collection and Exhibit Download Upload Round Trip

**File:** `tests/edge-cases/download-upload-roundtrip.spec.ts`

**Steps:**
  1. Download a collection as JSON
    - expect: JSON file is downloaded successfully
  2. Upload the same JSON file as a new collection
    - expect: A new collection is created from the uploaded file
    - expect: The new collection matches the original in structure and content
  3. Download an exhibit as JSON
    - expect: JSON file is downloaded successfully
  4. Upload the same JSON file as a new exhibit
    - expect: A new exhibit is created from the uploaded file
    - expect: The new exhibit matches the original

### 16. Responsive Design and Accessibility

**Seed:** `tests/seed.spec.ts`

#### 16.1. Responsive Design

**File:** `tests/ui/responsive-design.spec.ts`

**Steps:**
  1. Resize the browser window to mobile dimensions (e.g., 375x667)
    - expect: Application layout adjusts to mobile view
    - expect: Content is readable without horizontal scrolling
  2. Navigate through My Exhibits, Wall, Archive, and Admin on mobile
    - expect: All pages are accessible and functional on mobile
  3. Resize back to desktop dimensions
    - expect: Application returns to desktop layout

#### 16.2. Keyboard Navigation

**File:** `tests/ui/keyboard-navigation.spec.ts`

**Steps:**
  1. Navigate the application using Tab, Enter, and Escape keys
    - expect: All interactive elements (buttons, links, form fields) are reachable via keyboard
    - expect: Focus indicators are visible
    - expect: Dialogs can be closed with Escape

#### 16.3. Dialog and Modal Behavior

**File:** `tests/ui/dialog-behavior.spec.ts`

**Steps:**
  1. Open a dialog (e.g., Edit Exhibit)
    - expect: Dialog appears as a modal overlay
    - expect: Focus is within the dialog
  2. Click the 'Cancel' button (X icon) in the dialog header
    - expect: Dialog closes without saving changes
  3. Open a dialog, press the Escape key
    - expect: Dialog closes
  4. Open a dialog, make changes, click 'Save'
    - expect: Dialog processes the action and closes
    - expect: Changes are persisted
