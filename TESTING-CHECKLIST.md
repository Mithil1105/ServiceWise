# ServiceWise / TravelTrak Ops – Complete Testing Checklist

Use this checklist to test the app end-to-end. Check off each item as you verify it. Test with **Admin**, **Manager**, and **Supervisor** roles where access differs.

---

## 1. Authentication & Session

- [ ] **Login**
  - [ ] Login with valid email/password succeeds and redirects to `/app` (or onboarding if no org).
  - [ ] Invalid credentials show an error; user stays on `/auth`.
  - [ ] Login page shows organization logo or ServiceWise default logo (`/SWlogo.png`) when org has no logo.
- [ ] **Logout**
  - [ ] Logout clears session and redirects to home or auth.
  - [ ] After logout, protected routes redirect to login or home.
- [ ] **Session persistence**
  - [ ] Refreshing the page keeps the user logged in.
  - [ ] Session does not drop unexpectedly (e.g. after report export or long idle).

---

## 2. Onboarding & Organization Join

- [ ] **Join by code**
  - [ ] Visiting `/onboarding` with valid org code (e.g. in `?orgCode=SW-XXXX-XXXX`) pre-fills the code.
  - [ ] Submitting a valid join code (format `SW-XXXX-XXXX`) sends join request or joins org.
  - [ ] Invalid code format shows validation error.
  - [ ] After successful join, user can access `/app` (or is directed there).
- [ ] **Verify email**
  - [ ] Unverified user is redirected to `/verify-email` when appropriate.
  - [ ] Verify-email flow works as expected (if used in your flow).

---

## 3. Role-Based Access (Sidebar & Pages)

Test with **Admin**, **Manager**, and **Supervisor** accounts.

- [ ] **Admin**
  - [ ] Sees: Dashboard, Bookings, Billing, Fleet, Drivers, Odometer, Services, Critical Queue, Incidents, Downtime Report, Reports.
  - [ ] Sees admin section: Financials, Supervisors, Settings, Import, **Users**.
  - [ ] Can open Users, Billing, Settings, Import, Financials, Supervisors.
- [ ] **Manager**
  - [ ] Sees same main nav as Admin.
  - [ ] Sees admin section: Financials, Supervisors, Settings, Import; **Users** visible only if configured for manager (current spec: Users is admin-only).
  - [ ] Cannot access User Management if restricted to admin (confirm 403 or redirect).
- [ ] **Supervisor**
  - [ ] Sees: Dashboard, **Bookings**, Fleet, Drivers, Odometer, Services, Critical Queue, Incidents, Downtime Report, Reports.
  - [ ] Does **not** see Billing in main nav.
  - [ ] Sees admin section: Settings, Import (no Financials, no Users).
  - [ ] Bookings list shows only bookings needing vehicle assignment (e.g. confirmed/ongoing, not fully assigned).
- [ ] **Master Admin** (if applicable)
  - [ ] Sees “Admin” link in sidebar pointing to `/admin`.
  - [ ] Can access `/admin`, `/admin/organizations`, `/admin/organizations/:id`.

---

## 4. Default Logo & Branding

- [ ] **Default org logo**
  - [ ] When organization has no `logo_url`, app shows ServiceWise logo (`/SWlogo.png`) in:
    - [ ] Sidebar
    - [ ] App header (AppLayout)
    - [ ] Auth (login) page
    - [ ] Settings (if logo area shown)
    - [ ] Bills / BillingManagement / BillViewPage / BookingInvoice (when applicable)
  - [ ] If logo URL fails to load, fallback to `/SWlogo.png` (onError).
- [ ] **Custom logo**
  - [ ] After uploading org logo in Settings, sidebar and header show the custom logo.

---

## 5. Dashboard

- [ ] **Admin / Manager dashboard**
  - [ ] Dashboard loads without error.
  - [ ] KPIs or summary cards show (e.g. active cars, critical items, attention items).
  - [ ] Critical Queue popup appears when there are overdue critical services (and not snoozed).
  - [ ] Dismissing critical popup works (snooze for today).
  - [ ] Links to Fleet, Critical Queue, Services, etc. work.
  - [ ] Monthly snapshot / utilization (over-used / under-used) display if applicable.
