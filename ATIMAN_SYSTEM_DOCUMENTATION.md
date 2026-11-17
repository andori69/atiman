# ATIMAN — Boarding House Rent Management System
## Complete System Documentation

> **"ATIMAN"** is a Bisaya word meaning *"to take care of."*  
> Built for Filipino landlords and tenants to manage boarding houses digitally.

---

## 1. System Overview

ATIMAN is a full-stack web application that digitizes the end-to-end management of boarding houses in the Philippines. It replaces manual paper records, cash-without-receipts, and verbal communication between landlords and tenants with a structured, real-time, mobile-friendly platform.

The system serves two user roles:
- **Landlord** — owns and manages one or more boarding houses
- **Renter (Tenant)** — lives in a room under a landlord's property

Both roles share the same application but see entirely different interfaces tailored to their needs.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS 3 |
| UI Components | shadcn/ui (Radix UI) |
| Routing | React Router v6 |
| Icons | Lucide React |
| Charts | Recharts |
| QR Code (Generate) | qrcode.react |
| QR Code (Scan) | html5-qrcode |
| PDF Export | jsPDF + jspdf-autotable |
| Excel Export | SheetJS (xlsx) |
| Backend / Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth (email + password) |
| File Storage | Supabase Storage |
| Real-time Updates | Supabase Realtime (postgres_changes) |
| Access Control | Row Level Security (RLS) on all tables |

There is **no separate backend server.** All data, auth, file uploads, and real-time events go directly through the Supabase client from the React frontend.

---

## 3. Authentication & Onboarding Flow

### 3.1 Landing Page
The entry point of the system. Presents the ATIMAN brand and two primary actions: **Log In** and **Create Account**.

### 3.2 Registration (Multi-Step)

**Step 1 — Role Selection**  
The user picks their role:
- **Landlord** — will manage properties and tenants
- **Renter** — will view their room, submit payments, and make requests

**Step 2A — Landlord Registration**  
Fields: Full name, email, phone, password, confirm password.  
On success: a unique **Landlord Code** is auto-generated (format: `ATIMAN-XXXX`). The landlord is immediately approved and redirected to their dashboard.

**Step 2B — Renter Registration**  
Fields: Full name, email, phone, password, confirm password, **Landlord Code**.  
The Landlord Code links the renter to their landlord. The renter account is created with `status = pending` and must wait for landlord approval before accessing any features.

### 3.3 Pending Approval Screen
Renters who are not yet approved see a dedicated waiting screen. They cannot access any other page until the landlord approves their account.

### 3.4 Landlord Code
- Displayed in the landlord's Settings page
- Can be copied to clipboard or shared as an invite link (`/register?code=ATIMAN-XXXX`)
- The landlord can regenerate a new code at any time

---

## 4. Database Schema (14 Tables)

| Table | Purpose |
|---|---|
| `profiles` | Extended user data for all accounts (landlord + renter) |
| `buildings` | Properties owned by landlords |
| `rooms` | Individual rooms within buildings |
| `tenants` | Renter records linked to rooms and profiles |
| `payments` | Rent payment records (pending, confirmed, rejected) |
| `electricity_bills` | Monthly electricity bills per building |
| `electricity_shares` | Per-tenant share of the electricity bill |
| `expenses` | Landlord expense records per building |
| `maintenance_requests` | Maintenance tickets filed by renters |
| `announcements` | Landlord broadcast messages to tenants |
| `move_records` | Move-in and move-out logs |
| `room_reviews` | Ratings and reviews submitted by renters |
| `notifications` | In-app notification records per user |
| `visitor_requests` | Guest visit requests submitted by renters |
| `lost_found_posts` | Lost & Found item postings |
| `lost_found_responses` | Claims filed on Lost & Found posts |

All tables have **Row Level Security (RLS)** enabled. Landlords can only see data from their own properties. Renters can only see their own records.

---

## 5. Landlord-Side Features

