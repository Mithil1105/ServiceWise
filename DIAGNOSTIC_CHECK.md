# 🔍 COMPLETE DIAGNOSTIC CHECKLIST

## Step 1: Verify Admin Role (CRITICAL)
Run this SQL in Supabase SQL Editor:
```sql
SELECT 
  u.email,
  u.id,
  ur.role,
  p.name
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id  
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'admin@patidartravels.com';
```

**MUST SHOW:** `role = 'admin'`

## Step 2: Check Browser Console
Open DevTools (F12) → Console tab, then run:
```javascript
const { data: { session } } = await supabase.auth.getSession();
console.log('Session exists:', !!session);
console.log('User email:', session?.user?.email);
console.log('Token exists:', !!session?.access_token);
console.log('Token length:', session?.access_token?.length);
```

## Step 3: Check Network Request
1. Open DevTools → Network tab
2. Try creating a user
3. Find the `create-user-v3` request
4. Check:
   - **Status Code:** Should be 200, not 401
   - **Request Headers:** Must have `Authorization: Bearer <long-token>`
   - **Response:** Click "Response" tab to see actual error

## Step 4: Check Edge Function Logs
1. Supabase Dashboard → Edge Functions → `create-user-v3`
2. Click "Logs" tab
3. Try creating a user
4. Look for:
   - "Authenticated user: <id> <email>"
   - Any error messages

## Step 5: Deploy the New Function
**CRITICAL:** Deploy `create-user-v3`:
1. Supabase Dashboard → Edge Functions
2. Create new function: `create-user-v3`
3. Copy code from `supabase/functions/create-user-v3/index.ts`
4. Deploy

## Step 6: Test Token Manually
In browser console:
```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

// Test the token directly
fetch('https://yusdopbnzalqduouewdw.supabase.co/auth/v1/user', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'apikey': '<your-anon-key>'
  }
}).then(r => r.json()).then(console.log);
```

## Common Issues & Fixes:

### Issue: "Invalid or expired token"
**Fix:** Sign out completely, close browser, reopen, sign back in

### Issue: "Admin access required"  
**Fix:** Run the SQL query in Step 1, ensure admin role exists

### Issue: Function returns 404
**Fix:** Function not deployed - deploy it!

### Issue: CORS error
**Fix:** Check function has CORS headers (it does in the code)

## The New Function (create-user-v3) Uses:
- Direct Auth API call instead of getUser() - more reliable
- Better error messages
- Simpler code flow

**DEPLOY THIS ONE AND TRY AGAIN!**