- [ ] **Supervisor dashboard**
  - [ ] Supervisor sees SupervisorDashboard (assignments / tasks), not the full admin dashboard.

---

## 6. Fleet

- [ ] **Fleet list**
  - [ ] List of vehicles loads; columns and filters work.
  - [ ] “Add vehicle” (or similar) visible to Admin/Manager; Supervisor sees list (and only assigned cars if scoped).
- [ ] **Add vehicle (Fleet New)**
  - [ ] All required fields validated; optional fields save correctly.
  - [ ] Custom fields (from Settings fleet form config) appear and save.
  - [ ] After create, redirect to fleet list or detail.
- [ ] **Fleet detail**
  - [ ] Opening a vehicle shows details, service history, incidents, downtime, documents.
  - [ ] Add downtime, add service, add incident from detail page work (where applicable).
  - [ ] Documents section: upload/view/delete (Admin) works; permissions respected.
- [ ] **Vehicle report**
  - [ ] From fleet or link, Vehicle Report opens for a vehicle; data and date range work.

---

## 7. Drivers

- [ ] **Drivers list**
  - [ ] List loads; search/filter work.
  - [ ] Add driver: required fields (e.g. name, phone) validated.
  - [ ] License type, expiry, driver type (permanent/temporary), status (active/inactive) save correctly.
- [ ] **Edit driver**
  - [ ] Edit driver and save; changes persist.
- [ ] **License / documents**
  - [ ] License or document upload/view works where implemented.

---

## 8. Odometer

- [ ] **Odometer entries**
  - [ ] List of odometer entries for vehicles loads; date/vehicle filters work.
  - [ ] Add odometer entry: vehicle, date, reading required; save succeeds.
  - [ ] Only assigned vehicles appear for Supervisor.

---

## 9. Services

- [ ] **Services list**
  - [ ] Service records list loads; filters (vehicle, date range) work.
- [ ] **New service**
  - [ ] Service form: vehicle, service name/rule, date, odometer, cost, vendor, notes, bill path, warranty, serial number, custom attributes (if configured).
  - [ ] All form-configured fields appear and save; validation works.
- [ ] **Service rules**
  - [ ] Rules/brands used in dropdowns load; creating from Service New or Settings works if applicable.

---

## 10. Critical Queue

- [ ] **Critical queue page**
  - [ ] Page loads; overdue and due-soon items show.
  - [ ] Vehicle/card links to fleet detail or service.
  - [ ] Snooze/dismiss behavior consistent with Dashboard.

---

## 11. Incidents

- [ ] **Incidents list**
  - [ ] Incidents list loads; filters (vehicle, type, date) work.
- [ ] **Add incident – general**
  - [ ] Add incident: vehicle, date, type (e.g. accident, breakdown, other), driver (manual or auto), cost, notes.
  - [ ] **Driver auto-fill**: For incident date, driver is auto-fetched from booking/car assignment at that time; can override manually.
- [ ] **Add incident – Traffic Challan**
  - [ ] Type “Traffic Challan” shows challan-specific fields: challan type (dropdown), amount/fine (₹), driver (auto-filled from date).
  - [ ] Challan types dropdown is populated from Settings → Challan types; if none, message suggests adding in Settings.
  - [ ] Submitting creates both incident and traffic challan record; driver is linked.
- [ ] **Edit / delete incident**
  - [ ] Edit and delete (if available) work and reflect in list and reports.

---

## 12. Downtime Report

- [ ] **Filters**
  - [ ] Period: Last 30 / 90 / 180 days, All time.
  - [ ] Reason: All Reasons + each configured reason.
  - [ ] Vehicle: All Vehicles + per-vehicle filter.
  - [ ] Changing filters updates KPIs, charts, and tables.
- [ ] **KPIs**
  - [ ] Total Downtime, Total Incidents, Currently Down, Avg. per Incident display correctly.
