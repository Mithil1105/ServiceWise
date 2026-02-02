# ServiceWise (Traveltrak Ops) — Project Description & MVP

**Document version:** 1.0  
**Last updated:** February 2026  
**Project codebase:** `traveltrak-ops-main` (product name: **ServiceWise**)

---

## 1. Executive Summary

**ServiceWise** is a full-stack **fleet management and operations system** for travel and transportation companies. It covers the entire lifecycle: vehicle registration, booking management, driver assignment, service and maintenance, billing and invoicing, advance payments, transfers, company bills, and reporting — with role-based access (Admin, Manager, Supervisor).

The application is a **single-page application (SPA)** built with **React 18**, **TypeScript**, and **Vite**, using **Supabase** (PostgreSQL, Auth, RLS, Storage, Edge Functions) as the backend. It is deployable to **Vercel** or any static host.

---

## 2. What This Project Is About

### 2.1 Purpose

- **Centralise fleet operations**: One place to manage vehicles, drivers, bookings, services, incidents, and downtime.
- **Booking-to-cash flow**: From creating a booking (inquiry → tentative → confirmed → ongoing → completed) to assigning vehicles, capturing advance, generating customer and company bills, and tracking transfers.
- **Prevent double-booking**: Vehicle availability is checked for overlapping dates; inquiry, tentative, confirmed, and ongoing bookings all block a vehicle (with configurable buffer).
- **Financial control**: Advance payment tracking (cash/online, company/personal/cash accounts), transfer requirements (personal/cash → company), company bills, and bank account management.
- **Maintenance and compliance**: Service rules per vehicle, odometer-based service reminders, critical queue, incident and downtime logging.
- **Visibility**: Dashboard, calendar, reports, and role-specific views (e.g. supervisor dashboard).

### 2.2 Target Users

- **Travel and transportation companies** (chauffeur, rental, corporate transport).
- **Fleet operators** who need bookings, billing, and maintenance in one system.
- **Admins** (full access), **Managers** (operations + limited settings), **Supervisors** (assigned cars, services, odometer; no billing/user management).

### 2.3 Core Value Propositions

1. **Single source of truth** for fleet, bookings, and money (advance, bills, transfers).
2. **Conflict-safe bookings**: Vehicles already allotted (including inquiry) cannot be double-booked; UI only adds vehicles that are still available.
3. **Flexible pricing**: Per booking/vehicle — Total, Per Day, Per KM, Hybrid (per day + per KM) with system-wide minimum KM thresholds (e.g. 300 km/day).
4. **Audit trail**: Booking audit log (created, updated, status_changed, vehicle_assigned/removed, date_changed, rate_changed); transfer and bill history.
5. **Mobile-friendly layout**: Responsive UI with collapsible sidebar, scrollable nav, and stacked cards on small screens.

---

## 3. Technology Stack (Detailed)

### 3.1 Frontend

| Category        | Technology        | Version / Notes |
|----------------|-------------------|-----------------|
| Runtime        | Node.js           | 18+             |
| Language       | TypeScript        | 5.8             |
| UI framework   | React             | 18.3            |
| Build / dev    | Vite              | 5.4             |
| Routing        | React Router      | 6.30            |
| Server state   | TanStack Query    | 5.83            |
| Styling        | Tailwind CSS      | 3.4             |
| Components     | shadcn/ui (Radix)| —               |
| Forms          | React Hook Form   | 7.61            |
| Validation     | Zod               | 3.25            |
| Dates          | date-fns          | 3.6             |
| Charts         | Recharts          | 2.15            |
| PDF            | jsPDF             | 3.0             |
| Screenshot     | html2canvas       | 1.4             |
| QR codes       | qrcode.react      | 4.2             |
| Icons          | Lucide React      | —               |
| Maps           | @react-google-maps/api | —          |
| Toasts         | Sonner            | —               |

### 3.2 Backend & Infrastructure

| Component       | Technology | Notes |
|----------------|------------|--------|
| Database       | PostgreSQL (Supabase) | All app data |
| Auth           | Supabase Auth (JWT)   | Email/password |
| Authorization  | Row Level Security (RLS) + app role checks | admin, manager, supervisor |
| API            | Supabase JS client (REST/Realtime) | No separate API server |
| Custom logic   | Supabase Edge Functions (Deno) | create-user-v3, petty-expenses, etc. |
| Storage        | Supabase Storage      | PDFs, documents |
| Hosting        | Vercel (recommended)  | SPA rewrites in `vercel.json` |

### 3.3 Environment

