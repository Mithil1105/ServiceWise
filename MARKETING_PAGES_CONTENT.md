# Marketing Pages – Full Content (for refinement)

This file contains the copy from every marketing page and shared components. Edit here, then we can sync changes back into the app.

---

## Navbar & Footer

### Navbar links (order)
- Home
- Product
- Features
- Roles & Permissions
- How it Works
- Security
- Tech & Deployment
- Pricing
- FAQ
- Contact

### Navbar CTAs
- Login (→ /auth)
- Request Demo (→ /contact)

### Footer
- **Brand line:** ServiceWise  
- **Tagline:** Fleet operations. Booking-to-cash. In one system.  
- **Links:** Product, Features, Roles, How it Works, Pricing, FAQ, Contact  
- **Copyright:** © [year] ServiceWise. All rights reserved.  
- **CTA:** Request Demo

---

## 1. Home Page

### Hero
- **Headline:** Fleet operations. Booking-to-cash. In one system.
- **Subhead:** ServiceWise centralizes vehicles, bookings, billing, advances, transfers, and service tracking — with role-based access for Admins, Managers, and Supervisors.
- **Primary CTA:** Request Demo
- **Secondary CTA:** Explore Features
- **Badges:**
  - Prevent double-booking (even inquiry blocks)
  - Minimum-KM pricing logic (e.g., 300 km/day)
  - Transfers tracked from cash/personal → company

### Section: What ServiceWise solves (bento cards)
1. **Centralized fleet + bookings** – One place for vehicles, drivers, documents, and availability.
2. **Booking-to-cash workflow** – From inquiry to confirmed booking, bill generation, and transfer tracking.
3. **Maintenance & critical queue** – Service rules, odometer-based reminders, and overdue/due-soon alerts.
4. **Audit trail** – Booking audit log and financial history for traceability.
5. **Mobile-friendly ops UI** – Responsive layout with collapsible sidebar and touch-friendly controls.
6. **Role-based access** – Admin, Manager, and Supervisor roles with clear permissions.

### Section: Booking-to-cash workflow
- **Heading:** Booking-to-cash workflow
- **Subtext:** Inquiry → Tentative → Confirmed → Ongoing → Completed → Bill → Transfer → Paid
- **Steps (labels + short desc):**
  - Inquiry – Save as inquiry or hold
  - Tentative – Optional 2hr hold
  - Confirmed – Booking confirmed
  - Ongoing – Trip in progress
  - Completed – Trip ended
  - Bill – Generate customer bill (PDF)
  - Transfer – Complete cash/personal → company
  - Paid – Mark bill as paid

### Section: Feature preview blocks
1. **Conflict-safe booking**
   - Availability check with configurable buffer (default 60 min)
   - Inquiry, tentative, confirmed, and ongoing all block the vehicle
   - UI only adds vehicles that are still available

2. **Flexible pricing**
   - Total, Per Day, Per KM, Hybrid (per day + per KM)
   - Minimum-KM logic (e.g. 300 km/day) for per_km and hybrid
   - System-wide configurable thresholds

3. **Financial control**
   - Advance capture (cash/online, company/personal)
   - Transfer expected when advance is in cash or personal account
   - Pending and completed transfers with cashier and notes

4. **Service reminders**
   - Service rules per vehicle (e.g. oil change every 5000 km)
   - Critical queue: overdue and due-soon vehicles
   - Dashboard and dedicated Critical Queue page

### Section: Dashboard preview
- **Heading:** Dashboard preview
- **KPI cards (sample values):** Active vehicles 24 | Bookings this week 12 | Pending transfers 3 | Vehicles in critical queue 2
- **Chart placeholder:** Chart placeholder (e.g. bookings or KM over time)
- **Attention today (sample items):**
  - MH-01-AB-1234: Service overdue by 500 km
  - MH-01-CD-5678: Due soon (200 km)
  - Transfer pending: ₹5,000 from personal account
  - Booking BKG-001: Advance not yet transferred
  - MH-01-EF-9012: Odometer reading stale

### Final CTA
- **Heading:** Want a demo tailored to your fleet size?
- **Subtext:** Request a demo and we’ll walk you through ServiceWise for your use case.
- **CTA:** Request Demo

---

## 2. Product Page

### Hero
- **Heading:** Product overview
- **Intro:** ServiceWise is a complete fleet management and operations system: vehicles, bookings, billing, advances, transfers, and service tracking — with role-based access. Everything from inquiry to paid bill in one place.

### Section: Modules (grid)
- Fleet – Vehicles, documents, status
- Bookings – Create, assign, status lifecycle
- Billing – Customer bills, PDF
- Financials (Transfers) – Advance, transfers, company bills
- Odometer – Readings, mileage
- Services & Critical Queue – Rules, overdue/due soon
- Drivers – Profiles, assignments
- Dashboard – Snapshot, attention, KPIs
- Settings – System config, brands, bank accounts
- Users & Roles – Admin, Manager, Supervisor

