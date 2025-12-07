# Supabase Email Confirmation Setup Guide

## Issue
Users are not receiving confirmation emails after registration.

## Root Causes
1. Email confirmation may be disabled in Supabase Auth settings
2. SMTP server may not be configured
3. Site URL may not be set correctly
4. Redirect URLs may not be whitelisted

## Step-by-Step Fix

### 1. Enable Email Confirmation

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/lswamyafjbdpmnukbjld
2. Navigate to **Authentication** → **Providers**
3. Find the **Email** provider section
4. Ensure **"Enable email confirmations"** is **ON** (enabled by default on hosted projects)
5. If it's disabled, enable it and save

### 2. Configure Site URL

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to: `https://mmrburwan.com` (or your production domain)
3. This is the base URL where your app is hosted

### 3. Configure Redirect URLs

1. In the same **URL Configuration** page
2. Under **Redirect URLs**, add:
   - `https://mmrburwan.com/auth/magic-link`
   - `https://mmrburwan.com/**` (wildcard for all auth routes)
   - If testing locally: `http://localhost:3000/auth/magic-link`

### 4. Configure SMTP (IMPORTANT for Production)

The default Supabase SMTP has rate limits (4 emails/hour). For production, you need custom SMTP.

#### Option A: Use Supabase Default SMTP (Testing Only)
- Works out of the box but has strict rate limits
- Good for development/testing only

#### Option B: Configure Custom SMTP (Recommended for Production)

1. Go to **Project Settings** → **Auth** → **SMTP Settings**
2. Configure your SMTP provider (recommended: AWS SES, SendGrid, Resend, or Postmark)
3. Enter your SMTP credentials:
   - **SMTP Host**: (e.g., `email-smtp.us-east-1.amazonaws.com` for AWS SES)
   - **SMTP Port**: (usually `587` for TLS or `465` for SSL)
   - **SMTP User**: Your SMTP username
   - **SMTP Password**: Your SMTP password
   - **Sender Email**: The email address that will send confirmation emails
   - **Sender Name**: (optional) Display name for emails

#### Recommended SMTP Providers:
- **AWS SES**: Very cheap, reliable, easy to set up
- **Resend**: Developer-friendly, good free tier
- **SendGrid**: Popular, good deliverability
- **Postmark**: Excellent for transactional emails

### 5. Verify Email Templates

1. Go to **Authentication** → **Email Templates**
2. Check the **"Confirm signup"** template
3. Ensure it contains the confirmation link: `{{ .ConfirmationURL }}`
4. The default template should work, but you can customize it

### 6. Test Email Sending

After configuration:
1. Try registering a new user
2. Check the email inbox (including spam folder)
3. Check Supabase logs: **Logs** → **Auth** to see if emails are being sent

## Troubleshooting

### Emails Still Not Sending?

1. **Check Rate Limits**: Default SMTP has 4 emails/hour limit
2. **Check Spam Folder**: Emails might be going to spam
3. **Check Logs**: Go to **Logs** → **Auth** in Supabase dashboard
4. **Verify SMTP Credentials**: Double-check all SMTP settings
5. **Test with Different Email**: Try a different email provider (Gmail, Outlook, etc.)

### Common Errors

- **"Email rate limit exceeded"**: Configure custom SMTP or wait
- **"Invalid redirect URL"**: Add the URL to Redirect URLs whitelist
- **"SMTP connection failed"**: Check SMTP credentials and firewall settings

## Quick Checklist

- [ ] Email confirmations enabled in Auth Providers
- [ ] Site URL set correctly
- [ ] Redirect URLs whitelisted
- [ ] SMTP configured (custom SMTP for production)
- [ ] Email templates configured
- [ ] Tested with a new registration

## Next Steps After Configuration

1. Test registration with a real email
2. Verify email is received
3. Click confirmation link
4. Verify user can log in after confirmation

