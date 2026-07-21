# Plates — Terms + Privacy Policy pages

Adds Terms of Service, Privacy Policy, and an acceptance flow for new users.

## What's included

**Two new public pages**
- `/terms` — Terms of Service (placeholder text I drafted, marked clearly as not legal advice)
- `/privacy` — Privacy Policy (also placeholder, mentions Clerk, Neon, Vercel, Google Maps, Stripe, OpenAI)

Both are server-rendered, accessible to anyone (including anonymous users), have proper SEO metadata, and match the app's design system.

**Blocking acceptance modal**
First time a signed-in user opens the app after the terms are updated (or their first-ever sign-in), a full-screen modal appears:
- "Welcome to Plates. Before you get started, please review and accept our Terms of Service and Privacy Policy."
- Two buttons that open /terms and /privacy in new tabs
- Checkbox: "I agree to the Plates Terms of Service and Privacy Policy."
- Continue button — disabled until checkbox is ticked
- Cannot be dismissed. Must accept to use the app.

**Legal tracking**
When a user accepts, we record `terms_accepted_at` (timestamp) and `terms_version` (which version they accepted). Bumping `CURRENT_TERMS_VERSION` in `lib/legal.ts` will force everyone to re-accept next time they open the app.

**Footer links**
- Anonymous view: Terms · Privacy · © Plates below "Sign in to order" prompt
- Discover screen: same footer below the "Are you a home cook?" card
- Profile screen: same footer at the bottom

## Files

- `lib/db.ts` — new columns `terms_accepted_at` + `terms_version`, `acceptTerms()` helper
- `lib/legal.ts` — NEW file, exports `CURRENT_TERMS_VERSION` constant
- `app/terms/page.tsx` — NEW Terms page
- `app/privacy/page.tsx` — NEW Privacy page
- `app/api/users/route.ts` — new `acceptTerms` action
- `app/page.tsx` — blocking modal + footer links + terms fields on User interface

## Install

1. Extract this zip.
2. Copy into your local repo, overwriting.
3. GitHub Desktop shows 4 modified files + 3 new folders.
4. Commit: `Add Terms of Service, Privacy Policy, and acceptance flow`
5. Push origin.

Schema migration runs on next app load. Existing users won't be logged out, but will need to accept terms next time they use the app.

## Bumping the terms later

To force re-acceptance after changing the docs:

1. Edit `/lib/legal.ts` — change `CURRENT_TERMS_VERSION` (e.g. from `'2026-07-21'` to `'2026-09-01'`)
2. Push. Every user's next visit shows the modal again.

Version comparison is simple: modal shows unless `user.terms_version === CURRENT_TERMS_VERSION`. Right now it's stricter — modal shows unless `terms_accepted_at != null`, so any old acceptance counts. If you want strict version matching, change `needsTermsAcceptance` in page.tsx to `user.terms_version !== CURRENT_TERMS_VERSION`.

## What to test

**As anonymous:**
1. Visit `/terms` — page loads, has yellow "placeholder notice" banner
2. Visit `/privacy` — same
3. Anonymous discover view has footer with Terms · Privacy · © links

**As new signed-in user:**
4. Sign up with a new email
5. Complete Clerk sign-up
6. Blocking modal appears immediately
7. Try to close it — you can't
8. Tap "Read Terms" — opens /terms in a new tab
9. Come back, check the box, tap Continue
10. Modal disappears. You're in the app normally.
11. Refresh page — modal does NOT reappear (already accepted)

**Existing users:**
12. If you have a user whose `terms_accepted_at` is NULL in the DB, they will see the modal on next visit

## Important placeholders to replace before real launch

- Company name (currently just "Plates")
- Physical address (not in current draft)
- Contact email (needs a real support@ address once you have one)
- Governing law jurisdiction (not specified)
- Data controller info (for GDPR)
- Age verification requirement enforcement (currently just claims users must be 18+)
- Cottage food law citation (should be specific to your state — mine mentions California AB 626)

## Legal disclaimer (yes, again)

The text I wrote is PLACEHOLDER text. Before you launch to real strangers:
1. Sign up for Termly (https://termly.io) or iubenda (~$10-20/month)
2. Their wizard generates ToS + Privacy that matches your actual features and jurisdiction
3. Copy their text into these two page files
4. Better: have a lawyer review

I'm not a lawyer. This code is a starting point, not compliance.
