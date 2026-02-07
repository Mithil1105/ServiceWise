# Edge Function 401 Unauthorized – Issue and Solutions (Detailed)

## 0. Why we do NOT use “Admin API from browser with service role key”

Some setups create users by calling `auth/v1/admin/users` from the **browser** with `VITE_SUPABASE_SERVICE_ROLE_KEY`. That is **insecure** in production:

- Anything in `VITE_*` is bundled and visible in the client (DevTools, source maps).
- The **service role key** bypasses RLS and has full access to Auth and the database. Exposing it in the frontend would allow anyone to create/delete users, read all data, etc.

**Correct approach:** Keep the service role key **only** in server-side env (e.g. Supabase Edge Function secrets). The browser sends the **user’s JWT** (Bearer token). An **Edge Function** verifies the user is an org admin, then uses the **service role** to create the user or reset the password. That way the service role never leaves the server.

**Applied fix:** The Supabase **client** in `src/integrations/supabase/client.ts` is now created with the **anon key** (JWT), not the publishable key, so the JWTs from login/refresh are valid when Edge Functions validate them. Create-user and reset-password still go through **Edge Functions** (`org-admin-create-user`, `org-admin-reset-password`); they do not call the Admin API from the browser.

---

## 1. The issue

When a **logged-in user** on the **Onboarding** page (Welcome to ServiceWise) does either of:

- **Join your company** (submit org code) → calls `org-join-by-code` Edge Function  
- **Create a free trial workspace** (submit org name) → calls `org-create-trial` Edge Function  

the browser receives **HTTP 401 Unauthorized** and the UI shows:

- “Could not join” / “Join failed”, or  
- “Could not create workspace” / “Create failed”  

The **Network** tab shows the request to  
`https://<project-ref>.supabase.co/functions/v1/org-create-trial` (or `org-join-by-code`)  
returning **401**.  

So the failure is at the **Edge Function** layer (either at the Supabase gateway or inside the function).

---

## 2. Request flow (end-to-end)

### 2.1 Client (Onboarding page)

1. User clicks “Join organization” or “Create trial organization”.
2. Code calls `getEdgeFunctionAuth()` which:
   - Calls `supabase.auth.refreshSession()`.
   - Reads `session.access_token` (and `supabaseUrl`, `anonKey` from env).
3. A `fetch()` is sent to:
   - **URL:** `VITE_SUPABASE_URL + '/functions/v1/org-create-trial'` (or `org-join-by-code`).
   - **Headers:**
     - `Authorization: Bearer <access_token>`
     - `apikey: <VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY>`
     - `Content-Type: application/json`
   - **Body:** JSON (e.g. `{ orgName: "..." }` or `{ orgCode: "..." }`).

### 2.2 Supabase Edge Function gateway

- Request hits `https://<project>.supabase.co/functions/v1/<function-name>`.
- Supabase may validate the **`apikey`** header (must match the project’s **anon** key).
- If validation fails here → gateway can return **401** before your function runs.
- If it passes → request is forwarded to your function with the same headers.

### 2.3 Your Edge Function (e.g. `org-create-trial/index.ts`)

1. Reads `Authorization` header; if missing or not `Bearer <token>` → returns **401** “Missing or invalid authorization header”.
2. Calls Supabase Auth API to validate the user’s JWT:
   - `GET ${supabaseUrl}/auth/v1/user`
   - Headers: `Authorization: Bearer <user_jwt>`, `apikey: <SUPABASE_SERVICE_ROLE_KEY>` (service role, not anon).
3. If `auth/v1/user` returns non-OK (e.g. invalid/expired JWT) → function returns **401** “Invalid or expired token”.
4. If response has no `id` → returns **401** “User data not found”.

So a **401** can come from:

- **A)** Supabase Edge gateway (wrong/missing `apikey` from client).  
- **B)** Your function: missing/invalid `Authorization` header.  
- **C)** Your function: Auth API rejects the Bearer token (invalid/expired/wrong project).  
- **D)** Your function: Auth API returns OK but no user `id`.

---

## 3. What is already implemented (current “solutions”)

### 3.1 Shared auth helper: `src/lib/edge-function-auth.ts`

- **Purpose:** Provide a valid Bearer token and correct URL/anon key for Edge Function calls.
- **Behaviour:**
  - Calls `supabase.auth.refreshSession()` so the token is up to date.
  - Gets `session.access_token` from refreshed or current session.
  - Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (fallback: `VITE_SUPABASE_PUBLISHABLE_KEY`).
  - Returns `{ token, supabaseUrl, anonKey }`.
  - Throws if session is missing, refresh fails, or URL/anon key is missing.