- [ ] **Charts**
  - [ ] Downtime by reason (pie) and monthly trend (bar) render and match filtered data.
- [ ] **Tables**
  - [ ] Top 10 vehicles by downtime: data correct; “View Details” links to fleet detail.
  - [ ] “Drivers with Most Incidents” (from incidents/downtime) shows when data exists.
- [ ] **Spending summary**
  - [ ] Card “Amount spent (selected period)” shows: Services, Incidents, Traffic challans, Total (₹).
  - [ ] Values match selected period (same as downtime filters).
- [ ] **Traffic challan reports**
  - [ ] “Troublesome drivers (challans)” table: driver name, phone, challan count, total fines (₹); sorted by count.
  - [ ] “Total fines in challans” card: period total and breakdown by challan type (count + total ₹).
  - [ ] Both use same period as Downtime Report filters.
- [ ] **Add downtime**
  - [ ] “Add downtime” opens modal; vehicle, reason, notes, estimated uptime, custom fields (if any) work; submit creates downtime.
- [ ] **Export CSV**
  - [ ] Export CSV downloads; file contains filtered downtime records with expected columns (Vehicle, Start/End, Duration, Reason, Notes).

---

## 13. Reports

- [ ] **Vehicle selection**
  - [ ] Select vehicles for export; “Select All”, “Clear”, “Reverse” work.
  - [ ] Export button disabled when no vehicles selected; hint shown when no data types selected.
- [ ] **Date range**
  - [ ] Calendar date range picker works; “All time” option selects all time (no date filter).
  - [ ] Trigger label shows “All time” when All time is selected.
- [ ] **Data types**
  - [ ] Checkboxes: Service Records, Odometer, Incidents, Downtime, Traffic challans, External expenses (petty).
  - [ ] At least one type required to export; export includes only selected types.
- [ ] **Export CSV**
  - [ ] Export runs without error; CSV downloads.
  - [ ] CSV has proper headers (Record Type, Vehicle, Date, Driver Name, Created By, Category/Service, Amount (₹), etc.).
  - [ ] Record types and source values use consistent nomenclature (e.g. “Service”, “Odometer Entry”, “External Expense (Petty Cash)”, “Petty Cash”).
  - [ ] **No logout after export**: User remains logged in after download (no 429 or session refresh issue).
- [ ] **Traffic challan reports (on Reports page)**
  - [ ] “Troublesome drivers” and “Total fines in challans” cards show data for selected date range (or all time).

---

## 14. Financials (Admin/Manager)

- [ ] **Financials page**
  - [ ] Page loads; summary or list of financial data (e.g. by vehicle/booking) displays.
  - [ ] Filters and links work.

---

## 15. Settings

- [ ] **Access**
  - [ ] Only Admin (and Manager if intended) can access Settings; or read-only for non-admin.
- [ ] **Branding**
  - [ ] Company name, logo upload, terms & conditions, bill prefix: save and reflect across app (bills, invoices, logo in sidebar/header).
- [ ] **Form configs**
  - [ ] Fleet form config: custom fields, required/hidden; new fleet form reflects changes.
  - [ ] Driver form config: same.
  - [ ] Booking form config: same for booking new/edit.
  - [ ] Service record form config: same for new service.
  - [ ] Downtime form config: reason options, custom fields; downtime modal reflects.
  - [ ] Incident form config: same for incident modal.
- [ ] **Challan types**
  - [ ] Add challan type (name); list shows in Settings.
  - [ ] Challan types appear in Incidents → Traffic Challan dropdown and in Reports/Downtime Report challan breakdown.
  - [ ] Delete challan type (if supported) works; existing challans may keep type name or show “Other”.
- [ ] **Leave prompt**
  - [ ] With unsaved changes in Settings, navigating away prompts “Leave / Discard” (or similar); discard/cancel/save behavior correct.

---

## 16. Import

- [ ] **Access**
  - [ ] Import page only for Admin/Manager; Supervisor redirected or link hidden.
