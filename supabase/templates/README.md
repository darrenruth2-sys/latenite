# Email templates

Supabase → Authentication → Emails → Templates. For each one, paste the subject and the whole file into "Message body (HTML)".

| Supabase template | Subject | File |
|---|---|---|
| Confirm signup | Confirm your LateNite page ✨ | `confirm-signup.html` |
| Reset password | Reset your LateNite password | `reset-password.html` |
| Change email address | Confirm your new LateNite email | `change-email.html` |

The logo loads from `{{ .SiteURL }}/brand/latenite-logo.png`, so set Site URL to https://latenite.social first.
