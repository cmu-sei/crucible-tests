# TopoMojo Comprehensive Test Plan (Updated)

## Application Overview

TopoMojo is a virtual lab builder and player application that enables users to create, manage, and deploy network topology simulations for cybersecurity training. The application consists of workspaces (lab templates), gamespaces (active lab instances), templates (VM configurations), virtual machines, and administrative features. Users can create training content with virtual machines, publish workspaces, deploy gamespaces for hands-on training, and manage the entire lifecycle of virtual lab environments. The application integrates with Keycloak for authentication and supports role-based access control with creator, admin, and observer roles.

This updated test plan covers recent feature additions including: configurable background images, enhanced sidebar with pin functionality, favorites for workspaces/gamespaces/templates, sortable admin table headers, IDP role assignment warnings, enhanced About page with version info and external links, and various UI improvements.

## Test Scenarios

### 1. Authentication and Authorization

**Seed:** `seed.spec.ts`

#### 1.1. Successful Authentication Flow

**File:** `topomojo/tests/authentication/successful-authentication.spec.ts`

**Steps:**
  1. Navigate to TopoMojo UI at http://localhost:4201
    - expect: User is redirected to Keycloak login page at https://localhost:8443
    - expect: Keycloak login form is displayed with username and password fields
  2. Enter valid username 'admin' in the username field
    - expect: Username field accepts input
  3. Enter valid password 'admin' in the password field
    - expect: Password field accepts input and masks the password
  4. Click the 'Sign In' button
    - expect: User is authenticated and redirected back to TopoMojo UI at http://localhost:4201
    - expect: TopoMojo home page displays
    - expect: User profile/menu is visible in top navigation

#### 1.2. Failed Authentication - Invalid Credentials

**File:** `topomojo/tests/authentication/failed-authentication-invalid-credentials.spec.ts`

**Steps:**
  1. Navigate to TopoMojo UI at http://localhost:4201
    - expect: User is redirected to Keycloak login page
  2. Enter invalid username 'invaliduser' in the username field
    - expect: Username field accepts input
  3. Enter invalid password 'wrongpassword' in the password field
    - expect: Password field accepts input
  4. Click the 'Sign In' button
    - expect: Authentication fails
    - expect: Error message is displayed indicating invalid credentials
    - expect: User remains on Keycloak login page

#### 1.3. Session Persistence After Refresh

**File:** `topomojo/tests/authentication/session-persistence.spec.ts`

**Steps:**
  1. Log in with valid credentials (admin/admin)
    - expect: User is successfully authenticated and viewing TopoMojo home page
  2. Refresh the browser page
    - expect: User remains authenticated
    - expect: Home page loads without redirecting to Keycloak
    - expect: User session is maintained

#### 1.4. Logout Functionality

**File:** `topomojo/tests/authentication/logout.spec.ts`

**Steps:**
  1. Log in with valid credentials (admin/admin)
    - expect: User is successfully authenticated
  2. Click 'Logout' button in top navigation
    - expect: User is logged out
    - expect: User is redirected to login or home page
    - expect: Authentication session is terminated
  3. Attempt to navigate to TopoMojo UI again
    - expect: User is redirected to Keycloak login page
    - expect: User must authenticate again

#### 1.5. Unauthorized Access Protection

**File:** `topomojo/tests/authentication/unauthorized-access.spec.ts`

