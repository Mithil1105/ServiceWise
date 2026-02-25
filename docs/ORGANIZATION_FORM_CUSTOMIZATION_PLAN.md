# Organization form customization – plan

## Goal
Every form in the app should be configurable per organization: make fields optional/required, hide fields, override labels, add custom fields, and control document uploads. All configuration lives in **Settings**, organized by section (Fleet, Bookings, etc.) and sub-section (e.g. “New car form”).

## Settings structure
- **Branding** – Logo, company name, T&C, bill prefix (already done)
- **Fleet** – New car form (this phase), later: edit car form, document types
- **Service rules** – (existing)
- **System / Min KM** – (existing)
- Later: Bookings, Drivers, Billing forms, etc.

## Phase 1 – Fleet → New car form

### 1. Data model
- **organization_settings.fleet_new_car_form_config** (JSONB, nullable)  
  - `fieldOverrides`: for each built-in field (vehicle_number, brand, model, …), optional `{ required?, hidden?, label? }`.
  - `customFields`: array of `{ id, key, label, type, required, order, options? }` (type: text | number | date | select).
  - `documentTypes`: for each doc type (rc, puc, insurance, …), optional `{ show?, required?, label? }`.
- **cars.custom_attributes** (JSONB, nullable) – stores values for org-defined custom fields (key → value).

### 2. Settings UI (Fleet section)
- New **Fleet** card (admin only).
- **New car form** sub-section:
  - **Built-in fields**: list/table with Field name, Label override (optional), Required (toggle), Show (toggle). Default labels from current FleetNew.
  - **Custom fields**: Add field (key, label, type, required, options for select), reorder, remove. Saved in config.
  - **Document types**: for RC, PUC, Insurance, Warranty, Permits, Fitness: Show (toggle), Required (toggle), Label override (optional).
- Save updates `organization_settings.fleet_new_car_form_config`.

### 3. FleetNew.tsx behaviour
- Load org’s `fleet_new_car_form_config` (default: all fields required, all doc types shown, current labels).
- **Built-in fields**: if `hidden` → don’t render. If `required` is set → use it for validation; else default. If `label` set → use it.
- **Custom fields**: render in `order`; validate and collect values; on submit send as `custom_attributes` on the car.
- **Documents**: only show doc types where `show !== false`. Mark required from config. Use label override if set.
- Schema: build Zod (or validation) dynamically from config so required/optional and custom fields are enforced.

### 4. Backend
- Migration: add `organization_settings.fleet_new_car_form_config`, `cars.custom_attributes`.
- useCreateCar: include `custom_attributes` in cars insert when present.
- useOrganizationSettings / useUpdateOrganizationSettings: read/write `fleet_new_car_form_config`.

## Later phases (not in this implementation)
- **Fleet edit form** – same config or separate; reuse same field keys and custom_attributes.
- **Other forms** – Drivers (new/edit), Bookings, etc.: same pattern (form config JSONB per form, optional custom_attributes or form-specific storage).
- **Custom document types** – would require car_documents to allow custom type keys or a separate table; can be added later.

## File touch list (Phase 1)
- `supabase/migrations/YYYYMMDD_fleet_new_car_form_config.sql`
- `src/types/forms.ts` (or in existing types) – FleetNewCarFormConfig, etc.
- `src/hooks/use-organization-settings.ts` – extend for fleet_new_car_form_config
- `src/pages/Settings.tsx` – Fleet card + New car form editor
- `src/pages/FleetNew.tsx` – use config for fields, custom fields, documents
- `src/hooks/use-cars.ts` – useCreateCar accept and persist custom_attributes