### Section: MVP scope summary
- Auth & roles (Admin, Manager, Supervisor)
- Fleet list and add/edit vehicle
- Bookings with conflict-safe vehicle assignment
- Customer bill generation with minimum-KM logic and PDF
- Advance and transfer tracking (pending/completed)
- Drivers and odometer entry
- Services and critical queue
- Dashboard and supervisor dashboard
- Settings (minimum KM), Users (create via edge function)
- Responsive UI with mobile sidebar

### Section: Future-ready (out of scope / later)
- **Intro line:** Reports analytics, incidents/downtime, calendar, docs/notes, petty expenses, WhatsApp/maps.
- Reports & analytics (full date ranges)
- Incidents & downtime modules
- Booking calendar view
- Vehicle documents/notes, health score
- Petty expenses integration
- WhatsApp / Google Maps integration

### CTA
- Request Demo

---

## 3. Features Page

### Hero
- **Heading:** Features
- **Intro:** Feature categories with clear descriptions and capability lists.

### Categories (each with bullets + “Mock panel (app preview)” placeholder)

**Bookings**
- Status lifecycle: inquiry, tentative, confirmed, ongoing, completed, cancelled
- Availability check with buffer (default 60 minutes)
- Requested vs assigned vehicles (quote then assign real cars)
- Audit log history (created, status_changed, vehicle_assigned/removed, date_changed, rate_changed)

**Billing (customer)**
- Draft → sent → paid workflow
- KM from odometer or manual entry
- Minimum-KM logic applied for per_km and hybrid
- PDF generation and download

**Financials (advances / transfers)**
- Advance capture (cash/online, company/personal)
- Transfer expected when cash/personal → company
- Pending and completed transfers with notes and cashier details
- Company bills and bank account management

**Fleet + Drivers**
- Vehicle list, add/edit, status (active/inactive)
- Driver profiles and assignment to bookings
- Odometer entries and mileage tracking

**Maintenance (service rules + critical queue)**
- Service rules per vehicle (e.g. oil change every 5000 km)
- Critical queue: overdue and due-soon vehicles
- Service records and cost tracking

### CTA
- Request Demo

---

## 4. Roles Page

### Hero
- **Heading:** Roles & permissions
- **Intro:** Admin, Manager, and Supervisor roles with clear capabilities and a permission matrix.

### Role cards
- **Admin** – Full system access  
  - User management, System settings, All operational features, Financial management, Reports & analytics
- **Manager** – Operational access  
  - Booking & billing, Fleet, drivers, services, Financial tracking, Limited settings
- **Supervisor** – Limited operational access  
  - View bookings (no billing), View fleet, Log services, Record odometer, View reports (read-only), Assigned cars dashboard

### Permission matrix (Feature × Admin | Manager | Supervisor)
| Feature        | Admin | Manager | Supervisor |
|----------------|-------|---------|------------|
| Bookings      | ✓     | ✓       | —          |
| Billing       | ✓     | ✓       | —          |
| Financials    | ✓     | ✓       | —          |
| Fleet         | ✓     | ✓       | ✓          |
| Drivers       | ✓     | ✓       | ✓          |
| Odometer      | ✓     | ✓       | ✓          |
| Services      | ✓     | ✓       | ✓          |
| Critical Queue| ✓     | ✓       | ✓          |
| Settings      | ✓     | —       | —          |
| Users         | ✓     | —       | —          |

### Supervisor dashboard preview
- **Heading:** Supervisor dashboard preview
- **Text:** Supervisors see only their assigned cars, with quick actions to log service or update odometer. No billing or user management.
- **Placeholder:** Assigned cars + quick actions (mock)

### CTA
- Request Demo

---

## 5. How it Works Page

### Hero
- **Heading:** How it works
- **Intro:** Booking-to-cash stepper and availability & pricing rules.

### Section: Booking-to-cash stepper (ordered list)
1. Create booking (customer, dates, pickup/dropoff)
2. Requested vehicles (optional — brand, model, rate type)
3. Assign available cars (conflict-safe; inquiry/tentative/confirmed/ongoing block)
4. Track advance + payment method (cash/online, company/personal)
5. Complete trip
6. Generate customer bill (PDF, KM from odometer or manual)
7. Complete transfer if required (cash/personal → company)
8. Mark as paid

### Section: Availability & pricing rules (cards)
- **Buffer minutes (default 60)** – Gap between booking end and next start (and before start) for availability.
- **Block statuses** – Inquiry, tentative, confirmed, ongoing all block the vehicle. Completed and cancelled do not block.
- **Minimum KM (e.g. 300 km/day)** – Affects per_km and hybrid rate calculation. System-wide configurable.

### CTA
- Request Demo

---

## 6. Security Page

### Hero
- **Heading:** Security & compliance
- **Intro:** Concise but strong: auth, authorization, server-side logic, audit trail, and secrets handling.

### Points (cards)
1. **Auth: JWT sessions** – Supabase Auth with JWT-based sessions; secure sign-in and sign-out.
2. **Authorization: role checks + RLS** – Role-based access at the app level (Admin, Manager, Supervisor) and Row Level Security (RLS) policies in the database.
3. **Server-side: edge functions** – Sensitive actions (e.g. create user) run in Supabase Edge Functions with JWT verification.
4. **Audit trail** – Booking audit log (created, updated, status_changed, vehicle_assigned/removed, etc.) and financial history.
5. **Secrets** – Service role key is never exposed to the frontend; only used server-side in edge functions.