- **Build:** `npm run build` → `dist/`.
- **Env vars (frontend):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (only anon key in frontend).
- **Edge functions:** Use Supabase env (e.g. `SUPABASE_SERVICE_ROLE_KEY`) — never in frontend.

---

## 4. Application Structure (Minute Detail)

### 4.1 Route Map

| Route | Page / Component | Purpose |
|-------|------------------|--------|
| `/auth` | Auth | Login / sign-up (no layout) |
| `/` | Dashboard | Main dashboard or SupervisorDashboard for supervisors |
| `/fleet` | Fleet | Fleet list, filters, add vehicle entry |
| `/fleet/new` | FleetNew | Add new vehicle (brand, model, VIN, seats, etc.) |
| `/fleet/:id` | FleetDetail | Vehicle detail, documents, notes, services, assignments |
| `/drivers` | Drivers | Driver list, add/edit, license tracking |
| `/odometer` | Odometer | Odometer entry by vehicle/date |
| `/vehicle-report/:id` | VehicleReport | Per-vehicle report |
| `/services` | Services | Service records list |
| `/services/new` | ServiceNew | Log new service (vehicle, rule, km, cost) |
| `/critical` | CriticalQueue | Vehicles needing immediate service (overdue/due soon) |
| `/incidents` | Incidents | Incident list and logging |
| `/downtime-report` | DowntimeReport | Downtime analysis |
| `/reports` | Reports | General reports / analytics |
| `/financials` | Financials | Transfers (pending/completed), company bills |
| `/settings` | Settings | System config (e.g. minimum KM), brands, bank accounts |
| `/users` | UserManagement | User list, create (via edge function), roles |
| `/supervisors` | Supervisors | Supervisor assignments (cars per supervisor) |
| `/bookings` | Bookings | Booking list, filters, status filter |
| `/bookings/calendar` | BookingCalendar | Calendar view of bookings |
| `/bookings/new` | BookingNew | New booking (customer, dates, requested vehicles, assign vehicles) |
| `/bookings/:id/edit` | BookingEdit | Edit booking, vehicles, status |
| `/bookings/:id/invoice` | BookingInvoice | Invoice view for booking |
| `/bookings/:id/bills` | Bills | Customer/company bills for booking, generate PDF |
| `/bookings/:id/history` | BookingHistory | Booking audit history |
| `/billing` | BillingManagement | Billing hub (bills, reminders, etc.) |
| `*` | NotFound | 404 |

All routes under `/` except `/auth` are protected by `AppLayout` (auth required; role required).

### 4.2 Layout and Navigation

- **AppLayout:** Wraps authenticated routes; shows sidebar (desktop) or hamburger + sheet (mobile); main content area with `Outlet`.
- **AppSidebar:** Logo “ServiceWise”, nav links (Dashboard, Bookings, Billing, Fleet, Drivers, Odometer, Services, Critical Queue, Incidents, Downtime Report, Reports), admin block (Financials, Supervisors, Settings, Users), user block (name, role badge, Log out). Critical Queue has alert badge. Sidebar nav is scrollable (`min-h-0`, `overflow-y-auto`).
- **Mobile:** Header with hamburger; sidebar opens in Sheet (left); closing sheet or navigating closes it (`onNavigate`).
- **Main content:** `md:ml-64`, `p-4 md:p-6`.

### 4.3 Role-Based Visibility

- **Bookings, Billing:** Shown only if not “supervisor-only” (i.e. admin or manager). Supervisors do not see Bookings/Billing in sidebar.
- **Financials, Supervisors, Settings, Users:** Shown only for Admin or Manager.
- **Dashboard:** Supervisors see `SupervisorDashboard` (assigned cars, quick actions); others see main Dashboard (snapshot, attention items, stats, critical queue, utilization, fleet status, quick actions).

---

## 5. Data Model (Summary)

### 5.1 Core Entities

