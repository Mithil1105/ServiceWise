# Connect Supabase CLI

Use these steps to connect the Supabase CLI to your Supabase account and link this repo to your remote project.

**Requirement:** Node.js 20+ (CLI uses it when run via `npx` or `npm run supabase`).

---

## 1. Install the CLI (optional)

The project has `supabase` as a dev dependency. From the project root:

```bash
npm install
```

Then use either:

- **Via npm script:** `npm run supabase -- <command>`
- **Via npx:** `npx supabase <command>`

---

## 2. Log in to Supabase

1. Open **[Supabase Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens)**.
2. Create a new token (e.g. "CLI") and copy it.
3. In the project root run:

   ```bash
   npx supabase login
   ```

4. When prompted, paste your access token.  
   Or run with the token directly:

   ```bash
   npx supabase login --token "YOUR_ACCESS_TOKEN"
   ```

You should see: `Finished supabase login.`

---

## 3. Get your project reference

Your **project ref** is the ID in your Supabase URL:

- URL: `https://abcdefghijk.supabase.co` → **project ref** = `abcdefghijk`
- You can also find it in **Dashboard → Project Settings → General**.

---

## 4. Link this project to your remote Supabase project

From the project root:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

Example:

```bash
npx supabase link --project-ref abcdefghijk
```

When prompted, enter your **database password** (Dashboard → Project Settings → Database → Database password). You can leave it blank to skip saving the DB password; some commands (e.g. `db push`, `db pull`) will ask for it when needed.

You should see: `Finished supabase link.`

---

## 5. Useful commands after linking

| Command | Description |
|--------|-------------|
| `npx supabase db push` | Push local migrations to the remote database |
| `npx supabase db pull` | Pull remote schema into a new migration |
| `npx supabase migration list` | List migration status (local vs remote) |
| `npx supabase functions deploy` | Deploy Edge Functions |
| `npx supabase gen types typescript --linked` | Generate TypeScript types from linked DB |

---

## Troubleshooting

- **"Invalid API key" / 401:** Run `npx supabase login` again with a valid token.
- **"Project not found":** Check the project ref and that the token has access to that project.
- **Database password:** If you skipped it during `link`, set `SUPABASE_DB_PASSWORD` when running `db push` / `db pull`, or run `npx supabase link --project-ref YOUR_REF` again and enter the password.