### 3.2 Onboarding page: `src/pages/Onboarding.tsx`

- **Join:** Before calling `org-join-by-code`, it calls `getEdgeFunctionAuth()` and uses returned `token`, `supabaseUrl`, and `anonKey` in the `fetch()` (Bearer + apikey).
- **Create trial:** Same for `org-create-trial`.

So in theory:

- Token is refreshed before each call.
- `apikey` is set from env (anon or publishable key).
- URL is taken from env.

---

## 4. Why 401 can still happen (root causes)

### 4.1 Wrong key used for `apikey` (gateway or Auth behaviour)

- Supabase Edge Functions expect the **project anon key** in the `apikey` header when invoking from the browser. That key is the **JWT** (starts with `eyJ...`) from Dashboard → Settings → API → “anon public”.
- Your `.env` has:
  - `VITE_SUPABASE_ANON_KEY` = JWT (`eyJ...`) → **correct for Edge Functions.**
  - `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_2_...` → **not** the anon JWT.
- `edge-function-auth.ts` uses:
  - `ANON_KEY = VITE_SUPABASE_ANON_KEY || VITE_SUPABASE_PUBLISHABLE_KEY`.
- So if `VITE_SUPABASE_ANON_KEY` is set (as in your `.env`), the **correct** key is sent. If for any reason the build or runtime didn’t pick it up (e.g. typo, different env file), the fallback would send `sb_publishable_2_...`, which can cause the **gateway** to return 401.

### 4.2 Supabase client created with the wrong key (session/JWT validity)

- **Current:** `src/integrations/supabase/client.ts` creates the client with:
  - `createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ...)`
  - i.e. **`VITE_SUPABASE_PUBLISHABLE_KEY`** (`sb_publishable_2_...`).
- **Supabase Auth** (and most Supabase client docs) assume the second argument is the **anon key** (the JWT). If “publishable” in your project is a different key:
  - Login/signup might still work (Supabase might accept it for auth).
  - But the **JWT** stored in `session.access_token` might be issued or signed in a way that the **Auth API** (called from the Edge Function with service role) does not accept, leading to **401** when the function calls `auth/v1/user`.
- So: **mismatch** between “key used to create the client / issue the JWT” and “key the Auth API expects” can cause 401 inside the function even if the client “seems” to work on the front end.

### 4.3 Token actually expired or invalid

- If `refreshSession()` fails or returns no session (e.g. refresh token expired, network error, wrong client key), `getEdgeFunctionAuth()` throws. So we’d see “Session expired. Please log in again.” in the UI, not necessarily a 401 from the function.
- If refresh **succeeds** but the token we send is still invalid (e.g. wrong project, key mismatch, or clock skew), then the Edge Function’s call to `auth/v1/user` can return non-OK and the function returns **401**.

### 4.4 Environment variables not available at runtime

- In Vite, only variables prefixed with `VITE_` are exposed to the client. If you run with a different env file or build, `VITE_SUPABASE_ANON_KEY` might be missing, so `ANON_KEY` could fall back to `VITE_SUPABASE_PUBLISHABLE_KEY` or `''`, both of which can lead to 401 (gateway or Auth).

### 4.5 CORS / preflight

- Unauthorized is 401; CORS issues usually show as network errors or CORS errors in the console, not 401. So CORS is less likely the cause of this specific 401, but if you ever see 401 only in browser and not in curl/Postman, it’s worth keeping in mind.

---

## 5. Summary table: where 401 can come from

| Layer | Cause | Fix direction |
|-------|--------|----------------|
| Edge gateway | Wrong or missing `apikey` (e.g. publishable instead of anon) | Ensure client sends anon JWT in `apikey`; ensure `VITE_SUPABASE_ANON_KEY` is set and used. |
| Edge function (our code) | Missing/invalid `Authorization` header | Ensure `getEdgeFunctionAuth()` runs and we attach `Authorization: Bearer <token>`. |
| Edge function (our code) | Auth API rejects token (invalid/expired/wrong project) | Use same anon key for Supabase client and for Edge `apikey`; ensure client uses anon key so JWT is valid for this project. |
| Edge function (our code) | Auth API returns no user `id` | Rare; fix Auth API or response handling if needed. |

---

## 6. Recommended solutions (in order of impact)

### Solution A: Use the anon key for the Supabase client (high impact)

