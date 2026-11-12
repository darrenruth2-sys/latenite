# Email templates

Supabase → Authentication → Emails → Templates. For each one, paste the subject and the whole file into "Message body (HTML)".

| Supabase template | Subject | File |
|---|---|---|
| Confirm signup | Confirm your SignedOn page ✨ | `confirm-signup.html` |
| Reset password | Reset your SignedOn password | `reset-password.html` |
| Change email address | Confirm your new SignedOn email | `change-email.html` |

The logo loads from `{{ .SiteURL }}/brand/signedon-logo.png`, so set Site URL to https://signedon.social first.