- **profiles** — User profile (name, etc.); id = auth.users.id.
- **user_roles** — `user_id`, `role` (admin | manager | supervisor).
- **cars** — Vehicles (brand, model, vehicle_number, year, VIN, fuel_type, seats, status active/inactive, etc.).
- **drivers** — Name, phone, license info.
- **customers** — Deduplicated customer records (name, phone) for autocomplete.
- **bookings** — `booking_ref`, `status`, `customer_name`, `customer_phone`, `trip_type`, `start_at`, `end_at`, `pickup`, `dropoff`, `notes`, `created_by`, `updated_by`, timestamps. Status: inquiry | tentative | confirmed | ongoing | completed | cancelled.
- **booking_vehicles** — Assignment of a car to a booking: `booking_id`, `car_id`, driver name/phone, rate_type, rate_total / rate_per_day / rate_per_km, estimated_km, final_km, computed_total, advance_amount, payment_status, requested_vehicle_id (link to requested vehicle), audit fields.
- **booking_requested_vehicles** — “Requested” line items (brand, model, rate type, amounts, driver allowance, advance_amount, advance_payment_method, advance_account_type, advance_account_id, advance_collected_by). Used for quote and for billing when no assigned vehicle or when linked.
- **booking_audit_log** — Action (created, updated, status_changed, vehicle_assigned, vehicle_removed, date_changed, rate_changed), before/after JSON, actor_id.
- **tentative_holds** — For “Hold (Tentative - 2hr)” bookings; `booking_id`, `expires_at`.

### 5.2 Billing & Financials

- **bills** — Customer-facing bill: booking_id, bill_number, status (draft | sent | paid), customer/booking info, start/end odometer, total_km_driven, km_calculation_method, vehicle_details (JSON), total_amount, advance_amount, balance_amount, threshold_note, PDF path/name, sent_at, paid_at.
- **company_bills** — Internal bill: links to customer bill, includes total_driver_allowance, advance payment method/account/collected_by, transfer_requirements (derived).
- **transfers** — Advance moved from personal/cash to company: booking_id, bill_id, amount, from_account_type (personal | cash), from_account_id, collected_by_user_id/name, status (pending | completed), transfer_date, completed_by_user_id, completed_at, cash_given_to_cashier, cashier_name, reminder_sent_at, notes.
- **bank_accounts** — Company/personal accounts (name, number, bank name, IFSC, etc.) for advance and transfers.

### 5.3 Service & Maintenance

- **service_rules** — Templates (e.g. “Oil Change every 5000 km”); name, interval_km, etc.
- **car_service_rules** — Links cars to service_rules (e.g. last_service_km, next_due_km).
- **service_records** — Actual service events: car_id, rule, odometer, cost, date, etc.
- **odometer_entries** — Per car: reading, date/time.
- **incidents** — Incidents per vehicle (date, description, severity, etc.).
- **downtime_logs** — Vehicle unavailable: car_id, started_at, ended_at, reason.

### 5.4 Configuration & Other

- **system_config** — Key-value (e.g. `minimum_km_per_km`, `minimum_km_hybrid_per_day` — default 300).
- **car_documents** — Attachments (insurance, registration, PUC, etc.) per car.
- **car_notes** — Free-text notes per car.
- **car_assignments** — Supervisor assignments: supervisor_id, car_id, assigned_at, assigned_by, notes.
- **supervisor_activity_log** — Activity log for supervisors.
- **user_snoozes** — E.g. “dismiss critical popup for today”.

### 5.5 Enums (Postgres / App)

- **booking_status:** inquiry, tentative, confirmed, ongoing, completed, cancelled.
- **trip_type:** local, outstation, airport, custom, oneway_pickup_drop.
- **rate_type:** total, per_day, per_km, hybrid.
- **payment_status:** unpaid, partial, paid (booking_vehicles).
- **bill_status:** draft, sent, paid.
- **app_role:** admin, manager, supervisor.

---

## 6. Key Business Rules (Minute Detail)

### 6.1 Booking and Vehicle Availability

- **Buffer:** 60 minutes between bookings (configurable in RPC); overlapping start/end with buffer makes a vehicle unavailable.
- **Conflicting statuses:** A vehicle is considered “booked” for a time range if it has a booking_vehicle in that range for a booking with status **inquiry, tentative, confirmed, or ongoing** (completed and cancelled do not block). Implemented in:
  - `check_available_cars(p_start_at, p_end_at, p_buffer_minutes, p_exclude_booking_id)` — returns all active cars with `is_available` and conflict details (conflict_booking_ref, conflict_start, conflict_end, conflict_booked_by).
  - `assign_car_to_booking(...)` — rejects if the car is already in an overlapping booking with one of those statuses.
- **Exclude current booking:** When editing a booking, `exclude_booking_id` is passed so the same booking’s vehicles do not count as conflict.
- **Frontend:** When user clicks “Add X Selected” in Select Vehicles, only cars that are still `is_available` are added; if some selected are no longer available, a warning toast is shown and those are skipped.

### 6.2 Booking Status Lifecycle

