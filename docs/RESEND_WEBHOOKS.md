
# Resend Webhooks Guide

This guide explains how to set up Resend webhooks for your application. Webhooks allow Resend to notify your application when email events occur (e.g., delivered, bounced, complained).

## 1. Why Use Webhooks?

Webhooks provide real-time updates about email delivery.
-   **Email Delivered:** Confirm that the user's email was successfully received.
-   **Email Bounced:** Know immediately if an email address is invalid so you can flag the user or stop sending to them (protecting your sender reputation).
-   **Email Complained:** If a user marks your email as spam, you **must** stop sending to them immediately to avoid being blacklisted.

## 2. Required Webhooks

For a robust application, you should handle at least these three events:

1.  **Email Bounced** (Critical): To detect invalid emails.
2.  **Email Complained** (Critical): To detect spam reports.
3.  **Email Delivered** (Recommended): To show delivery status to admins/users (e.g., "Verification email sent and delivered").

## 3. Implementation Steps

### Step A: Create the Webhook Handler (Supabase Edge Function)

You need an endpoint to receive the data from Resend. We will create a new Edge Function called `resend-webhook`.

1.  **Create the function:**
    Run this command in your terminal:
    ```bash
    supabase functions new resend-webhook
    ```
    *(Note: I can do this for you if you want).*

2.  **Code the function:**
    The function should verify the webhook signature (security best practice) and then update your database based on the event type.

    *Example Logic:*
    ```typescript
    // supabase/functions/resend-webhook/index.ts
    // ... imports ...

    serve(async (req) => {
      // 1. Verify Signature (Optional but recommended)
      // 2. Parse Event
      const payload = await req.json();
      const type = payload.type; // e.g., 'email.bounced'
      const email = payload.data.to[0];

      // 3. Update Database
      if (type === 'email.bounced' || type === 'email.complained') {
         // Mark user as 'invalid_email' or log in audit table
         await supabase.from('users').update({ status: 'bounced' }).eq('email', email);
      }
      
      return new Response('OK', { status: 200 });
    });
    ```

3.  **Deploy the function:**
    ```bash
    supabase functions deploy resend-webhook --no-verify-jwt
    ```
    *Note: We use `--no-verify-jwt` because Resend calls this endpoint directly, not a logged-in user.*

### Step B: Configure Resend Dashboard

Once you have your function URL (e.g., `https://[project-ref].supabase.co/functions/v1/resend-webhook`), go to Resend:

1.  Log in to your **Resend Dashboard**.
2.  Navigate to **Settings** -> **Webhooks**.
3.  Click **"Add Webhook"**.
4.  **Endpoint URL:** Paste your Supabase Function URL.
5.  **Events:** Select the events you want to track:
    *   [x] Email Delivered
    *   [x] Email Bounced
    *   [x] Email Complained
    *   [ ] Email Sent (Optional - usually redundant)
    *   [ ] Email Opened (Optional - requires tracking pixel)
    *   [ ] Email Clicked (Optional - requires link tracking)
6.  Click **"Add"**.

### Step C: Test

1.  Resend allows you to send test webhooks from the dashboard.
2.  Click "Test" on your new webhook and verify your Supabase function logs (or database updates).

---

## Do you want me to set up the `resend-webhook` Edge Function for you?
I can create the file with the necessary logic to log these events to your `audit_logs` table so you can see them in your Admin Panel.
