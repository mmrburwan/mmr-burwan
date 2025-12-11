# Admin Management Guide

## Current Admin Setup

**Admin Email**: `tariqmir1278@gmail.com`  
**Admin ID**: `bb574cab-cf70-4720-8c5b-3be192607042`

The admin role is stored in `auth.users.raw_user_meta_data->>'role'` in Supabase.

---

## Can We Have Multiple Admins?

**Yes.** There are no constraints limiting the number of admins. You can have multiple admins simultaneously.

---

## How to Add a New Admin

1. **Open Supabase Dashboard** → SQL Editor
2. **Run this query** (replace email with the new admin's email):

```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'newadmin@example.com';
```

3. **Verify** the update:

```sql
SELECT 
  email,
  raw_user_meta_data->>'role' as role,
  created_at
FROM auth.users
WHERE email = 'newadmin@example.com';
```

**Note**: The user must already exist in `auth.users` (they must have registered/logged in at least once).

---

## How to Remove Admin Access

**Remove admin role** (user becomes regular client):

```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"client"'
)
WHERE email = 'admin@example.com';
```

**Or remove role field entirely**:

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'role'
WHERE email = 'admin@example.com';
```

---

## List All Current Admins

```sql
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  created_at
FROM auth.users
WHERE raw_user_meta_data->>'role' = 'admin';
```

---

## Important Notes

- Admin role is checked via `user?.role !== 'admin'` in `ProtectedAdminRoute`
- Role is read from `auth.users.raw_user_meta_data->>'role'`
- User must have a confirmed email (`email_confirmed_at` is not null) to log in
- No database constraints prevent multiple admins
- Admin changes take effect immediately (user may need to refresh/re-login)

---

## Quick Reference

| Action | SQL Query |
|--------|-----------|
| **Add Admin** | `UPDATE auth.users SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', '"admin"') WHERE email = 'email@example.com';` |
| **Remove Admin** | `UPDATE auth.users SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', '"client"') WHERE email = 'email@example.com';` |
| **List Admins** | `SELECT id, email, raw_user_meta_data->>'role' as role FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin';` |