- **inquiry** — Initial/save as inquiry.
- **tentative** — “Hold” with 2-hour tentative hold (optional).
- **confirmed** — Confirmed booking.
- **ongoing** — Auto-set when current time is between start_at and end_at (and status is one of inquiry, tentative, confirmed, ongoing).
- **completed** — Auto-set when current time ≥ end_at; or manually set.
- **cancelled** — Manual; never auto-changed. Cancelled bookings do not block vehicle availability.
- Status auto-updates run on fetch (e.g. in useBookings) via `autoUpdateBookingStatuses`.

### 6.3 Rates and Minimum KM

- **Total:** Fixed amount per vehicle.
- **Per day:** rate_per_day × days (days from start_at to end_at, ceil).
- **Per KM:** rate_per_km × estimated_km (or for bills, final km). System minimum KM (e.g. 300 km/day) can apply: effective km = max(estimated_km, days × minimum_km_per_km).
- **Hybrid:** Per day amount + per KM amount; minimum KM per day (e.g. 300) applied for the KM part: effective km = max(estimated_km, days × minimum_km_hybrid_per_day).
- **System config:** `minimum_km_per_km`, `minimum_km_hybrid_per_day` from `system_config` (default 300).

### 6.4 Advance and Transfers

- Advance can be at booking level or per requested vehicle (first requested vehicle used for backward compatibility).
- Advance payment method: cash | online. Account type: company | personal (cash implied when no account).
- When advance is in cash or personal account, a **transfer** is expected (move to company); tracked in Financials → Pending Transfers. Transfer completion: transfer_date, cashier_name, cash_given_to_cashier, notes.

### 6.5 Bills

- **Customer bill:** Generated after trip (booking completed); can use odometer or manual KM; vehicle_details with rate breakdown; total, advance, balance; PDF generation; status draft → sent → paid.
- **Company bill:** Tied to customer bill; includes driver allowance, advance details, transfer requirements; PDF for internal use.
- **Standalone bill:** Bill not tied to a booking (manual entry).

### 6.6 Critical Queue and Services

- **Critical queue:** Vehicles where next service (from car_service_rules) is overdue or due soon (by km or time). Dashboard and Critical Queue page show these; overdue/due-soon badges.
- **Service records:** Logged against car and rule; odometer, cost, date; used for next due and health.

---

## 7. MVP Definition (Minimum Viable Product)

The following is the **smallest set of features** that still delivers the core value: “book a vehicle, assign it, complete the trip, bill the customer, and track money.”

### 7.1 In Scope for MVP

1. **Auth & roles**
   - Email/password sign-in; role (admin/manager/supervisor) from `user_roles`; redirect to dashboard or supervisor dashboard.

2. **Fleet**
   - List cars (active/inactive); add/edit car (basic info: vehicle_number, brand, model, seats); view one vehicle (FleetDetail). No obligation to implement full documents/notes for MVP.

3. **Bookings**
   - Create booking: customer name/phone, trip type, start/end (date-time), pickup/dropoff, notes.
   - Optional: requested vehicles (brand, model, rate type, amounts) for quote.
   - Assign vehicles: select from **available** cars only (use `check_available_cars`); conflict prevention (inquiry/tentative/confirmed/ongoing); “Add Selected” only adds still-available cars.
   - Status: inquiry → tentative (optional hold) → confirmed → ongoing → completed; cancelled.
   - Edit booking and booking history (audit log).

4. **Billing (customer)**
   - Generate customer bill after completion (KM from odometer or manual); rate calculation with minimum KM; PDF generation; bill status draft/sent/paid.

5. **Financial (minimal)**
   - Advance amount and method on booking/requested vehicle.
   - List of pending and completed transfers (amount, from type, collected by, status); complete transfer (date, cashier, notes). No obligation for full company bill PDF in MVP.

6. **Drivers**
   - List drivers; add driver (name, phone); assign driver to booking vehicle (name/phone on assignment).

7. **Odometer**
   - Enter odometer reading per car per date; used for billing and service due.

8. **Services**
   - List service records; add service (vehicle, rule or free text, km, cost, date). Critical queue: list of vehicles overdue/due soon (can be simple list).

9. **Dashboard**
   - One dashboard: snapshot (e.g. KM driven, services completed, critical alerts, expenses), “What needs attention today”, critical queue preview, fleet status, quick actions. Supervisors: assigned cars and quick actions only.

10. **Settings**
    - System config: minimum_km_per_km, minimum_km_hybrid_per_day (e.g. 300). Optional: one or two bank accounts for display.

11. **Users (admin only)**
    - List users; create user with role via edge function (create-user-v3).

12. **UI/UX**
    - Responsive layout (sidebar + main; mobile: hamburger + sheet); scrollable sidebar; Cancelled status in light red; Inquiry grey.

