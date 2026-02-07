# SaaS Refactor to ScoreWise-Style Membership Model

## What Was Removed

| Item | Location / Notes |
|------|------------------|
| `platform_admins` table | Dropped. Master admin now = `user_roles.role='admin'` with `organization_id IS NULL`. |
| `plans`, `org_subscriptions`, `org_plan_overrides` | Dropped. No trials, subscriptions, or plan gating. |
| `platform_announcements`, `platform_audit_log` | Dropped. |
| `onboarding_requests` | Dropped. |
| `get_org_entitlements`, `get_org_entitlements_internal` | Dropped. No plan/limit checks. |
| `is_platform_admin()` | Replaced by `is_master_admin()` (checks `user_roles` for role='admin' and organization_id IS NULL). |
| `check_vehicle_limit` trigger on cars | Dropped. No plan-based vehicle limits. |
| `can_write` gating in RLS | Removed from all policies. Tenant access is membership-based only. |
| `org_code` column (numeric 6–7 digit) | Dropped from `organizations`. Join only via `join_code` (SW-XXXX-XXXX). |
| `profiles_block_org_id_change` trigger | Dropped. Profile active org updated via RLS / edge function / approval trigger only. |
| Edge: `org-create-trial` | Deleted. No self-serve org creation. |
| Edge: `org-join-by-code` (numeric) | Deleted. Join only via `join-organization` (join_code SW-XXXX-XXXX). |
| Edge: `platform-create-org`, `platform-suspend-org`, `platform-set-plan`, `platform-set-org-overrides`, `platform-reset-password`, `platform-create-org-admin-user` | Deleted. Replaced by `admin-create-organization` and admin UI. |
| `/platform/*` routes, PlatformLayout, Platform* pages | Removed. Replaced by `/admin/*` (master admin). |
| `use-platform-admin`, `use-entitlements` | Removed / replaced by `useIsMasterAdmin`, membership-based hooks. |
| Organization creation from Onboarding | Removed. Only "Join organization" (join_code) remains for users; org creation only from Admin. |

## What Replaced It

| Need | Replacement |
|------|-------------|
| Master admin check | `is_master_admin()` — true if `user_roles` has row with `user_id = auth.uid()`, `role = 'admin'`, `organization_id IS NULL`. |
| Org creation | Only by master admin via `/admin` UI → Edge Function `admin-create-organization`. |
| Join organization | User enters SW-XXXX-XXXX → Edge `join-organization` → `organization_members` row with `status='pending'`. Org admin approves via `admin-review-membership`. |
| Tenant data access | RLS: user must be **active member** of org (`organization_members` with `status='active'`). Helpers: `is_active_member(p_org_id)`, `is_org_admin_member(p_org_id)` (role in admin/manager). |
| Org role (admin/manager/supervisor) | Source of truth: `organization_members.role`. `user_roles` kept in sync for active org (optional for compatibility); UI can read from `organization_members`. |
| Active organization | `profiles.organization_id` = user’s current org (nullable). Set on approval if null; user can switch via `set-active-organization` edge function if multiple memberships. |
| Admin UI | `/admin` — gated by `useIsMasterAdmin()`. Pages: organizations list, create org, org detail (join code, members, approve/block). |

## New Data Flows

1. **Master admin**  
   - Has `user_roles` row: `(user_id, NULL, 'admin')`.  
   - Can access `/admin`, create organizations, see all orgs and members, approve/block any membership.

2. **B2C user (no org)**  
   - `profiles.organization_id` NULL, no active `organization_members`.  
   - Can use non-tenant features; sees "Join Organization" (modal or page).  
   - Submits join code → pending membership → waits for org admin approval.

3. **Join flow**  
   - User calls `join-organization` with `joinCode` (SW-XXXX-XXXX).  
   - Backend inserts `organization_members` (user_id, organization_id, role='supervisor', status='pending').  
   - Org admin (active member with role admin/manager) sees pending list, calls `admin-review-membership` with action `approve` or `block`.  
   - On approve: trigger sets `profiles.organization_id` if null; optionally syncs `user_roles` for that org.

4. **Tenant dashboard**  
   - User has ≥1 active membership.  
   - `profile.organization_id` = current org (or null → prompt to choose / call set-active-organization).  
   - Role for that org from `organization_members.role`.  
   - RLS allows SELECT/INSERT/UPDATE/DELETE on business tables only where `is_active_member(organization_id)` (or master admin).

5. **Organization creation (admin only)**  
   - Master admin in `/admin` submits org name.  
   - Edge `admin-create-organization` creates `organizations` row (with `generate_join_code()`), creates `organization_members` for caller as admin/active, sets `profiles.organization_id` if null.  
   - Returns `organizationId`, `joinCode` for sharing.

---

## Phase 5 — Acceptance Test Plan

Run manually after deployment.

### A) B2C user (no org)
- [ ] Sign up / sign in.
- [ ] Access marketing and non-tenant pages.
- [ ] Open "Join Organization" (from onboarding or sidebar if in app after joining another org).
- [ ] Enter valid join code → request sent (pending).
- [ ] Cannot access `/app` until approved; cannot access `/admin`.

### B) Master admin
- [ ] `user_roles` has row with `role='admin'`, `organization_id IS NULL`.
- [ ] Can open `/admin`.
- [ ] Can create organization (name → get join code).
- [ ] Can see organizations list and org detail (join code, members).
- [ ] Can approve/block pending members (via User Management in tenant or admin view as needed).

### C) Join flow
- [ ] User submits join code → `organization_members` row created with `status='pending'`.
- [ ] Org admin sees pending request (e.g. Users → Pending join requests).
- [ ] Approve → membership `status='active'`; user’s `profiles.organization_id` set if null.
- [ ] User can access tenant dashboard; RLS blocks other orgs’ data.

### D) Multi-membership
- [ ] User has two active memberships.
- [ ] Can call `set-active-organization` (or UI) to switch `profiles.organization_id`.
- [ ] Data views reflect active org.

### E) Regression
- [ ] No references to removed tables/functions in app code (platform_admins, get_org_entitlements, etc.).
- [ ] Migrations apply cleanly on a fresh DB.
- [ ] Removed Edge Functions are deleted; new ones deployed.
