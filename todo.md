# MoneyGoal Desktop - Project TODO

## Database Schema & Backend
- [x] Create database schema for Goals, Transactions, Categories, UserSettings, RecurringExpenses, Projects, Events
- [x] Implement tRPC procedures for Goals (create, update, list, filter, archive, delete)
- [x] Implement tRPC procedures for Transactions (create, update, list, filter, delete)
- [x] Implement tRPC procedures for Categories (create, list)
- [x] Implement tRPC procedures for UserSettings (create, update, get)
- [x] Implement tRPC procedures for RecurringExpenses (create, update, list, delete, toggle)
- [x] Implement tRPC procedures for Projects (create, update, list, filter, delete)
- [x] Implement tRPC procedures for Events (create, list, delete)
- [x] Add OpenAI API key to environment variables

## Frontend - Navigation & Layout
- [x] Create DashboardLayout with sidebar navigation
- [x] Configure routing for all pages (Dashboard, AQWorlds, Chat, Spending, Analytics, Archived, Settings)
- [x] Set up dark theme with purple/pink accent colors

## Frontend - Dashboard Page
- [x] Create Dashboard page with goal progress display
- [x] Implement Add Income/Expense buttons and modal
- [x] Display recent transactions list
- [x] Show goal progress with circular progress indicator
- [x] Implement edit goal functionality
- [x] Add congratulations modal for completed goals
- [x] Create new goal modal

## Frontend - AQWorlds Page
- [x] Create AQWorlds dashboard with project statistics
- [x] Implement event calendar display by month
- [x] Add project list with filtering by year and month
- [x] Create add project modal with calculator feature
- [x] Implement monthly status tracking with "Mark Paid" functionality
- [x] Add goal analysis section

## Frontend - Spending Page
- [x] Create spending analysis page with pie chart
- [x] Implement category breakdown with percentages
- [x] Add recurring expenses list
- [x] Create recurring expense modal
- [x] Implement filtering by category and time period
- [x] Add insights and recommendations section
- [x] Show fixed vs variable expense toggle

## Frontend - Analytics Page
- [x] Create analytics page with income/expense overview
- [x] Implement monthly overview bar chart
- [x] Add monthly saving target input
- [x] Display average monthly saving calculation
- [x] Show goal progress projection chart
- [x] Implement smart goal suggestions

## Frontend - Chat Page
- [x] Create chat interface with message history
- [x] Integrate OpenAI API for chat responses
- [x] Add example prompts for financial advice
- [x] Implement chat history persistence
- [x] Add "New Chat" functionality

## Frontend - Archived Page
- [x] Create archived goals list
- [x] Display completed goal details with progress
- [x] Implement view transaction logs modal
- [x] Add delete archived goal functionality

## Frontend - Settings Page
- [x] Create settings page with language, currency, and theme options
- [x] Implement save settings functionality
- [x] Add settings persistence to database

## Testing & Polish
- [x] Test user authentication flow
- [x] Test goal creation and completion
- [x] Test transaction CRUD operations
- [x] Test project tracking in AQWorlds
- [x] Test spending analytics and charts
- [x] Test chat with OpenAI
- [x] Test settings persistence
- [x] Verify data isolation between users
- [x] Test all modals and forms
- [x] Check responsive design on different screen sizes

## Deployment
- [x] Create checkpoint for deployment
- [x] Provide instructions for packaging as desktop executable

## New Features and Improvements

### Event Calendar Enhancements
- [x] Add default events for each month (January: Australia Day, Akiba New Year, Nulgath's Birthday, etc.)
- [x] Implement modal to edit events when clicking on a month card
- [x] Add ability to select/unselect events (selected events show in green)
- [x] Allow users to add custom events
- [x] Allow users to edit and delete custom events
- [x] Highlight months with at least 1 selected event with a special color

### Spending Page Improvements
- [x] Implement pie chart for spending distribution (replace current visualization)
- [x] Add "By Category" section with horizontal progress bars
- [x] Show percentage and comparison with previous period
- [x] Add filters: All, By Category, Fixed vs Variable
- [x] Add "Show Only Recurring" toggle

### Analytics Page Improvements
- [ ] Fix Monthly Average calculation to only consider months with at least 1 project
- [ ] Implement Projected Annual calculation with 3 scenarios (Conservative, Realistic, Optimistic)
- [ ] Add formulas for annual projections based on moving averages
- [ ] Show "Project to Year End" calculation

### AQWorlds (Projects) Improvements
- [ ] Implement Monthly Status section organized by month (most recent first)
- [ ] Add year selector showing only years with registered projects
- [ ] Add "Mark as Paid" functionality for monthly status
- [ ] When marked as paid, automatically create transaction log in dashboard
- [ ] When unmarked, automatically remove the transaction log
- [ ] Remove edit/delete icons from project list
- [ ] Implement modal when clicking project (with edit data, save, and delete buttons)
- [ ] Calculate Monthly Sets Average (only months with at least 1 set)

### UI/UX Improvements
- [x] Remove all scrollbars from the app (hide vertical and horizontal scrollbars)
- [x] Ensure app continues to scroll normally without showing scrollbars
- [ ] Maintain consistent design across all pages
- [ ] Ensure everything is reactive and updates in real-time

### Future Enhancements (Suggestions)
- [ ] Intelligent transaction categorization (learn from user's manual categorizations)
- [ ] Proactive alerts and notifications for AQWorlds events
- [ ] Financial goal alerts (when close to reaching or falling behind)
- [ ] Bill payment reminders
- [ ] Automated monthly/annual reports
- [ ] Intelligent goal review and suggestions based on income/expense history


## AQWorlds Page Fixes (Based on User Feedback)

### Statistics Cards
- [x] Add Total Annual card (sum of all projects for current year)
- [x] Add Monthly Average card (average revenue per month with projects)
- [x] Add Projected Annual card (projection based on current performance)
- [ ] Update Total Projects card to show year filter

### Goal Analysis Section
- [x] Add Goal Analysis card with Avg Set Value
- [x] Show Sets Needed for Goal calculation
- [x] Display Monthly Sets (avg) calculation

### Next Month Section
- [x] Create "Next Month" card showing upcoming month name
- [x] List all selected events for the next month)
- [ ] If no events selected, show message

### Monthly Status Section
- [x] Create Monthly Status section with year selector
- [x] List months in reverse order (most recent first)
- [x] Show project count and total revenue per month
- [x] Add "Mark Paid" button for each month
- [x] When marked paid, create transaction log in Dashboard
- [x] When unmarked, remove transaction log automatically

### Event Calendar Fixes
- [x] Change event cards to show list of event names instead of count
- [x] Highlight current month card with special border/color
- [x] Enable editing of default events (not just custom ones)
- [x] Show selected events in green color in the list

### Calculator Feature
- [x] Add Calculator button back to the page
- [x] Create Calculator modal with two inputs: Average Value per Project and Number of Projects
- [x] Calculate and display Total Income (average × number of projects)
- [x] Update the calculator to work in real-time as user types
