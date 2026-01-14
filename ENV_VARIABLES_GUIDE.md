# Environment Variables Guide

## For Frontend (React App) - Add to `.env` file

Create a `.env` file in the root of your project with:

```env
VITE_SUPABASE_URL=https://yusdopbnzalqduouewdw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key-here
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to find these:**
1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** > **API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_ANON_KEY`

## For Edge Functions - NO .env file needed!

**Important:** Edge Functions get environment variables automatically from Supabase when deployed.

When you deploy an edge function, Supabase automatically provides:
- `SUPABASE_URL` - Your project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key

**You don't need to add these to any .env file!**

### If you want to test Edge Functions locally:

Use Supabase CLI to set secrets:

```bash
# Set secrets for local development
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Where to find Service Role Key:**
1. Go to Supabase Dashboard
2. Settings > API
3. Copy the **service_role** key (keep this secret!)

## Summary

| Variable | Where Used | Where to Get | Add to .env? |
|----------|------------|--------------|--------------|
| `VITE_SUPABASE_URL` | Frontend | Settings > API > Project URL | ✅ Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Settings > API > anon/public key | ✅ Yes |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Settings > API > anon/public key | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Settings > API > service_role key | ❌ No (auto-provided) |
| `SUPABASE_URL` | Edge Functions | Settings > API > Project URL | ❌ No (auto-provided) |

## Security Warning

⚠️ **NEVER** add `SUPABASE_SERVICE_ROLE_KEY` to your frontend `.env` file!
- The service role key bypasses Row Level Security
- It should only be used in Edge Functions (backend)
- If exposed in frontend, anyone can access your entire database

