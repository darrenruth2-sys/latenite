/** Server-side: the Turnstile token the Captcha widget added to the form, if any (forwarded to Supabase Auth). */
export function captchaFrom(form: FormData) {
  const t = form.get('cf-turnstile-response');
  return typeof t === 'string' && t ? t : undefined;
}
