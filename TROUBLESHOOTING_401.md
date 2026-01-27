# Troubleshooting 401 Error - Complete Checklist

## The 401 error means "Unauthorized" - here's EVERYTHING to check:

### 1. ✅ Verify Edge Function is Deployed
- Go to Supabase Dashboard → Edge Functions
- Check if `create-user-v2` exists and shows "Active"
- If not deployed, deploy it now

### 2. ✅ Verify Your Admin Role
Run this SQL in Supabase SQL Editor:
```sql
SELECT 
  u.email,
  u.id as user_id,
  ur.role,
  p.name
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'admin@patidartravels.com';
```

**Expected Result:** Should show `role = 'admin'`

### 3. ✅ Verify You're Logged In
- Check browser console (F12) → Application → Local Storage
- Look for `sb-<project>-auth-token`
- If missing, log out and log back in

### 4. ✅ Check Edge Function Logs
- Supabase Dashboard → Edge Functions → `create-user-v2` → Logs
- Look for error messages when you try to create a user
- Check for "Token validation error" or "Role check error"

### 5. ✅ Verify Environment Variables
In your `.env` file (frontend):
```env
VITE_SUPABASE_URL=https://yusdopbnzalqduouewdw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**For Edge Functions:** Environment variables are auto-provided by Supabase (no .env needed)

### 6. ✅ Test Token Manually
Open browser console (F12) and run:
```javascript
const { data: { session } } = await supabase.auth.getSession();
console.log('Token:', session?.access_token ? 'Exists' : 'Missing');
console.log('User:', session?.user?.email);
console.log('Expires:', new Date(session?.expires_at * 1000));
```

### 7. ✅ Check Network Tab
- Open browser DevTools → Network tab
- Try creating a user
- Click on the `create-user-v2` request
- Check:
  - Request URL (should be correct)
  - Request Headers (should have `Authorization: Bearer <token>`)
  - Response (check the actual error message)

### 8. ✅ Verify Function URL
The function should be called at:
```
https://yusdopbnzalqduouewdw.supabase.co/functions/v1/create-user-v2
```

### 9. ✅ Quick Fix: Sign Out and Sign Back In
Sometimes tokens get stale:
1. Click Sign Out
2. Close browser completely
3. Reopen and Sign In as admin
4. Try creating user again

### 10. ✅ Last Resort: Check Function Code
Make sure the deployed function matches `supabase/functions/create-user-v2/index.ts`

## Most Common Causes:
1. **Function not deployed** → Deploy it
2. **Token expired** → Sign out/in
3. **Admin role not assigned** → Run the SQL query above
4. **Wrong function URL** → Check network tab

## Still Not Working?
Check the Edge Function logs in Supabase Dashboard - they will show the exact error!