### 5.1 Home Dashboard
The central hub for the landlord. Displays:
- **Summary cards**: Total Renters, Total Rooms, Collected This Month (₱), Pending Payments (₱)
- **Monthly Calendar**: Each date shows a payment indicator. Clicking a date opens a **Log Payment modal** where the landlord can manually record a payment (renter, amount, method, notes).
- **Overdue Payments Panel**: Ranked list of renters who have missed payments, sorted by most months overdue. Color-coded: 1 month = amber, 2 months = orange, 3+ months = red.
- **Recent Activity**: Last 10 payment records in a feed format.
- **Quick Announce Button**: Opens a quick announcement modal directly from the dashboard.

### 5.2 Registrations
Manages incoming renter registration requests.
- Lists all renters with `status = pending` linked to the landlord
- Each registration card shows: name, email, phone, registration date
- **Approve**: Opens a modal to assign the renter to a specific building and room. On confirmation, the renter's status becomes `approved`, a tenant record is created, and the renter receives a notification.
- **Reject**: Opens a modal with an optional rejection reason. Status becomes `rejected`.
- Red number badge on the sidebar nav item shows the pending count.

### 5.3 Buildings & Rooms
Full CRUD management of physical properties.

**Buildings:**
- Add / edit buildings with name and address
- Each building card shows: name, address, occupancy ratio (e.g., 8/10 rooms), monthly rent potential

**Rooms:**
- Viewed within a building
- Each room card shows: room number, renter name (or "Vacant"), occupant count, monthly rent, status badge (Paid / Unpaid / Overdue / Vacant)
- Click to edit: assign/change renter, occupant count, rent amount, room status
- Status options: Occupied, Vacant, Under Maintenance

### 5.4 Renters (Tenant Profiles)
Full directory of all tenants.
- Search bar + filter by building / payment status
- Renter cards: avatar, name, building + room, phone, move-in date, status badge
- **Add Renter**: Upload photo, fill personal details, assign to building/room, set rent and deposit
- **Renter Detail View**: Full profile with contact, emergency contact, move-in date, QR code (downloadable and printable), and tabs for Payment History, Maintenance Requests, and Move Records.
- Shows additional student/work info: occupation type, school, program, year level, workplace, age

### 5.5 Electricity Dashboard
Manages and distributes electricity bills among tenants.
- **Bill Input**: Select building, enter total bill amount and billing month. Click "Calculate Shares."
- **Breakdown Table**: Auto-calculates each tenant's share based on occupant count: `(room occupants / total building occupants) × total bill`. Shares are individually editable (shows "adjusted" micro-badge).
- **Save & Notify**: Saves the bill, creates per-tenant electricity share records, and sends in-app notifications to all affected renters.
- **Bill History**: Table of past bills. Click to expand and see the full breakdown.
- Prevents duplicate bills for the same building and month.

### 5.6 Maintenance Requests
Manages maintenance tickets submitted by renters.
- Lists all requests across the landlord's properties
- Filter by status: Pending, In Progress, Resolved
- Each ticket shows: category (Plumbing, Electrical, Structural, Other), description, urgency badge, room + building, renter name, date, status
- **Status update**: Landlord can change status from Pending → In Progress → Resolved
- **Landlord Notes**: Free-text notes visible to the renter
- **Follow-Up Section**: For resolved tickets — option to reopen the ticket and notify the renter
- **Timeline**: Visual event log of status changes with icons (submitted, acknowledged, in progress, resolved, reopened, commented)
- **Photos**: Renter-uploaded photos are visible in the detail modal
- Notification sent to renter on each status change, including room context in the message
- Red number badge on sidebar for pending count only (in_progress does not count)

### 5.7 Visitors
Manages guest visit requests from renters.
- Table of all pending and past visitor requests
- Each request shows: visitor name, renter + room, visit date, visit time range (or "Overnight 🌙"), number of visitors, purpose, status
- **Approve**: Sends approval notification to renter including a reminder message ("Please remind your visitor(s) to check in at the gate upon arrival.")
- **Reject**: With optional reason; notifies renter
- Red number badge for pending count