**Steps:**
  1. Clear all cookies and local storage to simulate unauthenticated state
    - expect: Session is cleared
  2. Attempt to navigate directly to a protected route (e.g., http://localhost:4201/admin)
    - expect: User is redirected to Keycloak login page
    - expect: Protected route is not accessible without authentication

#### 1.6. Role-Based Access - Admin Access

**File:** `topomojo/tests/authentication/admin-access-authorized.spec.ts`

**Steps:**
  1. Log in as user with admin role (admin/admin)
    - expect: User is authenticated
  2. Navigate to /admin route
    - expect: Admin page loads successfully
    - expect: Admin navigation menu is visible
    - expect: Admin dashboard displays

#### 1.7. Role-Based Access - Non-Admin Restricted

**File:** `topomojo/tests/authentication/admin-access-unauthorized.spec.ts`

**Steps:**
  1. Log in as user without admin role
    - expect: User is authenticated
  2. Attempt to navigate to /admin route
    - expect: Access is denied
    - expect: User is redirected or shown error message
    - expect: Admin interface is not accessible

### 2. Home Page and Navigation

**Seed:** `seed.spec.ts`

#### 2.1. Home Page Display

**File:** `topomojo/tests/home/home-page-display.spec.ts`

**Steps:**
  1. Log in and land on home page
    - expect: Home page displays with TopoMojo branding
    - expect: Navigation bar is visible at top
    - expect: Workspace browser component is visible or can be opened via sidebar

#### 2.2. Navigation Bar Elements

**File:** `topomojo/tests/home/navigation-bar-elements.spec.ts`

**Steps:**
  1. Log in and observe top navigation bar
    - expect: Navigation bar contains TopoMojo branding
    - expect: Home button is visible
    - expect: About button is visible
    - expect: Admin button is visible for admin users
    - expect: Logout button is visible

#### 2.3. Sidebar Toggle and Pin

**File:** `topomojo/tests/home/sidebar-toggle-and-pin.spec.ts`

**Steps:**
  1. Log in and navigate to home page
    - expect: Sidebar hamburger menu button is visible at top of sidebar
    - expect: Hamburger button has proper aria-label for accessibility
  2. Click hamburger menu button to toggle sidebar open
    - expect: Sidebar opens showing workspace browser
    - expect: Hamburger button remains visible at top
  3. Click hamburger menu button again to close sidebar
    - expect: Sidebar closes
    - expect: Hamburger button still visible and accessible
  4. Open sidebar and click pin button in sidebar footer
    - expect: Sidebar is pinned open
    - expect: Pin icon changes to indicate pinned state
    - expect: Sidebar remains open when clicking outside
  5. Click pin button again to unpin
    - expect: Sidebar is unpinned
    - expect: Pin icon changes to unpinned state
  6. With sidebar unpinned, open sidebar and click outside sidebar area
    - expect: Sidebar closes automatically
    - expect: Main content area is clickable

#### 2.4. Sidebar Hamburger Button Accessibility

**File:** `topomojo/tests/home/sidebar-hamburger-accessibility.spec.ts`

**Steps:**
  1. Log in and observe sidebar hamburger button
    - expect: Hamburger button is a proper <button> element (not a div)
    - expect: Button has aria-label='Toggle sidebar'
    - expect: Button is always visible regardless of sidebar state
  2. Use keyboard to focus on hamburger button and press Enter
    - expect: Sidebar toggles open/closed via keyboard
    - expect: Button is fully keyboard accessible

### 3. Workspace Management

**Seed:** `seed.spec.ts`

#### 3.1. Workspace List Display

**File:** `topomojo/tests/workspace/workspace-list-display.spec.ts`

**Steps:**
  1. Log in and open sidebar to view workspace browser
    - expect: Workspace browser displays list of workspaces
    - expect: Workspace cards show name and metadata
    - expect: Each workspace has action links when hovered or selected

#### 3.2. Workspace List - Empty State

**File:** `topomojo/tests/workspace/workspace-list-empty-state.spec.ts`

**Steps:**
  1. Log in as user with no workspaces
    - expect: Empty state message is displayed or workspace list is empty
    - expect: Create workspace button is visible if user has creator role

#### 3.3. Workspace Search

**File:** `topomojo/tests/workspace/workspace-search.spec.ts`

**Steps:**
  1. Navigate to workspace browser with multiple workspaces
    - expect: Workspace list displays multiple workspaces
    - expect: Search input field is visible
  2. Enter search term in search field
    - expect: Workspace list filters to show matching workspaces only
    - expect: Non-matching workspaces are hidden
    - expect: Search results update in real-time
  3. Clear search field
    - expect: All workspaces are displayed again

#### 3.4. Workspace Filter Toggle

**File:** `topomojo/tests/workspace/workspace-filter.spec.ts`

**Steps:**
  1. Navigate to workspace browser
    - expect: Filter toggle or tabs are visible (e.g., 'My Workspaces', 'All Workspaces')
  2. Click on different filter options
    - expect: Workspace list updates based on selected filter
    - expect: Filter selection is highlighted
    - expect: Filter preference may be saved

#### 3.5. Create Workspace - Authorized Creator

**File:** `topomojo/tests/workspace/create-workspace-authorized.spec.ts`

**Steps:**
  1. Log in as user with creator role
    - expect: User is on home page
    - expect: Create workspace button is visible
  2. Click 'Create Workspace' button
    - expect: Create workspace dialog opens
    - expect: Form fields for workspace name and description are displayed
  3. Enter workspace name 'Test Lab'
    - expect: Name field accepts input
  4. Enter workspace description 'A test cybersecurity lab'
    - expect: Description field accepts input
  5. Click 'Create' or 'Save' button
    - expect: Workspace is created successfully
    - expect: Success message or notification is displayed
    - expect: User is navigated to workspace editor page

#### 3.6. Create Workspace - Unauthorized User

**File:** `topomojo/tests/workspace/create-workspace-unauthorized.spec.ts`

**Steps:**
  1. Log in as user without creator role
    - expect: User is on home page
  2. Look for 'Create Workspace' button
    - expect: Create workspace button is not visible or is disabled

#### 3.7. Create Workspace - Validation - Required Fields

**File:** `topomojo/tests/workspace/create-workspace-validation-required.spec.ts`

**Steps:**
  1. Open create workspace dialog
    - expect: Create workspace form is displayed
  2. Leave workspace name field empty
    - expect: Name field is empty
  3. Attempt to submit form
    - expect: Form validation prevents submission
    - expect: Error message indicates name is required

#### 3.8. Clone Workspace

**File:** `topomojo/tests/workspace/clone-workspace.spec.ts`

**Steps:**
  1. Navigate to workspace list with existing workspaces
    - expect: Workspace list displays
  2. Click clone/duplicate button on a workspace card
    - expect: Clone confirmation dialog may appear
    - expect: Clone process begins
  3. Confirm clone action
    - expect: New workspace is created as a clone
    - expect: Cloned workspace appears in workspace list
    - expect: Cloned workspace has unique ID

#### 3.9. Navigate to Workspace Editor

**File:** `topomojo/tests/workspace/navigate-to-workspace-editor.spec.ts`

**Steps:**
  1. Navigate to workspace list
    - expect: Workspace list displays
  2. Click on a workspace card or 'Settings' link when hovering
    - expect: User is navigated to workspace editor page
    - expect: URL changes to /topo/:id/settings format
    - expect: Workspace editor interface loads

#### 3.10. Workspace Favorites - Add Favorite

**File:** `topomojo/tests/workspace/workspace-favorite-add.spec.ts`

**Steps:**
  1. Navigate to workspace list in sidebar
    - expect: Workspace list displays
  2. Hover over a workspace card
    - expect: Favorite star icon appears (outline/regular style)
    - expect: Star icon is clickable
  3. Click the star icon to favorite the workspace
    - expect: Workspace is marked as favorite
    - expect: Star icon changes to filled/solid style with 'favorite-on' styling
    - expect: Workspace is pinned to top of list even when sorting

#### 3.11. Workspace Favorites - Remove Favorite

**File:** `topomojo/tests/workspace/workspace-favorite-remove.spec.ts`

**Steps:**
  1. Navigate to workspace list with previously favorited workspace
    - expect: Favorited workspace displays with filled/solid star icon
    - expect: Favorited workspace is pinned to top
  2. Click the filled star icon on favorited workspace
    - expect: Workspace is removed from favorites
    - expect: Star icon changes to outline/regular style
    - expect: Workspace position changes based on current sort order

#### 3.12. Workspace Mode Toggle - Workspace vs Gamespace View

**File:** `topomojo/tests/workspace/workspace-mode-toggle.spec.ts`

**Steps:**
  1. Navigate to home page workspace browser
    - expect: Mode toggle is visible (e.g., tabs or buttons for 'Workspaces' and 'Gamespaces')
  2. Click on 'Gamespaces' mode
    - expect: View switches to gamespace mode
    - expect: Active and playable gamespaces are displayed
    - expect: Mode preference may be saved
  3. Click on 'Workspaces' mode
    - expect: View switches back to workspace mode
    - expect: Workspace list is displayed

### 4. Workspace Editor

**Seed:** `seed.spec.ts`

#### 4.1. Workspace Editor - Settings Tab

**File:** `topomojo/tests/workspace-editor/settings-tab.spec.ts`

**Steps:**
  1. Navigate to workspace editor for an existing workspace
    - expect: Workspace editor page loads
    - expect: Tabs or sections are visible (Settings, Templates, Document, Challenge, Files, Play)
    - expect: Settings tab is selected by default
  2. Observe settings form
    - expect: Settings form displays fields for workspace name, description, audience, etc.
    - expect: Form fields are populated with current workspace data
    - expect: Workspace ID is displayed in text-muted style

#### 4.2. Workspace Editor - Update Settings

**File:** `topomojo/tests/workspace-editor/update-settings.spec.ts`

**Steps:**
  1. Navigate to workspace editor settings tab
    - expect: Settings form is displayed
  2. Modify workspace name to 'Updated Lab Name'
    - expect: Name field accepts changes
  3. Modify workspace description
    - expect: Description field accepts changes
  4. Click 'Save' button
    - expect: Workspace settings are updated successfully
    - expect: Success notification is displayed
    - expect: Updated values persist

#### 4.3. Workspace Editor - Audience Configuration

**File:** `topomojo/tests/workspace-editor/audience-configuration.spec.ts`

**Steps:**
  1. Navigate to workspace editor settings
    - expect: Audience field or section is visible
  2. Set or modify workspace audience (e.g., public, restricted)
    - expect: Audience field accepts selection
  3. Save workspace settings
    - expect: Audience configuration is saved
    - expect: Workspace visibility is updated based on audience

#### 4.4. Workspace Editor - Templates Tab

**File:** `topomojo/tests/workspace-editor/templates-tab.spec.ts`

**Steps:**
  1. Navigate to workspace editor
    - expect: Workspace editor tabs are visible
  2. Click on 'Templates' tab
    - expect: Templates tab is selected
    - expect: List of templates in the workspace is displayed
    - expect: Templates show VM name, configuration, and status

#### 4.5. Workspace Editor - Add Template

**File:** `topomojo/tests/workspace-editor/add-template.spec.ts`

**Steps:**
  1. Navigate to workspace editor templates tab
    - expect: Templates list is displayed
    - expect: Add template button is visible
  2. Click 'Add Template' button
    - expect: Template selector or form opens
    - expect: Available templates are shown
  3. Select a template or create new template
    - expect: Template is selected
  4. Configure template name and settings
    - expect: Template configuration form accepts input
  5. Save or add template
    - expect: Template is added to workspace
    - expect: Template appears in templates list

#### 4.6. Workspace Editor - Edit Template

**File:** `topomojo/tests/workspace-editor/edit-template.spec.ts`

**Steps:**
  1. Navigate to workspace editor templates tab with existing templates
    - expect: Templates list displays
  2. Click edit button on a template
    - expect: Template editor opens
    - expect: Template configuration form is displayed with current settings
  3. Modify template settings (e.g., name, CPU, memory, network)
    - expect: Form fields accept changes
  4. Save template changes
    - expect: Template is updated
    - expect: Changes are reflected in templates list

#### 4.7. Workspace Editor - Delete Template

**File:** `topomojo/tests/workspace-editor/delete-template.spec.ts`

**Steps:**
  1. Navigate to workspace editor templates tab
    - expect: Templates list displays
  2. Click delete button on a template
    - expect: Confirmation dialog appears
    - expect: Dialog warns about template deletion
  3. Confirm deletion
    - expect: Template is deleted
    - expect: Template is removed from list
    - expect: Success notification is displayed

#### 4.8. Workspace Editor - Document Tab

**File:** `topomojo/tests/workspace-editor/document-tab.spec.ts`

**Steps:**
  1. Navigate to workspace editor
    - expect: Workspace editor tabs are visible
  2. Click on 'Document' tab
    - expect: Document tab is selected
    - expect: Markdown editor or document display is shown

#### 4.9. Workspace Editor - Edit Document

**File:** `topomojo/tests/workspace-editor/edit-document.spec.ts`

**Steps:**
  1. Navigate to workspace document tab
    - expect: Document editor is displayed
    - expect: Editor supports markdown or rich text
  2. Enter or modify document content with instructions
    - expect: Editor accepts text input
    - expect: Markdown formatting works
  3. Save document
    - expect: Document is saved
    - expect: Content persists
    - expect: Preview shows formatted content if applicable

#### 4.10. Workspace Editor - Challenge Tab

**File:** `topomojo/tests/workspace-editor/challenge-tab.spec.ts`

**Steps:**
  1. Navigate to workspace editor
    - expect: Workspace editor tabs are visible
  2. Click on 'Challenge' tab
    - expect: Challenge tab is selected
    - expect: Challenge editor or list is displayed

#### 4.11. Workspace Editor - Create Challenge

**File:** `topomojo/tests/workspace-editor/create-challenge.spec.ts`

**Steps:**
  1. Navigate to workspace challenge tab
    - expect: Challenge editor is displayed
  2. Click 'Add Challenge' or 'Create Question' button
    - expect: Challenge form opens
  3. Enter challenge question text
    - expect: Question field accepts input
  4. Enter challenge answers and mark correct answer
    - expect: Answer fields accept input
    - expect: Correct answer can be designated
  5. Save challenge
    - expect: Challenge is saved
    - expect: Challenge appears in challenge list

#### 4.12. Workspace Editor - Invite Collaborators

**File:** `topomojo/tests/workspace-editor/invite-collaborators.spec.ts`

**Steps:**
  1. Navigate to workspace editor
    - expect: Workspace editor loads
  2. Look for 'Invite' or 'Share' button
    - expect: Invite functionality is available
  3. Click invite button
    - expect: Invite dialog opens
    - expect: Invite code or link is displayed or can be generated
  4. Copy invite link or code
    - expect: Link/code is copied to clipboard
    - expect: Invite can be shared with others

#### 4.13. Workspace Editor - Publish Workspace

**File:** `topomojo/tests/workspace-editor/publish-workspace.spec.ts`

**Steps:**
  1. Navigate to workspace editor settings
    - expect: Publish or visibility settings are available
  2. Set workspace to published status
    - expect: Publish toggle or checkbox can be enabled
  3. Save workspace settings
    - expect: Workspace is published
    - expect: Workspace becomes available for gamespace deployment

#### 4.14. Workspace Editor - Delete Workspace

**File:** `topomojo/tests/workspace-editor/delete-workspace.spec.ts`

**Steps:**
  1. Navigate to workspace editor
    - expect: Workspace editor loads
  2. Click 'Delete Workspace' button
    - expect: Confirmation dialog appears
    - expect: Dialog warns about permanent deletion
  3. Cancel deletion
    - expect: Dialog closes
    - expect: Workspace is not deleted
  4. Click delete again and confirm
    - expect: Workspace is deleted
    - expect: User is redirected to home page
    - expect: Workspace no longer appears in list

### 5. Gamespace Management

**Seed:** `seed.spec.ts`

#### 5.1. Gamespace List Display

**File:** `topomojo/tests/gamespace/gamespace-list-display.spec.ts`

**Steps:**
  1. Log in and switch to gamespace mode in sidebar
    - expect: Gamespace list displays
    - expect: Active gamespaces show status and metadata
    - expect: Playable workspaces are available

#### 5.2. Preview Gamespace

**File:** `topomojo/tests/gamespace/preview-gamespace.spec.ts`

**Steps:**
  1. Navigate to gamespace list with available workspaces
    - expect: Playable workspaces are displayed
  2. Click on a playable workspace card or 'Preview' button
    - expect: Gamespace preview page loads
    - expect: Preview shows workspace description and VMs
    - expect: Deploy or Start button is visible

#### 5.3. Deploy Gamespace

**File:** `topomojo/tests/gamespace/deploy-gamespace.spec.ts`

**Steps:**
  1. Navigate to gamespace preview for a published workspace
    - expect: Preview page displays with deploy option
  2. Click 'Deploy' or 'Start' button
    - expect: Gamespace deployment begins
    - expect: Loading indicator shows deployment progress
    - expect: Deployment may take time depending on VMs
  3. Wait for deployment to complete
    - expect: Gamespace deployment completes successfully
    - expect: User is navigated to active gamespace page
    - expect: VMs are listed and accessible

#### 5.4. Active Gamespace Display

**File:** `topomojo/tests/gamespace/active-gamespace-display.spec.ts`

**Steps:**
  1. Navigate to an active gamespace
    - expect: Gamespace page loads
    - expect: VM list is displayed
    - expect: Each VM shows name, status, and console access

#### 5.5. Gamespace VM Console Access

**File:** `topomojo/tests/gamespace/vm-console-access.spec.ts`

**Steps:**
  1. Navigate to active gamespace with running VMs
    - expect: VM list displays with console access buttons
  2. Click console button for a VM
    - expect: VM console opens in new window/tab or embedded view
    - expect: Console shows VM screen
    - expect: Console uses correct URL path with path-based routing support
    - expect: Console authentication works without requiring separate auth guard

#### 5.6. Gamespace VM Power Operations

**File:** `topomojo/tests/gamespace/vm-power-operations.spec.ts`

**Steps:**
  1. Navigate to active gamespace
    - expect: VM list displays with power control buttons
  2. Click power button for a VM (start/stop/restart)
    - expect: Power operation confirmation may appear
    - expect: VM state changes based on operation
    - expect: VM status updates (running/stopped)

#### 5.7. Gamespace Document View

**File:** `topomojo/tests/gamespace/gamespace-document-view.spec.ts`

**Steps:**
  1. Navigate to active gamespace
    - expect: Gamespace page displays
  2. Look for document/instructions tab or panel
    - expect: Document section is accessible
    - expect: Workspace instructions/document content is displayed

#### 5.8. Gamespace Challenge View

**File:** `topomojo/tests/gamespace/gamespace-challenge-view.spec.ts`

**Steps:**
  1. Navigate to active gamespace with challenges
    - expect: Challenge or quiz section is accessible
  2. View challenge questions
    - expect: Challenge questions are displayed
    - expect: Answer input fields are available

#### 5.9. Gamespace Challenge Submission

**File:** `topomojo/tests/gamespace/gamespace-challenge-submission.spec.ts`

**Steps:**
  1. Navigate to gamespace challenge section
    - expect: Challenge questions are displayed
  2. Enter answer to a challenge question
    - expect: Answer field accepts input
  3. Submit answer
    - expect: Answer is submitted
    - expect: Feedback is provided (correct/incorrect)
    - expect: Score or progress is updated

#### 5.10. Gamespace Join via Invite Code

**File:** `topomojo/tests/gamespace/gamespace-join-invite.spec.ts`

**Steps:**
  1. Navigate to gamespace join URL with invite code (e.g., /mojo/:id/:slug/:code)
    - expect: Join page loads
    - expect: Workspace/gamespace information is displayed
  2. Click 'Join' button
    - expect: User joins the gamespace
    - expect: Gamespace is deployed or user is added to existing session
    - expect: User is navigated to active gamespace

#### 5.11. Gamespace Extended Duration

**File:** `topomojo/tests/gamespace/gamespace-extend-duration.spec.ts`

**Steps:**
  1. Navigate to active gamespace nearing expiration
    - expect: Expiration timer or warning is visible
  2. Click 'Extend' button if available
    - expect: Gamespace duration is extended
    - expect: New expiration time is displayed
    - expect: Success notification appears

#### 5.12. Gamespace Cleanup/Delete

**File:** `topomojo/tests/gamespace/gamespace-cleanup.spec.ts`

**Steps:**
  1. Navigate to active gamespace
    - expect: Gamespace controls are visible
  2. Click 'End' or 'Delete Gamespace' button
    - expect: Confirmation dialog appears
  3. Confirm gamespace deletion
    - expect: Gamespace is cleaned up
    - expect: VMs are stopped and removed
    - expect: User is redirected to home page
    - expect: Gamespace no longer appears in active list

#### 5.13. Gamespace Favorites - Add Favorite

**File:** `topomojo/tests/gamespace/gamespace-favorite-add.spec.ts`

**Steps:**
  1. Navigate to gamespace list in sidebar
    - expect: Gamespace list displays
  2. Hover over a gamespace card
    - expect: Favorite star icon appears (outline/regular style) if user can favorite
    - expect: Star icon is clickable
  3. Click the star icon to favorite the gamespace
    - expect: Gamespace is marked as favorite
    - expect: Star icon changes to filled/solid style with 'favorite-on' styling
    - expect: Gamespace is pinned to top of list

#### 5.14. Gamespace Favorites - Remove Favorite

**File:** `topomojo/tests/gamespace/gamespace-favorite-remove.spec.ts`

**Steps:**
  1. Navigate to gamespace list with previously favorited gamespace
    - expect: Favorited gamespace displays with filled/solid star icon
    - expect: Favorited gamespace is pinned to top
  2. Click the filled star icon on favorited gamespace
    - expect: Gamespace is removed from favorites
    - expect: Star icon changes to outline/regular style
    - expect: Gamespace position may change in list

### 6. Template Management

**Seed:** `seed.spec.ts`

#### 6.1. Template List Display

**File:** `topomojo/tests/template/template-list-display.spec.ts`

**Steps:**
  1. Navigate to templates section (within workspace editor templates tab)
    - expect: Template list displays
    - expect: Templates show name, description, and metadata

#### 6.2. Template Details View

**File:** `topomojo/tests/template/template-details-view.spec.ts`

**Steps:**
  1. Click on a template from list
    - expect: Template details page loads
    - expect: Template configuration is displayed (CPU, memory, disk, network)
    - expect: ISO attachments are shown

#### 6.3. Template Edit Configuration

**File:** `topomojo/tests/template/template-edit-configuration.spec.ts`

**Steps:**
  1. Open template editor for existing template
    - expect: Template configuration form is displayed
  2. Modify template settings (e.g., CPU count, memory size)
    - expect: Form fields accept changes
  3. Save template
    - expect: Template is updated
    - expect: Changes are saved
    - expect: Success notification appears

#### 6.4. Template ISO Management

**File:** `topomojo/tests/template/template-iso-management.spec.ts`

**Steps:**
  1. Open template editor
    - expect: ISO management section is visible
  2. Click 'Attach ISO' or 'Select ISO' button
    - expect: ISO selector opens
    - expect: Available ISOs are listed
  3. Select an ISO from list
    - expect: ISO is attached to template
    - expect: ISO appears in attached ISOs list

#### 6.5. Template Network Configuration

**File:** `topomojo/tests/template/template-network-configuration.spec.ts`

**Steps:**
  1. Open template editor
    - expect: Network configuration section is visible
  2. Add or modify network interfaces
    - expect: Network interface form accepts input
    - expect: Network type and settings can be configured
  3. Save template
    - expect: Network configuration is saved
    - expect: Template reflects network changes

#### 6.6. Template Link to Parent

**File:** `topomojo/tests/template/template-link-parent.spec.ts`

**Steps:**
  1. Create or select a template
    - expect: Template editor is open
  2. Look for parent template or link option
    - expect: Parent template selector is available
  3. Link template to a parent template
    - expect: Template is linked as child
    - expect: Parent-child relationship is established

#### 6.7. Template Unlink from Parent

**File:** `topomojo/tests/template/template-unlink-parent.spec.ts`

**Steps:**
  1. Open template that is linked to parent
    - expect: Parent template relationship is shown
  2. Click 'Unlink' button
    - expect: Template is unlinked from parent
    - expect: Template becomes independent

### 7. File Management

**Seed:** `seed.spec.ts`

#### 7.1. File Browser Access

**File:** `topomojo/tests/files/file-browser-access.spec.ts`

**Steps:**
  1. Navigate to workspace editor
    - expect: Files or ISO management section is accessible
  2. Click on files/ISO tab or button
    - expect: File browser interface loads
    - expect: File list or upload area is displayed

#### 7.2. File Upload

**File:** `topomojo/tests/files/file-upload.spec.ts`

**Steps:**
  1. Navigate to file browser
    - expect: Upload button or dropzone is visible
  2. Click upload button or drag file to dropzone
    - expect: File selection dialog opens or file is accepted
  3. Select a file (e.g., ISO image)
    - expect: Upload begins
    - expect: Progress indicator shows upload status
  4. Wait for upload to complete
    - expect: File is uploaded successfully
    - expect: File appears in file list
    - expect: Success notification is shown

#### 7.3. File Upload - Invalid File Type

**File:** `topomojo/tests/files/file-upload-invalid-type.spec.ts`

**Steps:**
  1. Navigate to file browser
    - expect: Upload interface is available
  2. Attempt to upload invalid file type
    - expect: Validation error is displayed
    - expect: Error indicates invalid file type
    - expect: Upload is prevented

#### 7.4. File Upload - Oversized File

**File:** `topomojo/tests/files/file-upload-oversized.spec.ts`

**Steps:**
  1. Navigate to file browser
    - expect: Upload interface is available
  2. Attempt to upload file larger than maximum size
    - expect: Validation error is displayed
    - expect: Error indicates file is too large
    - expect: Upload is prevented or fails gracefully

#### 7.5. File Delete

**File:** `topomojo/tests/files/file-delete.spec.ts`

**Steps:**
  1. Navigate to file browser with existing files
    - expect: File list displays
  2. Click delete button on a file
    - expect: Confirmation dialog appears
  3. Confirm deletion
    - expect: File is deleted
    - expect: File is removed from list
    - expect: Success notification appears

### 8. Admin Panel

**Seed:** `seed.spec.ts`

#### 8.1. Admin Dashboard Access

**File:** `topomojo/tests/admin/admin-dashboard-access.spec.ts`

**Steps:**
  1. Log in as admin user
    - expect: User is authenticated
  2. Navigate to /admin route
    - expect: Admin dashboard loads
    - expect: Admin navigation menu is visible
    - expect: Dashboard shows admin sections (Users, Workspaces, Gamespaces, Templates, VMs, Settings)

#### 8.2. Admin - User Browser

**File:** `topomojo/tests/admin/admin-user-browser.spec.ts`

**Steps:**
  1. Navigate to admin dashboard
    - expect: Admin menu is visible
  2. Click on 'Users' section
    - expect: User browser page loads
    - expect: List of users is displayed in table format
    - expect: User details include name, role, and created date

#### 8.3. Admin - User Browser Sortable Headers

**File:** `topomojo/tests/admin/admin-user-browser-sorting.spec.ts`

**Steps:**
  1. Navigate to admin user browser
    - expect: User list displays with table headers
    - expect: Headers for 'Name' and 'Created' are visible and clickable
  2. Click on 'Name' column header
    - expect: Users are sorted by name in ascending order (A-Z)
    - expect: Sort indicator (up arrow icon) appears on Name column
  3. Click on 'Name' column header again
    - expect: Users are sorted by name in descending order (Z-A)
    - expect: Sort indicator changes to down arrow icon
  4. Click on 'Created' column header
    - expect: Users are sorted by creation date
    - expect: Sort indicator appears on Created column
    - expect: Sort field switches from Name to Created

#### 8.4. Admin - Edit User Role

**File:** `topomojo/tests/admin/admin-edit-user-role.spec.ts`

**Steps:**
  1. Navigate to admin user browser
    - expect: User list displays
  2. Click on a user or view user details
    - expect: User details form opens
    - expect: User role badge is displayed showing current role
  3. Modify user appRole (e.g., grant creator or admin role)
    - expect: Role selection accepts changes
    - expect: Role change updates the user's appRole field
  4. Save changes
    - expect: User role is updated
    - expect: Changes are reflected in user list

#### 8.5. Admin - User Role Badge and IDP Conflict Warning

**File:** `topomojo/tests/admin/admin-user-role-idp-conflict.spec.ts`

**Steps:**
  1. Navigate to admin user browser
    - expect: User list displays with role information
  2. Observe a user where IDP-assigned role differs from app role
    - expect: User role badge displays both IDP role and app role
    - expect: Effective role (highest permission) is shown
    - expect: Warning indicator appears for role mismatch
  3. Click on the effective role badge or warning indicator
    - expect: Modal opens explaining the role conflict
    - expect: Modal shows IDP role vs app role
    - expect: Modal explains that effective role is the higher permission level
  4. Close the modal
    - expect: Modal closes
    - expect: User returns to user browser view

#### 8.6. Admin - Workspace Browser

**File:** `topomojo/tests/admin/admin-workspace-browser.spec.ts`

**Steps:**
  1. Navigate to admin dashboard
    - expect: Admin menu is visible
  2. Click on 'Workspaces' section
    - expect: Admin workspace browser loads
    - expect: All workspaces are listed in table format
    - expect: Workspaces show name, owner, created date, and activity

#### 8.7. Admin - Workspace Browser Sortable Headers

**File:** `topomojo/tests/admin/admin-workspace-browser-sorting.spec.ts`

**Steps:**
  1. Navigate to admin workspace browser
    - expect: Workspace list displays with table headers
    - expect: Headers for 'Name', 'Created', and 'Activity' are clickable
  2. Click on 'Name' column header
    - expect: Workspaces are sorted by name alphabetically
    - expect: Sort indicator appears on Name column
    - expect: Favorited workspaces remain pinned to top
  3. Click on 'Created' column header
    - expect: Workspaces are sorted by creation date
    - expect: Sort indicator appears on Created column
    - expect: Favorited workspaces remain pinned to top
  4. Click on 'Activity' column header
    - expect: Workspaces are sorted by last activity date
    - expect: Sort indicator appears on Activity column

#### 8.8. Admin - Workspace Browser Favorites

**File:** `topomojo/tests/admin/admin-workspace-browser-favorites.spec.ts`

**Steps:**
  1. Navigate to admin workspace browser
    - expect: Workspace list displays
  2. Click the star icon on a workspace to favorite it
    - expect: Workspace is favorited
    - expect: Star icon changes to filled/solid style
    - expect: Workspace is pinned to top of list even when sorting
  3. Apply different sort orders (by name, created, activity)
    - expect: Favorited workspaces remain at the top
    - expect: Non-favorited workspaces are sorted below favorites
  4. Click the filled star icon to unfavorite
    - expect: Workspace is unfavorited
    - expect: Star icon changes to outline style
    - expect: Workspace moves based on current sort order

#### 8.9. Admin - Delete Workspace from Browser

**File:** `topomojo/tests/admin/admin-workspace-browser-delete.spec.ts`

**Steps:**
  1. Navigate to admin workspace browser
    - expect: Workspace list displays
  2. Click on a workspace to view details
    - expect: Workspace details are displayed in side panel or detail view
    - expect: Delete button is visible
  3. Click 'Delete' button
    - expect: Confirmation dialog appears
    - expect: Disabled confirm button is hidden via CSS (.confirm-wrap > button[disabled] { display: none; })
  4. Confirm deletion
    - expect: Workspace is deleted
    - expect: Viewed workspace state is cleared
    - expect: Workspace is removed from list
    - expect: List refreshes to show updated workspaces

#### 8.10. Admin - Gamespace Browser

**File:** `topomojo/tests/admin/admin-gamespace-browser.spec.ts`

**Steps:**
  1. Navigate to admin dashboard
    - expect: Admin menu is visible
  2. Click on 'Gamespaces' section
    - expect: Admin gamespace browser loads
    - expect: All active gamespaces are listed
    - expect: Gamespaces show workspace name, user, status, and VMs

#### 8.11. Admin - Gamespace Browser Sortable Headers

**File:** `topomojo/tests/admin/admin-gamespace-browser-sorting.spec.ts`

**Steps:**
  1. Navigate to admin gamespace browser
    - expect: Gamespace list displays with table headers
    - expect: Sortable column headers are clickable
  2. Click on column headers to sort gamespaces
    - expect: Gamespaces are sorted based on selected column
    - expect: Sort indicators (up/down arrows) appear on active column

#### 8.12. Admin - Gamespace Details

**File:** `topomojo/tests/admin/admin-gamespace-details.spec.ts`

**Steps:**
  1. Navigate to admin gamespace browser
    - expect: Gamespace list displays
  2. Click on a gamespace
    - expect: Gamespace details page loads
    - expect: VM list and statuses are shown
    - expect: User information is displayed

#### 8.13. Admin - Forcefully End Gamespace

**File:** `topomojo/tests/admin/admin-end-gamespace.spec.ts`

**Steps:**
  1. Navigate to admin gamespace details
    - expect: Gamespace details and controls are visible
  2. Click 'End' or 'Delete' gamespace button
    - expect: Confirmation dialog appears
  3. Confirm action
    - expect: Gamespace is forcefully ended
    - expect: VMs are cleaned up
    - expect: Gamespace is removed from active list

#### 8.14. Admin - Template Browser

**File:** `topomojo/tests/admin/admin-template-browser.spec.ts`

**Steps:**
  1. Navigate to admin dashboard
    - expect: Admin menu is visible
  2. Click on 'Templates' section
    - expect: Admin template browser loads
    - expect: All templates are listed
    - expect: Templates show name, workspace, and configuration

#### 8.15. Admin - Template Browser Sortable Headers

**File:** `topomojo/tests/admin/admin-template-browser-sorting.spec.ts`

**Steps:**
  1. Navigate to admin template browser
    - expect: Template list displays with table headers
    - expect: Column headers are clickable for sorting
  2. Click on 'Name' column header to sort templates by name
    - expect: Templates are sorted alphabetically by name
    - expect: Sort indicator appears on Name column
    - expect: Favorited templates remain pinned to top

#### 8.16. Admin - Template Favorites

**File:** `topomojo/tests/admin/admin-template-favorites.spec.ts`

**Steps:**
  1. Navigate to admin template browser
    - expect: Template list displays
  2. Click the star icon on a template to favorite it
    - expect: Template is favorited
    - expect: Star icon changes to filled/solid style
    - expect: Template is pinned to top of list
    - expect: Tooltip shows 'Favorite (pin)' or 'Unfavorite (pin)'
  3. Apply sorting by name or other criteria
    - expect: Favorited templates remain at the top
    - expect: Non-favorited templates are sorted below
  4. Click the filled star icon to unfavorite
    - expect: Template is unfavorited
    - expect: Star icon changes to outline style
    - expect: Template moves based on current sort order

#### 8.17. Admin - VM Browser

**File:** `topomojo/tests/admin/admin-vm-browser.spec.ts`

**Steps:**
  1. Navigate to admin dashboard
    - expect: Admin menu is visible
  2. Click on 'VMs' section
    - expect: VM browser loads
    - expect: All VMs are listed
    - expect: VMs show name, status, gamespace, and resource usage

#### 8.18. Admin - VM Browser Sortable Headers

**File:** `topomojo/tests/admin/admin-vm-browser-sorting.spec.ts`

**Steps:**
  1. Navigate to admin VM browser
    - expect: VM list displays with table headers
    - expect: Column headers are clickable for sorting
  2. Click on column headers to sort VMs
    - expect: VMs are sorted based on selected column
    - expect: Sort indicators appear on active column

#### 8.19. Admin - Settings Browser

**File:** `topomojo/tests/admin/admin-settings-browser.spec.ts`

**Steps:**
  1. Navigate to admin dashboard
    - expect: Admin menu is visible
  2. Click on 'Settings' section
    - expect: Settings page loads
    - expect: Setting browser component is displayed
    - expect: System configuration options are available

#### 8.20. Admin - Modify System Settings

**File:** `topomojo/tests/admin/admin-modify-settings.spec.ts`

**Steps:**
  1. Navigate to admin settings
    - expect: Settings form is displayed
  2. Modify a system setting (e.g., workspace limit, timeout)
    - expect: Setting field accepts change
  3. Save settings
    - expect: Settings are updated
    - expect: Success notification appears
    - expect: New settings take effect

#### 8.21. Admin - Configure Background Image

**File:** `topomojo/tests/admin/admin-configure-background-image.spec.ts`

**Steps:**
  1. Navigate to admin settings/setting-browser section
    - expect: Setting browser component loads
    - expect: Background image configuration section is visible
    - expect: Current background preview is shown (if any)
  2. Click 'Choose File' or file input to select background image
    - expect: File selection dialog opens
    - expect: Only image files are accepted
  3. Select a valid image file under 5MB
    - expect: File is validated for type (must be image/*) and size (max 5MB)
    - expect: Upload begins with uploading indicator
    - expect: Preview updates to show selected image
  4. Wait for upload to complete
    - expect: Background image is uploaded successfully
    - expect: Image is applied to application background via CSS custom property --app-bg-image
    - expect: Document root has 'has-bg-image' class applied
    - expect: Preview shows uploaded image

#### 8.22. Admin - Configure Background Image - Validation

**File:** `topomojo/tests/admin/admin-background-image-validation.spec.ts`

**Steps:**
  1. Navigate to admin setting browser background image section
    - expect: Background image upload interface is visible
  2. Attempt to upload non-image file
    - expect: Validation error appears: 'Please choose an image file.'
    - expect: Upload is prevented
  3. Attempt to upload image larger than 5MB
    - expect: Validation error appears: 'Image is too large. Please use an image under 5MB.'
    - expect: Upload is prevented

#### 8.23. Admin - Clear Background Image

**File:** `topomojo/tests/admin/admin-clear-background-image.spec.ts`

**Steps:**
  1. Navigate to admin setting browser with background image configured
    - expect: Current background image is displayed in preview
    - expect: Clear button is visible
  2. Click 'Clear' or 'Remove' background button
    - expect: Background image is cleared
    - expect: Preview shows no background image
    - expect: Application background reverts to default (--app-bg-image: none)
    - expect: 'has-bg-image' class is removed from document root

#### 8.24. Admin - API Keys Management

**File:** `topomojo/tests/admin/admin-apikeys-management.spec.ts`

**Steps:**
  1. Navigate to admin dashboard
    - expect: Admin menu is visible
  2. Click on 'API Keys' section
    - expect: API keys page loads
    - expect: List of API keys is displayed

#### 8.25. Admin - Create API Key

**File:** `topomojo/tests/admin/admin-create-apikey.spec.ts`

**Steps:**
  1. Navigate to admin API keys page
    - expect: API keys list is displayed
  2. Click 'Create API Key' button
    - expect: API key creation form opens
  3. Enter API key name and select permissions
    - expect: Form accepts input
  4. Click 'Create' button
    - expect: API key is created
    - expect: API key value is displayed
    - expect: User can copy API key

#### 8.26. Admin - Revoke API Key

**File:** `topomojo/tests/admin/admin-revoke-apikey.spec.ts`

**Steps:**
  1. Navigate to admin API keys page with existing keys
    - expect: API keys list displays
  2. Click 'Revoke' button on an API key
    - expect: Confirmation dialog appears
  3. Confirm revocation
    - expect: API key is revoked
    - expect: API key is removed from list or marked as revoked

#### 8.27. Admin - Log Viewer

**File:** `topomojo/tests/admin/admin-log-viewer.spec.ts`

**Steps:**
  1. Navigate to admin dashboard
    - expect: Admin menu is visible
  2. Click on 'Logs' section
    - expect: Log viewer page loads
    - expect: System logs are displayed
    - expect: Logs show timestamp, level, and message

#### 8.28. Admin - Observer Mode

**File:** `topomojo/tests/admin/admin-observer-mode.spec.ts`

**Steps:**
  1. Log in as user with observer role
    - expect: User is authenticated
  2. Navigate to /observe route
    - expect: Observer page loads
    - expect: Observer can view gamespaces without interacting
    - expect: Read-only view is enforced

### 9. About Page

**Seed:** `seed.spec.ts`

#### 9.1. About Page Display

**File:** `topomojo/tests/about/about-page-display.spec.ts`

**Steps:**
  1. Log in and navigate to About page via navigation button
    - expect: About page loads at /about route
    - expect: Page displays 'TopoMojo' heading
    - expect: Tagline/description is visible: 'Cybersecurity training labs and exercises in isolated, secure virtual environments.'

#### 9.2. About Page - Version Information

**File:** `topomojo/tests/about/about-page-version-info.spec.ts`

**Steps:**
  1. Navigate to About page
    - expect: About page loads
  2. Observe version information section
    - expect: UI version is displayed
    - expect: API version is displayed
    - expect: Version info is retrieved from /api/health/version endpoint

#### 9.3. About Page - Content Sections

**File:** `topomojo/tests/about/about-page-content.spec.ts`

**Steps:**
  1. Navigate to About page
    - expect: About page loads
  2. Scroll through page content
    - expect: 'About' section describes TopoMojo's purpose and features
    - expect: 'Workspace and Gamespace' section explains the difference between workspaces and gamespaces
    - expect: 'Hotkeys' section displays keyboard shortcuts in a table format
    - expect: 'License' section shows copyright and license information

#### 9.4. About Page - External Links

**File:** `topomojo/tests/about/about-page-external-links.spec.ts`

**Steps:**
  1. Navigate to About page
    - expect: About page loads
    - expect: Resources sidebar is visible if external links are not disabled
  2. Observe Resources section in sidebar
    - expect: 'Source code (GitHub)' link is visible and opens in new tab
    - expect: 'Documentation' link is visible and opens in new tab
    - expect: 'License' link is visible and opens in new tab
    - expect: All links have target='_blank' and rel='noopener noreferrer'

#### 9.5. About Page - Hotkeys Table

**File:** `topomojo/tests/about/about-page-hotkeys.spec.ts`

**Steps:**
  1. Navigate to About page and locate Hotkeys section
    - expect: Hotkeys table is displayed
  2. Review hotkey information
    - expect: General hotkeys include: Ctrl-O (Open workspace), Ctrl-L (Toggle left panel), Ctrl-H (Navigate home)
    - expect: Workspace hotkeys include: Ctrl-1 through Ctrl-6 for various workspace tabs
    - expect: All hotkeys are documented with group, key, and action

#### 9.6. About Page - License Information

**File:** `topomojo/tests/about/about-page-license.spec.ts`

**Steps:**
  1. Navigate to About page and locate License section
    - expect: License section is visible
  2. Review license information
    - expect: Copyright notice displays: '© 2025 Carnegie Mellon University. All Rights Reserved.'
    - expect: License summary describes redistribution terms
    - expect: Link to full license is available if external links are enabled

#### 9.7. About Page - Health Check Error Handling

**File:** `topomojo/tests/about/about-page-health-error.spec.ts`

**Steps:**
  1. Navigate to About page when API health endpoint is unavailable
    - expect: About page loads
    - expect: Error message is displayed for version information
    - expect: Page remains functional despite version fetch failure

### 10. Search and Filtering

**Seed:** `seed.spec.ts`

#### 10.1. Search - Keyboard Shortcut

**File:** `topomojo/tests/search/search-keyboard-shortcut.spec.ts`

**Steps:**
  1. Navigate to home page
    - expect: Home page is displayed
  2. Press Ctrl+O keyboard shortcut
    - expect: Search field is focused or sidebar opens
    - expect: Search input is highlighted

#### 10.2. Search - Real-time Results

**File:** `topomojo/tests/search/search-realtime-results.spec.ts`

**Steps:**
  1. Navigate to workspace browser
    - expect: Search field is visible
  2. Type search term character by character
    - expect: Results update in real-time as user types
    - expect: Matching workspaces are highlighted or filtered

#### 10.3. Filter - My Workspaces

**File:** `topomojo/tests/search/filter-my-workspaces.spec.ts`

**Steps:**
  1. Navigate to workspace browser
    - expect: Filter options are visible
  2. Select 'My Workspaces' filter
    - expect: Only workspaces owned by current user are displayed
    - expect: Other workspaces are hidden

#### 10.4. Filter - All Workspaces

**File:** `topomojo/tests/search/filter-all-workspaces.spec.ts`

**Steps:**
  1. Navigate to workspace browser as admin
    - expect: Filter options are visible
  2. Select 'All Workspaces' filter
    - expect: All workspaces in system are displayed
    - expect: Workspaces from all users are shown

### 11. Real-time Updates and Notifications

**Seed:** `seed.spec.ts`

#### 11.1. Real-time Workspace Updates

**File:** `topomojo/tests/realtime/workspace-updates.spec.ts`

**Steps:**
  1. Open workspace in two browser windows for same user
    - expect: Both windows show same workspace
  2. Make change in one window (e.g., update description)
    - expect: Change is reflected in second window in real-time via SignalR

#### 11.2. Real-time Gamespace Status Updates

**File:** `topomojo/tests/realtime/gamespace-status-updates.spec.ts`

**Steps:**
  1. Open active gamespace
    - expect: Gamespace displays with VMs
  2. Trigger VM state change (e.g., start/stop VM)
    - expect: VM status updates in real-time
    - expect: Status indicator changes without page refresh

#### 11.3. Presence Indicator

**File:** `topomojo/tests/realtime/presence-indicator.spec.ts`

**Steps:**
  1. Open workspace with collaboration features
    - expect: Presence bar or indicator is visible
  2. Have another user join same workspace
    - expect: Other user's presence is shown
    - expect: User count or avatars update in real-time

### 12. Error Handling and Edge Cases

**Seed:** `seed.spec.ts`

#### 12.1. Network Failure Handling

**File:** `topomojo/tests/error-handling/network-failure.spec.ts`

**Steps:**
  1. Log in successfully
    - expect: User is authenticated
  2. Simulate network failure (disconnect network)
    - expect: Application detects connection loss
  3. Attempt to perform action requiring API call
    - expect: Error message is displayed
    - expect: User is notified of network issue
    - expect: Application remains stable

#### 12.2. API Error - Server Error 500

**File:** `topomojo/tests/error-handling/server-error-500.spec.ts`

**Steps:**
  1. Trigger API call that returns 500 error
    - expect: Application handles error gracefully
    - expect: Error message is displayed to user
    - expect: No uncaught exceptions in console

#### 12.3. Invalid Workspace ID

**File:** `topomojo/tests/error-handling/invalid-workspace-id.spec.ts`

**Steps:**
  1. Navigate to /topo/invalid-id-12345
    - expect: Error page is displayed
    - expect: User is notified workspace does not exist
    - expect: User can navigate back to home

#### 12.4. Invalid Gamespace ID

**File:** `topomojo/tests/error-handling/invalid-gamespace-id.spec.ts`

**Steps:**
  1. Navigate to /mojo/invalid-id-12345
    - expect: Error page is displayed
    - expect: User is notified gamespace does not exist or is not accessible

#### 12.5. Session Expiration

**File:** `topomojo/tests/error-handling/session-expiration.spec.ts`

**Steps:**
  1. Log in successfully
    - expect: User is authenticated
  2. Wait for session to expire or manually invalidate token
    - expect: Session expires
  3. Attempt to perform an action
    - expect: User is notified of session expiration
    - expect: User is redirected to login page

#### 12.6. Browser Back Button Navigation

**File:** `topomojo/tests/error-handling/back-button-navigation.spec.ts`

**Steps:**
  1. Navigate through multiple pages (home -> workspace editor -> gamespace)
    - expect: Navigation history is recorded
  2. Click browser back button
    - expect: User navigates back to previous page
    - expect: Page state is preserved or reloaded correctly
    - expect: No errors occur

#### 12.7. Concurrent Workspace Edits

**File:** `topomojo/tests/error-handling/concurrent-workspace-edits.spec.ts`

**Steps:**
  1. Open same workspace in two browser windows
    - expect: Both windows show same workspace
  2. Make conflicting edits in both windows simultaneously
    - expect: Application handles concurrent edits
    - expect: Changes are synchronized or conflict is detected
    - expect: No data corruption occurs

#### 12.8. Gamespace Deployment Failure

**File:** `topomojo/tests/error-handling/gamespace-deployment-failure.spec.ts`

**Steps:**
  1. Attempt to deploy gamespace with insufficient resources or configuration error
    - expect: Deployment fails gracefully
    - expect: Error message explains failure reason
    - expect: User can retry or modify configuration

#### 12.9. VM Console Connection Failure

**File:** `topomojo/tests/error-handling/vm-console-connection-failure.spec.ts`

**Steps:**
  1. Attempt to open VM console that is unavailable
    - expect: Console connection fails gracefully
    - expect: Error message is displayed
    - expect: User can retry connection

#### 12.10. Form Validation - Duplicate Workspace Name

**File:** `topomojo/tests/error-handling/duplicate-workspace-name.spec.ts`

**Steps:**
  1. Attempt to create workspace with name that already exists
    - expect: Validation error is displayed
    - expect: Error indicates name is already in use
    - expect: User can modify name

### 13. Accessibility

**Seed:** `seed.spec.ts`

#### 13.1. Keyboard Navigation - Tab Order

**File:** `topomojo/tests/accessibility/keyboard-tab-order.spec.ts`

**Steps:**
  1. Navigate to home page
    - expect: Page is loaded
  2. Press Tab key repeatedly
    - expect: Focus moves through elements in logical order
    - expect: All interactive elements are reachable
    - expect: Focus indicator is visible

#### 13.2. Keyboard Navigation - Form Submission

**File:** `topomojo/tests/accessibility/keyboard-form-submission.spec.ts`

**Steps:**
  1. Navigate to create workspace form
    - expect: Form is displayed
  2. Fill form using keyboard only
    - expect: All fields can be filled via keyboard
  3. Press Enter to submit form
    - expect: Form submits without requiring mouse click

#### 13.3. Screen Reader - Form Labels

**File:** `topomojo/tests/accessibility/screen-reader-form-labels.spec.ts`

**Steps:**
  1. Navigate to any form
    - expect: All form fields have associated labels
    - expect: Labels are programmatically linked to inputs
    - expect: Screen reader would announce labels correctly

#### 13.4. Screen Reader - Button Descriptions

**File:** `topomojo/tests/accessibility/screen-reader-button-descriptions.spec.ts`

**Steps:**
  1. Navigate to page with icon buttons
    - expect: All icon buttons have aria-labels or titles
    - expect: Button purposes are clear for screen readers
    - expect: Hamburger menu button has aria-label='Toggle sidebar'

#### 13.5. Color Contrast Compliance

**File:** `topomojo/tests/accessibility/color-contrast.spec.ts`

**Steps:**
  1. Run automated accessibility audit on pages
    - expect: Text meets WCAG contrast requirements
    - expect: No critical contrast violations are reported

### 14. Performance

**Seed:** `seed.spec.ts`

#### 14.1. Home Page Load Time

**File:** `topomojo/tests/performance/home-page-load-time.spec.ts`

**Steps:**
  1. Measure time from navigation to home page until fully loaded
    - expect: Home page loads within acceptable time (e.g., under 3 seconds)
    - expect: No blocking resources delay rendering

#### 14.2. Workspace List Load Performance

**File:** `topomojo/tests/performance/workspace-list-load.spec.ts`

**Steps:**
  1. Navigate to workspace browser with large number of workspaces
    - expect: Workspace list loads efficiently
    - expect: Pagination or virtual scrolling is used for large datasets
    - expect: UI remains responsive

#### 14.3. Gamespace Deployment Performance

**File:** `topomojo/tests/performance/gamespace-deployment-performance.spec.ts`

**Steps:**
  1. Deploy gamespace and measure deployment time
    - expect: Deployment progress is shown
    - expect: Deployment completes within expected timeframe
    - expect: No timeouts occur

#### 14.4. VM Console Loading Performance

**File:** `topomojo/tests/performance/vm-console-loading.spec.ts`

**Steps:**
  1. Open VM console and measure load time
    - expect: Console loads within acceptable time
    - expect: Console is responsive to input
    - expect: No lag in rendering