- [ ] **Drivers CSV**
  - [ ] Download template; template has expected headers (name, phone, location, region, license_type, license_expiry, notes, status, driver_type).
  - [ ] Upload valid CSV: preview shows; validation (required fields, license_type lmv/hmv, driver_type permanent/temporary, status active/inactive, license_expiry YYYY-MM-DD) runs.
  - [ ] Invalid row shows error; fix and re-upload or skip invalid rows if supported.
  - [ ] Import creates drivers; they appear in Drivers list.
- [ ] **Customers CSV**
  - [ ] Template: name, phone. Upload and import; customers appear where used (e.g. bookings).
- [ ] **Fleet CSV**
  - [ ] Template: vehicle_number, brand, model, year, fuel_type, seats, vehicle_type, vehicle_class, owner_name, vin_chassis, notes, initial_odometer.
  - [ ] Validation: vehicle_number required; vehicle_type private/commercial; vehicle_class lmv/hmv; year, seats valid.
  - [ ] Import creates cars; they appear in Fleet.

---

## 17. User Management (Admin only)

- [ ] **Access**
  - [ ] Only Admin can open User Management; Manager gets no access or redirect.
- [ ] **List**
  - [ ] All users in organization listed; search works.
- [ ] **Create user**
  - [ ] Form: email, password, name (and role if applicable). Validation: email format, password min length.
  - [ ] Submit calls org-admin-create-user (Edge Function) or signUp; new user appears in list and can log in (or receive invite).
- [ ] **Reset password**
  - [ ] Reset password action calls org-admin-reset-password (Edge Function); user receives reset or temporary password as designed.
- [ ] **Edit / delete user**
  - [ ] Edit user (name, role) if supported; delete or deactivate if supported; list updates.

---

## 18. Bookings

- [ ] **Bookings list (Admin/Manager)**
  - [ ] List loads; status filter (all, confirmed, ongoing, completed, cancelled) works.
  - [ ] Search by ref/customer works.
  - [ ] “New Booking” goes to Booking New; row actions: Edit, Invoice, Bills, History.
- [ ] **Bookings list (Supervisor)**
  - [ ] Only bookings needing vehicle assignment (e.g. confirmed/ongoing, not fully assigned) shown.
  - [ ] Primary action: “Assign vehicles” (or Edit with assign-only flow).
- [ ] **Booking New**
  - [ ] Customer, pickup/drop addresses, start/end date/time, trip type (outstation / one-way).
  - [ ] **Estimated KM**: For outstation, formula (distance × 2 + 75 km); for one-way, (distance + 60 km). Calculation shown when distance is available.
  - [ ] Requested vehicles: add rows with brand, model, rate type, rate, etc.; Admin/Manager can edit; Supervisor may have limited edit.
  - [ ] Assigned vehicles: link each to a requested vehicle; rates auto-fill from requested vehicle.
  - [ ] Dates in DD/MM/YYYY (or configured) format where applicable.
  - [ ] Create booking; appears in list and calendar.
- [ ] **Booking Edit**
  - [ ] **Link to requested vehicle**: Required when assigning vehicles; dropdown “Select requested vehicle to auto-fill rates (required)”;
  - [ ] Cannot save assigned vehicle without linking to a requested vehicle (validation).
  - [ ] **Estimated KM**: Editable; formula/calculation shown when distance used (outstation: distance×2+75; one-way: distance+60).
  - [ ] **Calculated total**: For per_km/hybrid, calculated total and minimum km logic (e.g. threshold per day) display and save correctly.
  - [ ] Supervisor: assign-only mode (only vehicle assignment); other fields read-only or hidden.
  - [ ] Save updates booking and vehicle assignments.
- [ ] **Booking Calendar**
  - [ ] Calendar view loads; bookings show on correct dates.
  - [ ] Click booking opens detail or edit; Admin/Manager can create/edit from calendar if supported.
- [ ] **Booking Invoice**
  - [ ] Invoice page loads for booking; vehicle details, estimated/final km, amounts, org logo (or default) display.
- [ ] **Bills (per booking)**
  - [ ] Bills list for booking; add bill, view bill; amounts and line items correct.