### 5.8 Announcements
Broadcast messaging to tenants.
- **Create Announcement**: Title, message body, target buildings (specific buildings or all), pin toggle, optional photo upload
- Pinned announcements appear at the top of the list and show a pin icon
- Announcement cards: title, preview, target tags, date — click to view full content
- Edit and delete per announcement
- Renters see announcements targeted to their building on their home dashboard

### 5.9 Lost & Found
Shared board for lost and found items within the property.
- **Post Item**: Upload a photo, describe the item, set type (Lost / Found), and set status
- **Claim System**: Other users (renters or the landlord) can file a claim on a "Found" post
- **Claim Management**: Post owner reviews claims. Each claim can be:
  - **Accepted**: Marks the post as Resolved and notifies the claimant
  - **Rejected**: Keeps the post as "Lost" (not closed), notifies the claimant, allows them to re-file
- Red number badge for unread L&F notifications

### 5.10 Reports & Export
Generate and export data reports.
- **Report Types**: Payment Summary, Overdue Report, Expense Report, Profit/Loss by Building
- Filter controls: report type, date range, building, renter
- Live preview updates as filters change
- **Export PDF**: Generates a formatted PDF with ATIMAN header via jsPDF
- **Export Excel**: Generates a .xlsx file via SheetJS

### 5.11 Expenses
Tracks operational expenses per property.
- Add expenses: building, category (Water, Maintenance, Repair, Supplies, Other), amount, date, notes, receipt photo upload to Supabase Storage
- Expense table with filters by building and month
- **Profit Summary**: Per-building cards — Total Rent Collected vs. Total Expenses = Net Profit (green if positive, red if negative)

### 5.12 Rent Forecast
Forward-looking financial overview.
- **Cash Flow Card**: Expected vs. Collected vs. Remaining, with a percentage progress bar
- **Bar Chart** (Recharts): Last 6 months — Projected vs. Actual collections side by side with hover tooltips
- **Collection Rate**: Percentage collected with trend arrow vs. prior month

### 5.13 QR Scanner
Instant payment logging via QR code.
- Camera viewfinder using `html5-qrcode`
- On successful scan: vibrates (mobile), shows renter name + room overlay, auto-opens the Log Payment modal pre-filled with the renter's details
- "Enter code manually" fallback for without-camera access

### 5.14 Move-in / Move-out Tracker
Documents tenant transitions.
- **Two tabs**: Move-in | Move-out
- **Move-in Form**: Select renter, room, date, condition notes, upload room photos (multiple), deposit amount
- **Move-out Form**: Select renter (shows current room), date, checkout condition notes, upload photos, deposit refund amount, itemized deductions (reason + amount rows). Auto-calculates: Deposit − Deductions = Refund
- History log: searchable table of all move records with type badge (In / Out)

### 5.15 Settings
- Edit landlord profile: name, email, phone, avatar photo upload
- Landlord Code display with copy button, "Generate New Code" option, shareable invite link
- Change password
- Log out

---

## 6. Renter-Side Features

### 6.1 Renter Home Dashboard
The main screen for renters. Stacked layout, mobile-first.

**Header**: Date widget showing Month/Year, Day number (large), and Day of week.

**Notifications Panel**: Unacknowledged items appear as compact single-row cards with:
- Left colored border indicating priority/type
- Icon in a small circle
- Title + message text (fades out at the right edge)
- Timestamp
- Dismiss button (mark as read / acknowledge)
- "Clear all" button to dismiss all at once

Notification types shown here: rent reminders, overdue alerts, payment confirmed/rejected, electricity share notifications, maintenance updates, visitor approvals/rejections, general announcements.

**Balance Card**: Shows the renter's current rent due (₱), due date, and status (Paid ✓ / Due Soon ⏰ / Overdue ⚠). Includes a payment history tracker.

**Electricity Share Card**: Displays the renter's share of the building's electricity bill for the current month. Shows the bill basis (e.g., "Based on 2 occupants in Room 4, Building A"). Includes a payment status badge.

**Quick Actions**: "Upload Payment" (primary) and "Request Maintenance" (secondary) buttons.

**Announcement Archive**: Pinned and past announcements visible as compact cards. Clickable to view full content including photos.

