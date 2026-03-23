# Storage audit and R2 implementation plan

## STEP 1 — Audit: Current storage usage

### Files using Supabase Storage (all frontend)

| File | Domain | Operations | Notes |
|------|--------|------------|--------|
| **Settings.tsx** | organization-logos | `upload`, `getPublicUrl` | Logo path `${orgId}/${Date.now()}.${ext}`; stores full URL in `organizations.logo_url` |
| **use-drivers.ts** | driver-licenses | `upload` (uploadDriverFile), `remove` (×4 in update, ×1 in delete), `createSignedUrl` (useDownloadLicense) | Path: `{prefix}-{ts}-{random}.{ext}`; no subfolder by userId |
| **use-bills.ts** | bills | `upload` (useUploadBillPDF), `createSignedUrl` (useBillPDFUrl) | Path: `{billId}/{ts}-bill.pdf` |
| **use-company-bills.ts** | bills | `upload`, `createSignedUrl` (useCompanyBillPDFUrl) | Path: `company-bills/{billId}/{pdfFile.name}` |
| **use-service-bills.ts** | service-bills | `upload`, `remove` (useDeleteServiceBill) | Path: `{carId}/{serviceRecordId}/{ts}-{random}.{ext}` |
| **use-car-documents.ts** | car-documents | `upload`, `createSignedUrl` (useDocumentDownloadUrl) | Path: `{carId}/{documentType}-{ts}.{ext}`; useDeleteCarDocument does **not** delete from storage |
| **DocumentsSection.tsx** | car-documents | `createSignedUrl` (handleView, handleDownload) | Inline signed URL for view/download |
| **Drivers.tsx** | driver-licenses | `createSignedUrl` (openViewForPath, table view callback) | View document in modal |
| **BillingManagement.tsx** | bills | `getPublicUrl` | Fetches PDF by public URL for WhatsApp; **should use signed URL** for private bills |
| **VehicleReport.tsx** | service-bills | `createSignedUrl` (handleViewBills, handleExportDetailed) | 1h and 24h expiry |

### Storage domains summary

- **organization-logos** — Settings only; public URL for `img` src.
- **bills** — use-bills, use-company-bills, BillingManagement; mix of upload/signed/public (BillingManagement uses public).
- **driver-licenses** — use-drivers, Drivers.tsx; upload, remove, signed.
- **car-documents** — use-car-documents, DocumentsSection; upload, signed (no remove in current flow).
- **service-bills** — use-service-bills, VehicleReport; upload, remove, signed.

### DB columns (paths/URLs)

- `organizations.logo_url` — full public URL
- `bills.pdf_file_path`, `pdf_file_name`
- `company_bills.pdf_file_path`, `pdf_file_name`
- `drivers`: `license_file_path`, `aadhaar_file_path`, `police_verification_file_path`, `health_certificate_file_path` (+ `_file_name`)
- `car_documents.file_path`, `file_name`
- `service_bill_files.file_path`, `file_name`, `file_size`, `file_type`

### Env today

- **Frontend:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client.ts, functions-invoke.ts). No R2 vars in frontend.
- **Backend:** None for storage; Edge Functions use `Deno.env.get(...)` for Supabase and third-party keys.
- **test-r2.js:** Uses `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET` (dotenv).

---

## STEP 2 — Implementation plan

### Architecture

- **Single bucket:** `app-uploads` (existing).
- **Prefixes (object key prefixes):** `organization-logos/`, `bills/`, `driver-licenses/`, `car-documents/`, `service-bills/`.
- **Backend:** New Supabase Edge Function(s) that use R2 (S3-compatible) with credentials from Edge Function secrets. No R2 secrets in frontend.
- **Client:** One storage abstraction that calls Edge Functions for upload, delete, getSignedUrl; optionally getPublicUrl for logos (env-based public base URL).

### Affected files

| Area | Files |
|------|--------|
| New | `src/lib/storage.ts` (abstraction), `src/lib/storage-keys.ts` (key builders), `supabase/functions/storage-r2/index.ts` (upload/delete/signedUrl) |
| Hooks | `use-bills.ts`, `use-company-bills.ts`, `use-drivers.ts`, `use-service-bills.ts`, `use-car-documents.ts` |
| Pages | `Settings.tsx`, `BillingManagement.tsx`, `Drivers.tsx`, `VehicleReport.tsx` |
| Components | `DocumentsSection.tsx` |

### Abstraction API (client)

- `storage.upload(domain, key, file)` → returns key (or throws)
- `storage.remove(domain, keys: string[])` → void
- `storage.getSignedUrl(domain, key, expiresInSeconds)` → string
- `storage.getPublicUrl(domain, key)` → string (logos only; uses public base when set)

Key format: `{prefix}{domain-specific path}` e.g. `bills/{billId}/123-bill.pdf`. Key builders in `storage-keys.ts` by domain.

### Edge Function: `storage-r2`

- **Actions:** `upload` (body: key, content base64, contentType), `delete` (keys), `signedUrl` (key, expiresIn).
- **Auth:** Same as existing (Bearer JWT, validate with Supabase auth).
- **Env (secrets):** `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_BUCKET`; optional `CLOUDFLARE_ACCOUNT_ID` if needed for public URL.
- **Public URL for logos:** If we support public read for logos, R2 custom domain or `r2.dev` public URL; store in env as `R2_PUBLIC_BASE_URL` (or expose safe base to client via non-secret, e.g. response or separate config). Client can use `VITE_R2_PUBLIC_BASE_URL` for logo img src (no secrets).

### DB compatibility

- Store **object keys** (paths) in existing columns: `pdf_file_path`, `file_path`, `license_file_path`, etc. Same as today (paths, not full URLs).
- **organizations.logo_url:** Keep storing a value that resolves to a URL. New uploads: store key (e.g. `organization-logos/{orgId}/x.png`). Display: if value starts with `http`, use as-is (legacy); else use `VITE_R2_PUBLIC_BASE_URL + value` when set. No schema change.

### Private vs public

- **Private:** bills, driver-licenses, car-documents, service-bills → always use signed URLs from Edge Function; BillingManagement will use signed URL instead of getPublicUrl.
- **Public:** organization logos only; use public base URL when configured; otherwise can use short-lived signed URL for display.

### Key format (normalized)

- `organization-logos/{orgId}/{timestamp}.{ext}`
- `bills/{billId}/{timestamp}-bill.pdf` or `bills/company-bills/{billId}/{name}`
- `driver-licenses/{prefix}-{ts}-{random}.{ext}` (single prefix segment, no user subfolder)
- `car-documents/{carId}/{documentType}-{timestamp}.{ext}`
- `service-bills/{carId}/{serviceRecordId}/{timestamp}-{random}.{ext}`

Implement key builders in one place; hooks/pages pass domain + minimal args and get back key.

---

## Env vars (implementation)

**Edge Function secrets (Supabase Dashboard → Project → Edge Functions → storage-r2 → Secrets):**

- `CLOUDFLARE_R2_ACCESS_KEY_ID` — R2 API token access key
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY` — R2 API token secret
- `CLOUDFLARE_R2_ENDPOINT` — S3-compatible endpoint (e.g. `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)
- `CLOUDFLARE_R2_BUCKET` — bucket name (`app-uploads`)

**Optional:**

- `CLOUDFLARE_ACCOUNT_ID` — only if needed for custom public URL construction (not used by default)

**Client (no secrets):**

- `VITE_R2_PUBLIC_BASE_URL` — optional; public base URL for organization logos (e.g. R2 public bucket or custom domain). If unset, logos use signed URLs.