- [ ] **Booking History**
  - [ ] History or activity for booking shows changes (if implemented).

---

## 19. Billing

- [ ] **Billing management**
  - [ ] Billing dashboard/list loads; filters and search work.
  - [ ] Org logo (or default) on bills/invoices.
- [ ] **Bill view**
  - [ ] Opening a bill shows full bill detail; PDF or print if available.

---

## 20. Supervisors (Admin/Manager)

- [ ] **Supervisors list**
  - [ ] List of supervisors (or users with supervisor role) loads.
  - [ ] Assign cars to supervisor: selection saves; supervisor sees only assigned cars in Fleet, Odometer, Reports, etc.
- [ ] **Car assignments**
  - [ ] After assignment change, supervisor’s Fleet/Odometer/Reports reflect only assigned vehicles; Downtime/Incidents scoped the same.

---

## 21. Master Admin (optional)

- [ ] **Admin home**
  - [ ] `/admin` loads; links to organizations.
- [ ] **Organizations list**
  - [ ] List of organizations; search or filters work.
- [ ] **Organization detail**
  - [ ] View/edit org; members or usage data if shown.

---

## 22. Marketing & Public Pages

- [ ] **Home (Index)**
  - [ ] `/` loads; navigation to product, features, pricing, contact, login.
- [ ] **Product, Features, Roles, How it works, Security, Pricing, Contact**
  - [ ] Each page loads; content and links work.
- [ ] **404**
  - [ ] Unknown route shows NotFound page.

---

## 23. Edge Functions & API

- [ ] **org-admin-create-user**
  - [ ] Called from User Management create; 200 with valid token/body; user created in Auth and org.
  - [ ] 401 with invalid/missing token; no user created.
- [ ] **org-admin-reset-password**
  - [ ] Called from User Management reset; 200 with valid token/body; password reset flow works.
- [ ] **petty-expenses (reports export)**
  - [ ] Report export with “External expenses” fetches petty expenses; no 429; user not logged out.

---

## 24. General UX & Robustness

- [ ] **Navigation**
  - [ ] Sidebar collapse/expand works; active route highlighted.
  - [ ] Breadcrumbs or back buttons where expected (e.g. Fleet detail → Fleet).
- [ ] **Loading & errors**
  - [ ] Loading states shown during fetches; errors show toast or inline message (no silent failures).
- [ ] **Responsiveness**
  - [ ] Key pages usable on smaller viewport (sidebar, tables, forms).
- [ ] **Data scope**
  - [ ] Supervisor sees only assigned cars everywhere (Fleet, Odometer, Incidents, Downtime, Reports, Bookings for assignment).
  - [ ] Multi-tenant: switching org (if supported) or different org users see only their org’s data.

---

## 25. Data Consistency & Nomenclature

- [ ] **Reports export**
  - [ ] Record Type values: e.g. “Service”, “Odometer Entry”, “Incident”, “Downtime”, “Traffic Challan”, “External Expense (Petty Cash)”.
  - [ ] Source: “Petty Cash” (not raw enum).
  - [ ] Category/Service: title-case, underscores as spaces (e.g. “Traffic Challan”, “Breakdown”).
  - [ ] Headers: “Created By”, “Amount (₹)”, “Bill / Invoice Path”, “Category / Service”.
- [ ] **Dates**
  - [ ] Date inputs and displays use DD/MM/YYYY (or configured format) where specified (e.g. Booking, forms).

---

## Quick role matrix (reference)

| Feature        | Admin | Manager | Supervisor      |
| -------------- | ----- | ------- | --------------- |
| Dashboard      | Full  | Full    | Supervisor view |
| Bookings       | Full  | Full    | Assign only     |
| Billing        | Yes   | Yes     | No              |
| Fleet          | Full  | Full    | Assigned only   |
| Users          | Yes   | No      | No              |
| Settings       | Full  | Full    | Limited?        |
| Import         | Yes   | Yes     | No              |
| Reports export | Yes   | Yes     | Assigned only   |

---

*End of checklist. Run through each section for full regression; use multiple roles and orgs where applicable.*