- **File:** `src/integrations/supabase/client.ts`
- **Change:** Create the client with the **anon key** (JWT), not the publishable key, so that all auth tokens (including after `refreshSession()`) are valid for the same project and for `auth/v1/user` when the Edge Function validates them.

Example:

```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

- **Why:** Aligns “who issued the JWT” (client using anon key) with “who validates it” (Auth API in the same project). Reduces key-mismatch 401s.

### Solution B: Ensure Edge Function calls always use the anon key (already aimed for, verify in practice)

- **File:** `src/lib/edge-function-auth.ts`
- **Current:** Uses `VITE_SUPABASE_ANON_KEY || VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Check:** In your deployed app, confirm that the **request** sent to the Edge Function has `apikey` = the **anon JWT** (e.g. in Network tab → request headers). If you see `sb_publishable_2_...` there, then either `VITE_SUPABASE_ANON_KEY` is not set in the build or something is overriding it. Fix env/build so that the anon JWT is what’s sent.

### Solution C: Use Supabase client’s `functions.invoke()` (alternative approach)

- Instead of manual `fetch()` with Bearer + apikey, use the Supabase client’s built-in method so it attaches the current session and project key for you:

```ts
const { data, error } = await supabase.functions.invoke('org-create-trial', {
  body: { orgName: name },
});
```

- **Pros:** No need to manage token refresh or apikey yourself; client handles auth.  
- **Cons:** You must ensure the client is created with the correct anon key (Solution A). If the client is wrong, this will still 401.

### Solution D: Add minimal client-side logging (debug only)

- In `Onboarding.tsx`, before `fetch()`, log (only in development):
  - Whether `token` is non-empty and length (e.g. first 20 chars).
  - Whether `anonKey` starts with `eyJ` (JWT) or `sb_publishable_` (publishable).
  - `supabaseUrl`.
- This helps confirm that the right env vars are available and that we’re not sending the publishable key as `apikey`.

### Solution E: Edge Function: clearer 401 response body (debug only)

- In `org-create-trial` and `org-join-by-code`, when returning 401, include a short reason in the JSON body (e.g. `"reason": "auth_api_rejected"` vs `"reason": "missing_auth_header"`). Do **not** expose internal details in production; use only for debugging. This helps distinguish “gateway 401” (no body from our code) vs “our function 401” and which branch.

---

## 7. Quick checklist for you

1. **Dashboard:** Supabase → Settings → API. Copy the **anon public** key (the long JWT). It should match `VITE_SUPABASE_ANON_KEY` in `.env`.
2. **Client:** Ensure `client.ts` uses the **anon** key (JWT) for `createClient` (Solution A).
3. **Build:** Restart dev server / rebuild after changing `.env` or `client.ts` so the correct keys are used.
4. **Network:** In browser DevTools → Network, click the failing `org-create-trial` (or `org-join-by-code`) request. Check:
   - Request URL (correct project and path).
   - Request headers: `Authorization: Bearer <long string>`, `apikey: eyJ...` (JWT). If `apikey` is `sb_publishable_2_...`, the wrong key is being sent.
5. **Session:** After login, try “Create trial” immediately. If it works after fresh login but fails after a while, token expiry/refresh might be involved (less likely if Solution A is in place and refresh is used).

---

## 8. Files involved (reference)

| File | Role |
|------|------|
| `src/lib/edge-function-auth.ts` | Refreshes session; returns `token`, `supabaseUrl`, `anonKey` for Edge calls. |
| `src/pages/Onboarding.tsx` | Calls `getEdgeFunctionAuth()` then `fetch()` to `org-join-by-code` and `org-create-trial`. |
| `src/integrations/supabase/client.ts` | Creates Supabase client; **currently uses PUBLISHABLE_KEY**; should use anon JWT for auth to match Edge. |
| `supabase/functions/org-create-trial/index.ts` | Validates Bearer token via `auth/v1/user`; returns 401 on missing header or invalid token. |
| `supabase/functions/org-join-by-code/index.ts` | Same as above. |
| `.env` | `VITE_SUPABASE_ANON_KEY` (JWT), `VITE_SUPABASE_PUBLISHABLE_KEY` (sb_publishable_2_...), `VITE_SUPABASE_URL`. |

---

Once you’ve tried Solution A (and optionally B/C and the checklist), you can share what you see (e.g. Network request headers, any new error message from the function), and we can narrow down the exact fix (e.g. only client key, or env, or something else).
