# SaaS Implementation – Complete Reference

This document describes **all** SaaS-related work in the TravelTrak Ops project: multi-tenant organizations, platform admin console, plans and entitlements, onboarding, join-by-code, org admin user management, migrations, Edge Functions, and frontend integration. It is intended as a single source of truth for developers and auditors.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Database Migrations (Extreme Detail)](#2-database-migrations-extreme-detail)
3. [Edge Functions (Extreme Detail)](#3-edge-functions-extreme-detail)
4. [Frontend: Hooks, Pages, and Routing](#4-frontend-hooks-pages-and-routing)
5. [Auth and Session Flow](#5-auth-and-session-flow)
6. [Deployment Checklist](#6-deployment-checklist)

---

## 1. Overview

### 1.1 Architecture Summary

- **Multi-tenant:** Every business table has `organization_id`; RLS restricts access to the current user’s organization.
- **Platform admins:** Stored in `platform_admins`; can create orgs, manage plans, suspend orgs, create users in any org; **hidden from tenant user lists** via RLS.
- **Plans & entitlements:** `plans`, `org_subscriptions`, `org_plan_overrides`; `get_org_entitlements` drives limits (users, vehicles) and `can_write` (trial/active/suspended).
- **Onboarding:** New signups have `organization_id = NULL`; they either **create** an org (Edge Function `org-create-trial`) or **join** by code (numeric `org_code` via `org-join-by-code`, or human-readable `join_code` via `organization_members` pending → approve).
- **Org admin user management:** Org admins create users, reset passwords, and activate/deactivate users via Edge Functions; platform admins can do the same for any org.

### 1.2 Key Tables (SaaS-Only)

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant org; `org_code` (6–7 digits), `join_code` (SW-XXXX-XXXX), `status`, `plan` (legacy) |
| `platform_admins` | Platform admin users; `level`, `is_active` |
| `plans` | Plan definitions; `max_users`, `max_vehicles`, `features` |
| `org_subscriptions` | Per-org subscription; `plan_id`, `status`, `trial_ends_at` |
| `org_plan_overrides` | Per-org overrides; overrides plan limits/trial |
| `organization_settings` | Org-level app settings (buffer, minimum_km, etc.) |
| `platform_announcements` | Announcements; target all/org/plan |
| `platform_audit_log` | Platform actions for audit |
| `onboarding_requests` | Lightweight log of create_org / join_org actions |
| `organization_members` | Join-by-code (SW-XXXX-XXXX): pending / active / blocked; trigger sets `profiles.organization_id` and `user_roles` on approve |
| `org_user_audit_log` | Org-level audit for create_user, reset_password, deactivate_user, activate_user |

### 1.3 Two Join Flows

1. **Numeric org code (6–7 digits):** Legacy flow. User calls Edge Function `org-join-by-code` with `orgCode`; service role updates `profiles.organization_id` and upserts `user_roles`. No approval step.
2. **Join code (SW-XXXX-XXXX):** User inserts into `organization_members` with `status = 'pending'`. Org admin updates row to `status = 'active'`; trigger `organization_members_on_approve` sets `profiles.organization_id` and upserts `user_roles`.

---

## 2. Database Migrations (Extreme Detail)

All migrations live under `supabase/migrations/`. SaaS-specific ones are listed below in execution order.

---

### 2.1 `20260203120000_phase1_multi_tenant_organizations.sql`

**Purpose:** Introduce organizations and add `organization_id` to all business tables; backfill with default org DEMO; no RLS isolation yet.

**Details:**

1. **Extension:** `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`
2. **Table `organizations`:**
   - Columns: `id` (UUID PK), `name`, `slug` (UNIQUE), `status` ('active' | 'suspended'), `plan` (default 'mvp'), `created_at`, `created_by` (FK `auth.users`).
   - RLS enabled; policy: authenticated can SELECT all (no tenant filter yet).
3. **Add `organization_id` (nullable FK to `organizations`):**
   - On: `profiles`, `user_roles`, and a fixed list of business tables: `cars`, `drivers`, `customers`, `bookings`, `booking_vehicles`, `booking_requested_vehicles`, `booking_audit_log`, `bills`, `company_bills`, `transfers`, `bank_accounts`, `service_rules`, `car_service_rules`, `service_records`, `odometer_entries`, `incidents`, `downtime_logs`, `system_config`, `car_documents`, `car_notes`, `car_assignments`, `supervisor_activity_log`, `user_snoozes`, `tentative_holds`.
   - Only if table exists (dynamic SQL).
4. **Default org:** Insert organization with name `DEMO`, slug `demo`, status `active`, plan `mvp`.
5. **Backfill:** For each of the above tables, set `organization_id = <demo_id>` where `organization_id IS NULL`.
6. **NOT NULL:** Alter `organization_id` to NOT NULL on all those tables.
7. **Indexes:** Create `idx_<table>_organization_id` on each.
8. **Uniques:**  
   - `cars`: drop `cars_vehicle_number_key` if exists; add `cars_organization_id_vehicle_number_key`.  
   - `bookings`: drop `bookings_booking_ref_key` if exists; add `bookings_organization_id_booking_ref_key`.
9. **Trigger `handle_new_user`:** On `auth.users` insert, insert into `profiles` with `organization_id = demo_org_id` (or first org).
10. **Function `get_my_org_id()`:** Returns `organization_id` from `profiles` where `id = auth.uid()`; STABLE, SECURITY DEFINER, `search_path = public`.

---

### 2.2 `20260203140000_phase2_rls_tenant_isolation.sql`

**Purpose:** Enforce tenant isolation with RLS; one org per user; no cross-org access for normal users.

**Details:**

1. **`get_my_org_id()`:** Recreated (same as Phase 1).
2. **`is_org_admin()`:** Returns true if current user has a row in `user_roles` with `organization_id = get_my_org_id()` and `role IN ('admin', 'manager')`.
3. **Drop all existing policies** on: `organizations`, `profiles`, `user_roles`, and all org-scoped business tables (same list as Phase 1). Enable RLS on each.
4. **Policies:**
   - **organizations:** `org_select_own` – SELECT where `id = get_my_org_id()`.
   - **profiles:** `profile_select_own` (SELECT own), `profile_select_org` (SELECT same org), `profile_update_own` (UPDATE own), `profile_insert_own` (INSERT own).
   - **user_roles:** `tenant_select` (SELECT same org), `tenant_insert_admin`, `tenant_update_admin`, `tenant_delete_admin` (INSERT/UPDATE/DELETE only if `is_org_admin()` and same org).
   - **All other org-scoped tables:** For each: `tenant_select`, `tenant_insert`, `tenant_update`, `tenant_delete` – all scoped to `organization_id = get_my_org_id()`.

---

### 2.3 `20260203160000_phase3_platform_admin_console.sql`

**Purpose:** Platform-only tables, RLS for platform admins, and cross-org read for platform console.

**Details:**

1. **Table `platform_admins`:** `user_id` (PK, FK `auth.users` ON DELETE CASCADE), `level` (default 'superadmin'), `is_active` (default true), `created_at`.
2. **Table `plans`:** `id`, `name` (UNIQUE), `price_monthly_inr`, `max_users`, `max_vehicles`, `features` (JSONB), `is_active`, `created_at`.
3. **Table `org_subscriptions`:** `organization_id` (PK, FK `organizations`), `plan_id` (FK `plans`), `status` ('trial'|'active'|'past_due'|'canceled'), `trial_ends_at`, `current_period_end`, `billing_email`, `updated_at`. Indexes on `plan_id`, `status`.
4. **Table `platform_announcements`:** `id`, `title`, `message`, `type` ('info'|'warning'|'maintenance'), `target_type` ('all'|'org'|'plan'), `target_id`, `starts_at`, `ends_at`, `is_active`, `created_by`, `created_at`. Index on (is_active, starts_at, ends_at).
5. **Table `organization_settings`:** `organization_id` (PK), `buffer_minutes`, `minimum_km_per_km`, `minimum_km_hybrid_per_day`, `support_notes`, `updated_at`.
6. **Table `platform_audit_log`:** `id`, `actor_user_id`, `action`, `target_type`, `target_id`, `before`, `after` (JSONB), `created_at`. Index on `created_at`.
7. **Function `is_platform_admin()`:** Returns true if `platform_admins` has row for `auth.uid()` and `is_active = true`.
8. **RLS on new tables:**
   - **platform_admins:** SELECT only if `is_platform_admin()`.
   - **plans:** ALL only if `is_platform_admin()`.
   - **org_subscriptions:** Tenant SELECT own org; platform admin ALL.
   - **platform_announcements:** Tenant SELECT active and matching target (all / org / plan); platform admin ALL.
   - **organization_settings:** Tenant SELECT own; org admin UPDATE/INSERT own; platform admin ALL.
   - **platform_audit_log:** Platform admin SELECT and INSERT.
9. **Organizations:** Add policy `org_select_platform_admin` – SELECT if `is_platform_admin()` (cross-org list).
10. **profiles, cars, bookings:** Add policies `*_platform_admin_select` – SELECT if `is_platform_admin()` (for platform dashboard metrics).
11. **Seed plans:** Insert MVP (0 INR, 10 users, 50 vehicles), Pro (4999, 50, 200), Enterprise (14999, null, null). ON CONFLICT (name) DO NOTHING.
12. **Comment:** Seed master admin via separate script (e.g. SEED_MASTER_ADMIN.sql).

---

### 2.4 `20260203180000_phase4_plan_enforcement.sql`

**Purpose:** Effective entitlements (plan + overrides), vehicle limit trigger, and `can_write` gating on all write policies.

**Details:**

1. **Table `org_plan_overrides`:** `organization_id` (PK), `override_price_monthly`, `override_max_users`, `override_max_vehicles`, `override_features`, `override_trial_ends_at`, `notes`, `updated_by`, `updated_at`. RLS: platform admin ALL only.
2. **Function `get_org_entitlements_internal(p_org_id)`:**
   - Joins `organizations` + `org_subscriptions` + `plans` + `org_plan_overrides`; computes effective price, max_users, max_vehicles, features, trial_ends_at.
   - Counts users (profiles) and vehicles (cars) for that org.
   - `trial_expired` = trial_ends_at < now().
   - `can_write` = org not suspended AND subscription not canceled AND NOT trial_expired; overridden to true if `is_platform_admin()`.
   - Returns JSONB: plan, price, max_users, max_vehicles, users_count, vehicles_count, subscription_status, trial_expired, org_status, can_write, overridden.
3. **Function `get_org_entitlements(p_org_id)`:**
   - If `p_org_id` null, uses `get_my_org_id()`.
   - If requesting another org and not platform admin, raises 'Access denied'.
   - Returns `get_org_entitlements_internal(p_org_id)`.
4. **Trigger `check_vehicle_limit`:** BEFORE INSERT on `cars`. If not platform admin, gets entitlements for NEW.organization_id; if `max_vehicles` is set and `vehicles_count >= max_vehicles`, raises 'Vehicle limit reached for your plan'.
5. **Write policies:** For all tenant INSERT/UPDATE/DELETE policies on business tables and on `user_roles`, `profiles`, `organization_settings`, drop and recreate with an extra condition: `(get_org_entitlements(get_my_org_id())->>'can_write' = 'true') OR is_platform_admin()`.

---

### 2.5 `20260204100000_phase5_onboarding_org_join.sql`

**Purpose:** Allow new signups without org; add `org_code` (6–7 digit) to organizations; onboarding_requests; block client from changing `profiles.organization_id`; unique (user_id, organization_id) on user_roles; stop assigning DEMO on signup.

**Details:**

1. **profiles.organization_id:** ALTER to DROP NOT NULL (new users start with null).
2. **Function `generate_org_code()`:** Returns 6–7 digit numeric string; loop until unique in `organizations.org_code`.
3. **organizations:** Add column `org_code` TEXT NULL; backfill with `generate_org_code()` per row; set NOT NULL; constraint `org_code ~ '^[0-9]{6,7}$'`; unique index; default `generate_org_code()` for new rows.
4. **Table `onboarding_requests`:** `id`, `user_id`, `action` ('create_org'|'join_org'), `payload` (JSONB), `created_at`. Index on user_id. RLS: platform admin SELECT only; no INSERT for authenticated (only service role / Edge Functions).
5. **Trigger `profiles_block_org_id_change`:** BEFORE UPDATE on profiles. If NEW.organization_id != OLD.organization_id, allow only if `is_platform_admin()` or request.role = 'service_role' or role = 'service_role'; else raise exception.
6. **user_roles:** Add UNIQUE (user_id, organization_id) if not present.
7. **`handle_new_user`:** Replace: insert into profiles with `organization_id = NULL` (no DEMO assignment).

---

### 2.6 `20260204120000_tenant_hide_platform_admins.sql`

**Purpose:** Tenants must not see platform admins in user lists or role management.

**Details:**

1. **profiles:** Drop `profile_select_org`; create new `profile_select_org` – SELECT where `organization_id = get_my_org_id()` AND `id NOT IN (SELECT user_id FROM platform_admins WHERE is_active = true)`.
2. **user_roles:** Drop `tenant_select`; create new `tenant_select` – same org AND `user_id NOT IN (SELECT user_id FROM platform_admins WHERE is_active = true)`.

---

### 2.7 `20260204140000_phase6_org_admin_user_management.sql`

**Purpose:** Org admin user lifecycle: is_active, invited_by, created_via, deactivated_at; block client from changing is_active; org_user_audit_log.

**Details:**

1. **profiles:** Add columns `is_active` (default true), `invited_by_user_id` (FK auth.users), `created_via` ('self'|'org_admin'|'platform_admin'), `deactivated_at`. Index (organization_id, is_active). Backfill is_active/created_via.
2. **Trigger `profiles_block_is_active_change`:** BEFORE UPDATE; if is_active or deactivated_at changed and auth.uid() IS NOT NULL, raise (only service role / Edge Functions can change).
3. **Table `org_user_audit_log`:** `id`, `organization_id`, `actor_user_id`, `action` ('create_user'|'reset_password'|'deactivate_user'|'activate_user'), `target_user_id`, `before_state`, `after_state` (JSONB), `created_at`. RLS: tenant SELECT own org; org admin INSERT; platform admin SELECT all.

---

### 2.8 `20260205120000_join_code_and_organization_members.sql`

**Purpose:** Human-readable join code (SW-XXXX-XXXX), organization_members table, pending/active/blocked flow, trigger to set profile and user_roles on approve.

**Details:**

1. **Function `generate_join_code()`:** Returns 'SW-' + 4 alphanumeric + '-' + 4 alphanumeric; recursive until unique in `organizations.join_code`.
2. **organizations:** Add `join_code` TEXT NULL; backfill; NOT NULL; unique index; default `generate_join_code()`; constraint `join_code ~ '^SW-[A-Z0-9]{4}-[A-Z0-9]{4}$'`.
3. **Table `organization_members`:** `id`, `organization_id`, `user_id`, `role` ('supervisor'|'manager'|'admin'), `status` ('pending'|'active'|'blocked'), `created_at`, UNIQUE(organization_id, user_id). Indexes on (organization_id, status), user_id.
4. **RLS:**  
   - SELECT: user sees own memberships; org admin/manager sees members (including pending) for their org.  
   - INSERT: user can insert own row with status = 'pending'.  
   - UPDATE: org admin/manager can update rows where status = 'pending' (approve or block).
5. **Trigger `organization_members_on_approve`:** AFTER UPDATE. When NEW.status = 'active' and OLD.status != 'active': set `app.approving_member = true`; update profiles set organization_id, updated_at for NEW.user_id; upsert user_roles (user_id, organization_id, role).
6. **`profiles_block_org_id_change`:** Recreated to allow change when `current_setting('app.approving_member') = 'true'` (in addition to platform admin and service role).

---

### 2.9 `RUN_THIS_HIDE_MASTER_ADMIN_FROM_TENANTS.sql` (Manual)

**Purpose:** Ensure master admin is in platform_admins and that tenant RLS hides them. Run in Supabase SQL Editor.

**Details:**

1. Insert into `platform_admins` for user with email `mithil20056mistry@gmail.com` (ON CONFLICT DO UPDATE).
2. Same profile_select_org and tenant_select policy updates as in 20260204120000 (exclude platform_admins from tenant-visible profiles and user_roles).

---

### 2.10 `SEED_MASTER_ADMIN.sql` (Manual)

**Purpose:** Seed one platform superadmin after migrations. Run in SQL Editor.

**Details:** Insert into `platform_admins` (user_id, level) from auth.users where email = 'mithil20056mistry@gmail.com'; ON CONFLICT (user_id) DO UPDATE.

---

## 3. Edge Functions (Extreme Detail)

All run on Deno; use `createClient(supabaseUrl, serviceRoleKey)` for mutations. CORS headers allow `*` and common headers.

---

### 3.1 `platform-create-org`

**Purpose:** Platform admin creates a new organization and assigns themselves as admin (no email invite; caller becomes org admin).

**Auth:** Bearer = JWT; validate with `/auth/v1/user`; then check `platform_admins` for caller; 401 if no token, 403 if not platform admin.

**Body:** `orgName` (required), `planId` (optional), `trialDays` (optional), `status` ('active'|'suspended', default 'active').

**Logic:**

- Slug from org name; ensure unique (append random suffix if needed).
- Resolve plan: use `planId` or fetch MVP plan id.
- Insert `organizations` (name, slug, status, created_by); get id, org_code, join_code.
- Insert `org_subscriptions` (trial, trial_ends_at).
- Insert `organization_settings`.
- Insert `organization_members` (caller, admin, active).
- Insert `user_roles` (caller, admin).
- Update `profiles` set organization_id for caller.
- Insert `platform_audit_log` (org_created).
- Return `{ success, organizationId, orgCode, joinCode }`.

---

### 3.2 `org-create-trial`

**Purpose:** Authenticated user (any) creates their own org and is assigned as admin; used for onboarding “Create workspace”.

**Auth:** Bearer JWT; validate with anon client `getUser()` or service role `/auth/v1/user`; no platform admin check.

**Body:** `orgName` (required), `city`, `adminDisplayName` (optional).

**Logic:**

- Slug from org name; unique as above.
- Fetch MVP plan id.
- Trial 14 days; insert organizations, org_subscriptions, organization_settings.
- Update profiles (organization_id, name) for caller.
- Insert user_roles (caller, admin).
- Insert onboarding_requests (action: create_org, payload: org_id, org_name, city).
- Return `{ success, organizationId, orgCode, joinCode, planName, trialEndsAt }`.

---

### 3.3 `org-join-by-code`

**Purpose:** Authenticated user joins an org by **numeric** 6–7 digit org code (legacy flow); direct assign, no approval.

**Auth:** Bearer JWT (anon or service role validation).

**Body:** `orgCode` (6–7 digits, required), `displayName` (optional).

**Logic:**

- Look up organization by `org_code`; 404 if not found; 403 if org status = suspended.
- Update profiles (organization_id, optionally name) for caller.
- Upsert user_roles (caller, organization_id, role 'supervisor') on conflict (user_id, organization_id).
- Insert onboarding_requests (action: join_org).
- Return `{ success, organizationId, organizationName, orgCode }`.

---

### 3.4 `platform-create-org-admin-user`

**Purpose:** Platform admin creates a user in a given org (email + optional temp password); user is created in Auth and in profiles/user_roles; audit logged.

**Auth:** Bearer; must be platform admin.

**Body:** `organizationId`, `email` (required), `tempPassword` (optional), `role` ('admin'|'manager', default 'admin').

**Logic:**

- Create user with `supabaseAdmin.auth.admin.createUser` (email_confirm: true).
- Upsert profiles (organization_id, created_via: 'platform_admin', invited_by: caller).
- Upsert user_roles.
- Log platform_audit_log (org_admin_created).
- Return success and, if password was server-generated, `tempPasswordUsed` (the one-time password).

---

### 3.5 `platform-reset-password`

**Purpose:** Platform admin sends password reset email to a user (by userId or email).

**Auth:** Platform admin only.

**Body:** `userId` or `email` (one required).

**Logic:** Resolve user id; get email; call `supabaseAdmin.auth.resetPasswordForEmail` with redirectTo origin/auth?reset=1; log platform_audit_log; return success.

---

### 3.6 `platform-set-org-overrides`

**Purpose:** Platform admin sets or resets org_plan_overrides for an organization.

**Auth:** Platform admin only.

**Body:** `organizationId` (required), `override_max_users`, `override_max_vehicles`, `override_price_monthly`, `override_trial_ends_at`, `override_features`, `notes`, `resetToPlanDefaults` (boolean).

**Logic:** If reset or all null and row exists, delete row and log. Else upsert org_plan_overrides; log audit; return overrides.

---

### 3.7 `platform-set-plan`

**Purpose:** Platform admin updates org_subscriptions (plan_id, status, trial_ends_at, billing_email).

**Auth:** Platform admin only.

**Body:** `organizationId`, `planId`, `status`, `trialEndsAt`, `billingEmail`.

**Logic:** Upsert org_subscriptions; log platform_audit_log; return subscription.

---

### 3.8 `platform-suspend-org`

**Purpose:** Platform admin suspends or reactivates an organization.

**Auth:** Platform admin only.

**Body:** `organizationId`, `suspend` (boolean), `reason` (optional).

**Logic:** Update organizations.status to 'suspended' or 'active'; log audit; return status.

---

### 3.9 `org-admin-create-user`

**Purpose:** Org admin (or platform admin) creates a user in their org; enforces user limit from entitlements for org admins.

**Auth:** Bearer; caller must be org admin (user_roles admin/manager) or platform admin. If platform admin, can pass `organizationId` to create in any org.

**Body:** `email` (required), `role` ('supervisor'|'manager'|'admin'), `tempPassword`, `fullName`, `organizationId` (platform admin only).

**Logic:**

- Resolve organizationId (caller’s org or body.organizationId if platform admin).
- If not platform admin, call `get_org_entitlements_internal`; if max_users set and users_count >= max_users, return 403.
- Create user with auth.admin.createUser; upsert profiles (created_via: org_admin or platform_admin, invited_by for org_admin); upsert user_roles; insert org_user_audit_log; return success and optional tempPassword.

---

### 3.10 `org-admin-reset-password`

**Purpose:** Org admin (or platform admin) sets a new password for a user in their org (no email; immediate update).

**Auth:** Org admin or platform admin; org admin can only target users in same org.

**Body:** `targetUserId` (required), `newPassword` (optional; if missing or short, server generates).

**Logic:** Verify target in same org (for org admin); update password with auth.admin.updateUserById; log org_user_audit_log; return success and newPassword if server-generated.

---

### 3.11 `org-admin-set-active`

**Purpose:** Org admin (or platform admin) activates or deactivates a user in their org (sets profiles.is_active and deactivated_at).

**Auth:** Org admin or platform admin; cannot set active for self.

**Body:** `targetUserId`, `isActive` (boolean).

**Logic:** Prevent self; verify target in same org for org admin; update profiles (is_active, deactivated_at); log org_user_audit_log; return success.

---

### 3.12 `resend-send-email`

**Purpose:** Generic send email via Resend API. Used for custom emails (e.g. post-signup); not required for Supabase Auth (Auth can use SMTP/Resend separately).

**Secrets:** `RESEND_API_KEY`.

**Body:** `from`, `to` (string or array), `subject`, `html`, `text`, `replyTo`. Only `from` and `subject` required.

---

### 3.13 `create-user-v3`

**Purpose:** Legacy/create-user variant; may be used for non-SaaS flows. Not detailed here; see function source if needed.

---

## 4. Frontend: Hooks, Pages, and Routing

### 4.1 Invoke Helper

- **`src/lib/functions-invoke.ts`:** `invokeAuthed<T>(fnName, body?)` – refreshes session, gets access_token, calls `supabase.functions.invoke(fnName, { body, headers: { Authorization: 'Bearer ' + token } })`. Use for all Edge Function calls that require a signed-in user.

### 4.2 Hooks

- **`use-org.ts`:** From `useAuth()` returns `profile`, `orgId` (profile.organization_id), `role`, `loading`. One org per user; no switcher.
- **`use-join-organization.ts`:**  
  - `joinOrganization(code)` – validates SW-XXXX-XXXX, finds org by `join_code`, inserts `organization_members` with status 'pending'; returns `{ success, error }`.  
  - `useMyPendingJoinRequests()` – list current user’s pending memberships.  
  - `useJoinOrganizationMutation()` – mutation that calls `joinOrganization` and invalidates `organization_members`.  
  - `usePendingJoinRequests(orgId)` – for org admins; list pending join requests for that org (with profile names).
- **`use-entitlements.ts`:** `useEntitlements(orgId?)` – calls `supabase.rpc('get_org_entitlements', { p_org_id: orgId ?? null })`, returns typed Entitlements (plan, limits, can_write, etc.).
- **`use-platform-admin.ts`:** `usePlatformAdmin()` – queries `platform_admins` for current user; returns `{ isPlatformAdmin, loading, refetch }`; used for platform console gating and sidebar.

### 4.3 Pages

- **`/onboarding` – Onboarding.tsx:** Shown when user is signed in and `profile.organization_id` is null.  
  - If email not confirmed → redirect to `/verify-email`.  
  - Options: (1) **Join by code (SW-XXXX-XXXX):** calls `joinOrganization()` → “Request sent” (pending approval). (2) **Create workspace:** calls `invokeAuthed('org-create-trial', { orgName })` → success shows org/join code and trial end; copy code, then “Go to app”.  
  - Redirect to `/app` if user already has organization_id.
- **`/verify-email` – VerifyEmail.tsx:** Shown when user exists but email not confirmed; resend verification and instructions.
- **`/platform/*` – Platform console:** Wrapped in `PlatformLayout` (gated by `usePlatformAdmin()`; redirect if not platform admin).  
  - **PlatformHome:** Dashboard overview.  
  - **PlatformOrgsList:** List organizations (cross-org).  
  - **PlatformOrgDetail:** Single org: details, subscription, overrides, suspend, create user, reset password, audit.  
  - **PlatformPlans:** Manage plans.  
  - **PlatformAnnouncements:** Manage announcements.  
  - **PlatformAuditLog:** View platform_audit_log.
- **`/app/*` – AppLayout:** Tenant app (dashboard, bookings, fleet, user management, etc.). Shown when user has organization_id; otherwise redirect to onboarding or auth.
- **UserManagement (under /app):** Lists org members (profiles + user_roles; RLS hides platform admins). Org admins can create user (invoke `org-admin-create-user`), reset password (`org-admin-reset-password`), activate/deactivate (`org-admin-set-active`). Pending join requests (organization_members) can be approved/blocked here (update status to 'active' or leave/block).

### 4.4 Other Components

- **OrgCodeCard (marketing):** Home page “Enter company code” – accepts 6–7 digit code; if not logged in redirects to `/auth?orgCode=...`; if logged in with org to `/app`; else `/onboarding?orgCode=...`. Note: actual join by numeric code is done via `org-join-by-code` (or legacy flow); join by SW-XXXX-XXXX is via `joinOrganization()` and organization_members.

### 4.5 Types (`src/types/index.ts`)

- **AppRole:** 'admin' | 'manager' | 'supervisor'.
- **Profile:** includes `organization_id`, `is_active` (Phase 6).

---

## 5. Auth and Session Flow

- **Sign up:** Supabase Auth signUp; `handle_new_user` creates profile with `organization_id = NULL`.
- **After sign in:** Auth context loads profile and user_roles for current user. If `profile.organization_id` is null, app shows onboarding (create org or join by code). If set, user goes to `/app` (tenant) or can access `/platform` if platform admin.
- **Platform admin:** Determined by row in `platform_admins` (is_active); RLS and Edge Functions check this; tenants never see platform admin users in their org.

---

## 6. Deployment Checklist

- **Migrations:** Run in order: 20260203120000 through 20260205120000. Then run RUN_THIS_HIDE_MASTER_ADMIN_FROM_TENANTS.sql and SEED_MASTER_ADMIN.sql in SQL Editor if needed.
- **Edge Functions:** Deploy all that are used:  
  `platform-create-org`, `org-create-trial`, `org-join-by-code`, `platform-create-org-admin-user`, `platform-reset-password`, `platform-set-org-overrides`, `platform-set-plan`, `platform-suspend-org`, `org-admin-create-user`, `org-admin-reset-password`, `org-admin-set-active`.  
  Optionally: `resend-send-email` if using for custom emails.
- **Secrets:** SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (set by Supabase for functions); RESEND_API_KEY for resend-send-email.
- **Frontend env:** VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY for client and for invokeAuthed (Bearer token sent to Edge Functions).

---

*End of SaaS Implementation Detail.*
