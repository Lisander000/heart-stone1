# invite-user

Lets a super user create a login for a new team member. The frontend (Team page →
"Teamlid") calls this function with `{ name, email }`; it creates the account with the
service-role key and sends Supabase's built-in **invite email**. The person clicks the
link, lands on `/auth`, sets their own password (forced, `must_change_password`), then
does the normal MFA setup.

## Deploy

```bash
supabase functions deploy invite-user
```

## Configure

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. Set the rest:

```bash
supabase secrets set SITE_URL="https://your-app-url"
supabase secrets set SUPER_ADMINS="lisander@gooodboys.com"   # comma-separated allowlist
```

Also make sure an email sender is configured for the project (Supabase Auth → SMTP, or
the built-in email in dev) and that `SITE_URL` (and `/auth`) is in Auth → URL
Configuration → Redirect URLs.

## Notes

- The service-role key stays server-side — never ship it to the browser.
- `SUPER_ADMINS` is the server-side allowlist of who may invite (the client-side
  super-user list in `gb_super_users` is only for UI gating).