### 7.2 Out of Scope for MVP (Can Be Later)

- Full **company bill** PDF and complex transfer workflows beyond “mark transfer completed”.
- **Reports** page with full analytics and custom date ranges.
- **Incidents** and **downtime** modules (or minimal: log only, no reports).
- **Supervisors** assignment UI (car_assignments); supervisor dashboard can be simplified to “all cars” or a fixed list.
- **Booking calendar** (optional for MVP: list view only).
- **Vehicle documents/notes**, vehicle health score, brand autocomplete.
- **Petty expenses** edge function integration.
- **WhatsApp / Google Maps** integration (optional).
- **Tentative hold** expiry automation (optional; UI can still show “Hold (Tentative - 2hr)”).

---

## 8. File and Folder Structure (Key Areas)

```
traveltrak-ops-main/
├── public/                    # Static assets, favicon, robots.txt
├── src/
│   ├── assets/               # SWlogo, etc.
│   ├── components/
│   │   ├── bookings/         # BookingDetailsDrawer, CustomerAutocomplete, GenerateBillDialog, etc.
│   │   ├── dashboard/       # SupervisorDashboard
│   │   ├── fleet/            # BrandAutocomplete, DocumentsSection
│   │   ├── layout/           # AppLayout, AppSidebar
│   │   ├── settings/        # RuleNameAutocomplete
│   │   └── ui/               # shadcn components (button, card, dialog, sheet, etc.)
│   ├── hooks/                # use-bookings, use-bills, use-cars, use-company-bills, use-transfers, etc.
│   ├── integrations/supabase/# client.ts, types.ts (DB types)
│   ├── lib/                  # auth-context, date, utils, google-maps
│   ├── pages/                # One file per route (see Route Map)
│   ├── types/                # booking.ts (Booking, BookingVehicle, Bill, Transfer, enums, colors)
│   ├── App.tsx               # Routes, providers
│   └── main.tsx
├── supabase/
│   ├── functions/            # create-user, create-user-v2, create-user-v3, petty-expenses
│   ├── migrations/           # All SQL migrations (run in order)
│   └── config.toml
├── .env                      # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json               # SPA rewrite to /index.html
└── vite.config.ts
```

---

## 9. Security and Performance (Summary)

- **Auth:** Supabase JWT; session checked in `AppLayout`; redirect to `/auth` if not logged in.
- **Roles:** `user_roles` table; `isAdmin`, `isManager`, `isSupervisor` in auth context; sidebar and page-level checks.
- **RLS:** Enabled on all tables; policies in migrations (select/insert/update/delete by role or user).
- **Edge functions:** create-user-v3 (and similar) verify admin (or allowed role) via JWT before creating users.
- **Availability:** `check_available_cars` and `assign_car_to_booking` are SECURITY DEFINER; run with elevated privileges to enforce conflict rules.
- **Caching:** TanStack Query (e.g. bookings, available-cars with staleTime 60s); invalidations on create/update/delete.

---

## 10. Deployment Checklist

1. **Env:** Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in host (e.g. Vercel).
2. **DB:** Run all migrations in `supabase/migrations/` in order; ensure RLS and functions (e.g. `check_available_cars`, `assign_car_to_booking`) are deployed.
3. **Admin user:** Insert into `user_roles` for first admin (e.g. from auth.users).
4. **Edge functions:** Deploy create-user-v3 (and any others used) via Supabase CLI or dashboard; set env in Supabase.
5. **Build:** `npm run build`; deploy `dist/` with SPA rewrite (e.g. `vercel.json`: all routes → `/index.html`).

---

## 11. Glossary

| Term | Meaning |
|------|--------|
| **Requested vehicle** | A line item on a booking (brand, model, rate type, amounts) before or without assigning a real car; used for quote and billing. |
| **Assigned vehicle** | A real car from the fleet linked to the booking (`booking_vehicles`); can link to a requested_vehicle_id for rates. |
| **Advance** | Upfront payment; stored on booking or first requested vehicle; method (cash/online), account type (company/personal). |
| **Transfer** | Moving advance from personal/cash to company account; status pending/completed. |
| **Company bill** | Internal bill tied to customer bill; includes driver allowance and transfer requirements. |
| **Critical queue** | Vehicles with service overdue or due soon by km or date. |
| **Buffer** | Minutes between booking end and next start (and before start) for availability; default 60. |
| **Minimum KM** | System-wide floor for per_km and hybrid rate calculation (e.g. 300 km/day). |

---

This document is the single detailed reference for what the project is, what it does, and what the MVP includes, with all minute details captured in one place.
