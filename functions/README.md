# Brief intake function

One HTTPS function (`brief`, europe-west1) behind the contact form. Leads land
in Firestore `briefs`; a mirror doc in `mail` feeds the Trigger Email
extension so the brief also arrives by email.

## Deploy

```bash
cd functions && npm install && cd ..
firebase deploy --only functions
```

Deploy prints the URL, shaped like:
`https://brief-<hash>-ew.a.run.app`

Then wire the site to it:

1. Set `VITE_FORM_ENDPOINT=<that url>` in the build step of
   `.github/workflows/deploy.yml` (without it the form keeps its mailto
   fallback — nothing breaks).
2. Optional email delivery: install the **Trigger Email** extension
   (`firebase ext:install firebase/firestore-send-email`), collection `mail`,
   with the studio's SMTP credentials. Without it leads are still in
   Firestore → console.
3. Destination override: set `BRIEF_TO` env on the function (defaults to
   `hello@204.ai`).
4. reCAPTCHA Enterprise: `RECAPTCHA_SITE_KEY` in `functions/.env` (public
   key, no secret anywhere). The function's runtime service account needs
   the assessments role once:

   ```bash
   gcloud projects add-iam-policy-binding studio204-web \
     --member="serviceAccount:$(gcloud projects describe studio204-web --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
     --role=roles/recaptchaenterprise.agent
   ```

## Abuse / billing posture

- `maxInstances: 1` — hard ceiling on compute scale-out.
- Origin allowlist (github.io, *.web.app, localhost) — browsers elsewhere get 403.
- Honeypot field (`website`) — filled → dropped with fake success.
- Rate limits: 5/hour per IP, 200/day total (in-memory; instance restart
  resets them, fine at this scale).
- Payload cap 8KB, string-typed fields only, email format required.

- reCAPTCHA Enterprise assessment server-side (score ≥ 0.5, action `brief`,
  fail closed). Rate limits cap assessments at ~6k/month — inside the 10k
  free tier.

Worst realistic flood: bounded by 200 writes/day → pennies.

When this goes live, amend SPEC C8 (`/ck:spec`) — it currently says "no
backend".
