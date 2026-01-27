# How to Deploy the Create-User Edge Function

## The Issue
The 401 error occurs because the edge function isn't deployed yet. Supabase edge functions need to be deployed before they can be used.

## Environment Variables
**Good news:** Supabase automatically provides these environment variables when you deploy:
- `SUPABASE_URL` - Your project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (automatically injected)

You don't need to manually set these - Supabase handles it!

## Deployment Methods

### Method 1: Using Supabase Dashboard (Easiest)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Edge Functions** in the left sidebar
4. Click **Create a new function** or find `create-user` if it exists
5. Copy the code from `supabase/functions/create-user/index.ts`
6. Paste it into the editor
7. Click **Deploy**

### Method 2: Using Supabase CLI (Recommended)

1. Install Supabase CLI if you haven't:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref yusdopbnzalqduouewdw
   ```

4. Deploy the function:
   ```bash
   supabase functions deploy create-user
   ```

### Method 3: Using GitHub Actions (If configured)

If you have CI/CD set up, pushing to your repo will auto-deploy.

## Verify Deployment

After deploying, test the function:
1. Go to Edge Functions in Supabase Dashboard
2. Click on `create-user`
3. Click "Invoke" tab
4. Test with sample data

## Troubleshooting

- **401 Error**: Function not deployed or wrong URL
- **403 Error**: User doesn't have admin role
- **500 Error**: Check function logs in Supabase Dashboard