### CTA
- Request Demo

---

## 7. Tech Page

### Hero
- **Heading:** Tech & deployment
- **Intro:** Stack, deployment checklist, and performance notes.

### Section: Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query
- **Backend:** Supabase: PostgreSQL, Auth, RLS, Storage, Edge Functions

### Section: Deployment checklist
1. Set env vars (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
2. Run database migrations in order
3. Set first admin role (user_roles table)
4. Deploy edge functions (e.g. create-user-v3)
5. Deploy SPA with rewrite (e.g. Vercel: all routes → /index.html)

### Section: Performance notes
- Caching via TanStack Query (e.g. bookings, available-cars with staleTime)
- RPC for availability checks (check_available_cars) and assign_car_to_booking
- Role-based UI rendering to avoid loading unnecessary data

### CTA
- Request Demo

---

## 8. Pricing Page

### Hero
- **Heading:** Pricing
- **Intro:** MVP, Pro, and Custom tiers. Pricing depends on fleet size and modules.

### Tiers
- **MVP** – Best for: Small fleets, core operations  
  - Fleet, bookings, billing | Advance & transfers | Services & critical queue | Dashboard & roles | Mobile-friendly UI  
  - CTA: Request Demo

- **Pro** – Best for: Growing fleets, full workflow  
  - Everything in MVP | Company bills & PDFs | Reports & calendar | Incidents & downtime | Priority support  
  - CTA: Request Demo

- **Custom** – Best for: Enterprise, tailored setup  
  - Everything in Pro | Custom integrations | Dedicated onboarding | SLA & support  
  - CTA: Request Demo

- **Footer line:** Pricing depends on fleet size and modules. Contact us for a tailored quote.

### CTA
- Request Demo (size lg)

---

## 9. FAQ Page

### Hero
- **Heading:** FAQ
- **Intro:** Common questions about ServiceWise.

### Q&A (accordion)
1. **Does inquiry block vehicles?**  
   Yes. Inquiry, tentative, confirmed, and ongoing bookings all block the vehicle for that time range (with buffer). Completed and cancelled do not block.

2. **Can it prevent double booking?**  
   Yes. The UI only adds vehicles that are still available when you click "Add Selected", and the backend (check_available_cars and assign_car_to_booking) rejects assignments that overlap with inquiry/tentative/confirmed/ongoing.

3. **Do supervisors see billing?**  
   No. Supervisors do not see Bookings or Billing in the sidebar. They see Fleet, Drivers, Odometer, Services, Critical Queue, Downtime Report, and Reports (read-only).

4. **Is minimum KM configurable?**  
   Yes. System config (Settings) includes minimum_km_per_km and minimum_km_hybrid_per_day (e.g. 300 km/day). These apply to per_km and hybrid rate calculations.

5. **Can we generate PDFs?**  
   Yes. Customer bills and company bills can be generated as PDFs and downloaded.

6. **Can it be deployed on our Supabase/Vercel?**  
   Yes. You use your own Supabase project (Postgres, Auth, RLS, Storage, Edge Functions) and deploy the SPA to Vercel or any static host with SPA rewrite.

7. **Is it mobile friendly?**  
   Yes. The app is responsive with a collapsible sidebar (hamburger + sheet on mobile), stacked cards, and touch-friendly controls.

8. **Can we add calendar/reports later?**  
   Yes. Calendar view and full reports/analytics are in the roadmap (future-ready). The product is built to extend.

9. **What happens when a vehicle is in downtime?**  
   Downtime logs mark a vehicle as unavailable for a date range. check_available_cars excludes cars in downtime, so they do not appear as available for booking.

10. **How are transfers tracked?**  
    When advance is received in cash or a personal account, a transfer is expected (move to company). Transfers are tracked with status (pending/completed), transfer date, cashier name, and notes. Financials page shows pending and completed transfers.

### CTA
- Request Demo

---

## 10. Contact Page (Request Demo)

### Hero
- **Heading:** Request Demo
- **Intro:** Tell us about your fleet and we’ll set up a tailored demo.

### What the demo covers
- Walkthrough of fleet, bookings, and billing workflow
- Conflict-safe vehicle assignment and availability
- Advance capture and transfer tracking
- Service rules and critical queue
- Roles and permissions (Admin, Manager, Supervisor)

### Form fields
- Company name (required)
- Fleet size (placeholder: e.g. 10–50)
- City
- Contact person (required)
- Phone (required)
- Email (required)
- Message (placeholder: Any specific requirements or questions?)

### Submit button
- Label: Submit (loading: Sending…)

### Success state (after submit)
- **Heading:** Request received
- **Message:** Thanks for your interest. We’ll get back to you shortly to schedule a demo tailored to your fleet size.

---

*End of marketing content. Refine the copy above, then we can update the corresponding .tsx files.*