### 6.2 Upload Payment
Submit rent payments for landlord verification.
- Select month (defaults to current month)
- Enter amount (pre-filled from rent, editable)
- Payment method: GCash / Bank Transfer / Cash / Other
- Upload receipt image to Supabase Storage
- Optional notes
- Submit → creates a `payments` record with `status = pending`
- Status flow: Pending → Confirmed (green) or Rejected (red, with reason shown)

### 6.3 Payment History
Timeline of all payment submissions.
- Vertical timeline view: date (left), card (right)
- Each card: amount, payment method, status badge (Confirmed / Pending / Rejected with reason)
- **Download Receipt**: Per confirmed payment — generates a PDF receipt with ATIMAN header, landlord name, renter name, room, amount, date, method, and receipt number
- Filter by month/year

### 6.4 Maintenance Requests
File and track maintenance issues.
- **Submit**: Pick category (Plumbing / Electrical / Structural / Other — shown as icon cards), write description, upload photos, select urgency (Low / Medium / High)
- **My Requests**: Cards sorted newest first. Tap to expand: full details, photos, landlord notes, status badge, status timeline
- Status progression: Pending (gray) → In Progress (blue) → Resolved (green)
- Resolved tickets have a visual timeline of all events

### 6.5 Visitors
Manage guest visit requests.
- **Submit Visit Request**: Visitor name(s), number of visitors, visit date, visit time, purpose, overnight toggle (Moon icon)
- **My Requests**: List of all past and pending requests with status badge
- Status: Pending → Approved (with reminder message) or Rejected (with reason)

### 6.6 Lost & Found
Shared board with landlord.
- View all lost and found posts in the building
- **Post Item**: Description, photo, type (Lost / Found)
- **File Claim**: On "Found" posts — submit a claim with a description/message
- If a claim is rejected, the renter can re-file (rejected claims do not block re-submission)
- Renter receives notifications: claim accepted or rejected
- L&F notifications appear as a count badge on the Lost & Found tab (not the Home tab)

### 6.7 Available Rooms
Browse vacant rooms in the landlord's buildings.
- Grid of available rooms with building name, room photo (or placeholder), room number, rent per month, description
- Share button (native share or copy link)

### 6.8 Settings
- Edit personal profile: name, email, phone, avatar photo upload
- Change password
- Log out

---

## 7. Notification System

### Architecture
All notifications are stored in the `notifications` table in Supabase. Each record contains:
- `user_id` — who receives the notification
- `title`, `message` — content
- `notification_type` — categorizes the notification for routing
- `is_read` — boolean, starts as false
- `reference_id` — optional link to the related record

### Notification Types & Routing

| Type | Who Receives | Routed To (Badge) |
|---|---|---|
| `rent_reminder` | Renter | Home tab |
| `rent_overdue` | Renter | Home tab |
| `payment_confirmed` | Renter | Home tab |
| `payment_rejected` | Renter | Home tab |
| `electricity_reminder` | Renter | Home tab |
| `maintenance_update` | Renter | Maintenance tab |
| `visitor_approved` | Renter | Visitors tab |
| `visitor_rejected` | Renter | Visitors tab |
| `lost_found` | Both | L&F tab |
| `lost_found_claim` | Both | L&F tab |
| `lost_found_accepted` | Renter | L&F tab |
| `lost_found_rejected` | Renter | L&F tab |

### Real-time Delivery
Both landlord and renter layouts maintain Supabase Realtime subscriptions on the `notifications` table. Any new or updated notification record instantly triggers a count refresh in the nav badges — no page reload required.

### Nav Badge Rules
- **Landlord sidebar**: Number badges appear next to Home (payment count), Registrations, Maintenance, Visitors, and Lost & Found
- **Renter sidebar / mobile tabs**: Number badges appear next to Home, Maintenance, Visitors, and Lost & Found
- Badges show the actual count (not just a dot); "99+" is shown for counts over 99
- A small red dot appears on the mobile hamburger menu icon when any badge has a count > 0

---

## 8. File Storage (Supabase Storage Buckets)

