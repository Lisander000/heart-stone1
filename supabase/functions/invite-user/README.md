# invite-user (optional)

> The app works **without** this function: the Team page adds a member with a
> passwordless magic link (`signInWithOtp` + `shouldCreateUser`) that provisions the
> account and emails a login link — no deployment needed.
>
> This edge function is an **optional, more locked-down alternative**: it creates the
> account server-side with the service-role key, enforces a server-side super-admin
> allowlist, and sends Supabase's built-in **invite email** instead of a magic link.
> If you deploy it, switch the Team invite call back to
> `supabase.functions.invoke("invite-user", { body: { name, email } })`.

Either way the invited person lands on `/auth`, is forced to set their own password
(`must_change_password`), then does the normal MFA setup.

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