| Bucket | Contents | Access |
|---|---|---|
| `avatars` | Profile photos for landlords and renters | Public read |
| `receipts` | Payment receipt uploads from renters | Authenticated read |
| `room-photos` | Room condition photos + listing photos + announcement photos | Public read |
| `maintenance-photos` | Photos attached to maintenance requests | Authenticated read |
| `expense-receipts` | Receipts for landlord expense records | Authenticated read |

---

## 9. Real-time Features

All live updates use Supabase Realtime `postgres_changes` subscriptions. Key real-time behaviors:

- **Nav badge counts** refresh instantly when any relevant record changes
- **Lost & Found posts and claims** update live when any user makes a change
- **Maintenance request status** updates live for the renter without refreshing
- **Profile name/avatar changes** propagate immediately to all open sessions (posts, claims, and renter cards that show the updated user's name or photo update in real time)
- **Notification delivery** is instant — new notifications appear in nav badges within seconds
- **Visibility refresh** — when the user returns to the browser tab after being away, counts are refreshed via `visibilitychange` event listener

---

## 10. Mobile Experience

ATIMAN is designed mobile-first for renters (most are students on phones) while maintaining full desktop functionality for landlords.

**Renter mobile:**
- Bottom tab bar (Home, Maintenance, Visitors, More)
- "More" tab opens a bottom sheet with additional nav items (Lost & Found, Available Rooms, Settings) + Log Out
- Modals become bottom sheets (slide up from bottom, rounded top corners, drag indicator)
- Tables become card-based lists
- All forms are touch-optimized with large tap targets

**Landlord mobile:**
- Hamburger menu in header opens a slide-in sidebar overlay
- A red dot on the hamburger icon when any badge has a pending count
- Full sidebar nav accessible on mobile via the overlay

**Both:**
- Sticky headers with glass-morphism blur effect
- Responsive breakpoints: mobile (< 768px), tablet (768–1023px), desktop (≥ 1024px)
- The desktop sidebar is hidden on mobile; bottom tabs are hidden on desktop

---

## 11. Design System

The UI follows an Apple-inspired design philosophy: clean, minimal, and purposeful.

- **Color palette**: Pure white surfaces, `#F5F5F7` page backgrounds, `#1D1D1F` primary text, `#6C5CE7` accent purple (for active nav states), `#0071E3` Apple blue for primary actions
- **Glass morphism**: Sidebar, header, and floating cards use `backdrop-filter: blur()` with semi-transparent white backgrounds
- **Typography**: System font stack (`-apple-system, BlinkMacSystemFont, SF Pro, Inter`)
- **Cards**: `rounded-2xl`, subtle `box-shadow`, `1px` light border, `p-6` padding
- **Badges**: Rounded-full pills with light tinted backgrounds (10% opacity color + full color text)
- **No spinners**: All loading states use skeleton loaders (pulsing placeholder blocks)
- **Animations**: Subtle, 200ms ease-out transitions only — no bounce or spring

---

## 12. Security Model

- All access control is enforced at the **database level via RLS policies**, not just in the frontend
- Renters can only read their own payments, notifications, requests, and profile
- Landlords can only read/write data within their own buildings
- File uploads use authenticated storage policies
- The Supabase `anon` key is used in the frontend — the `service_role` key is never exposed
- Passwords are managed entirely by Supabase Auth (bcrypt hashing, secure session tokens)

---

## 13. Key User Flows Summary

### Landlord Flow
```
Register → Get Landlord Code → Add Buildings → Add Rooms →
Share Code with Renters → Approve Registrations → Assign Rooms →
Log Payments (manual or QR scan) → Manage Maintenance →
Post Electricity Bills → Generate Reports → Send Announcements
```

### Renter Flow
```
Register with Landlord Code → Wait for Approval →
View Dashboard (balance, electricity, announcements) →
Upload Payment Receipt → Track Payment Status →
Submit Maintenance Request → Track Maintenance Status →
Request Visitor Access → Use Lost & Found Board
```

---

*ATIMAN — Take care of your boarding house, digitally.*  
*Built with React 18, TypeScript, and Supabase. Made for Filipino landlords and tenants.*
