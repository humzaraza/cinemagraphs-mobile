# Auth QA Matrix: PR 3a + PR 3b Deploy

Pre-deploy walkthrough checklist for the coupled web+mobile auth release.
Run this against a TestFlight build (or Expo Go pointed at production)
after merging both PRs but before broad rollout.

Each item lists the setup, action, and expected result. Tick the box on
pass; note any deviation in the "Findings" section at the bottom.

---

## Email auth

### [ ] 1. Email sign-in happy path

- **Pre**: existing verified account with known password.
- **Action**: open app → Continue with email → enter email + correct password → tap Sign in.
- **Expected**: navigates to main tabs (Explore). No error banner. No mount-restore loop.

### [ ] 2a. Email sign-in: wrong password

- **Pre**: existing verified account.
- **Action**: enter email + intentionally wrong password → tap Sign in.
- **Expected**: error banner reads "Invalid email or password". No navigation. No PII in error.

### [ ] 2b. Email sign-in: unknown email

- **Pre**: an email that is not registered.
- **Action**: enter unknown email + any password → tap Sign in.
- **Expected**: same error as 2a ("Invalid email or password"). Anti-enumeration: must not reveal whether the email exists.

### [ ] 2c. Email sign-in: empty fields

- **Pre**: signed-out state.
- **Action**: leave email or password empty → tap Sign in.
- **Expected**: tap is a no-op (button does nothing visibly). No error banner, no navigation. (PR 3d will improve this with disabled-button visual state and inline validation.)

### [ ] 2d. Email sign-in: unverified account

- **Pre**: register a fresh email but do NOT complete OTP verification.
- **Action**: try to sign in with the unverified email + correct password.
- **Expected**: error banner reads "Please verify your email before signing in".

---

## OTP signup flow

### [ ] 3. OTP verify happy path (new signup)

- **Pre**: signed-out, fresh email never used.
- **Action**: tap Create account → fill name/email/password (>= 8 chars) → tap Create account → check email inbox → enter the 6-digit code on the OTP screen → tap Verify.
- **Expected**:
  - OTP email arrives within ~1 minute.
  - Verify succeeds, navigates into onboarding flow (Eras screen).
  - Vercel logs show one `funnel_event` with `event: 'signup_complete'`, `properties.method: 'email'`, and the new userId.

### [ ] 4. OTP wrong code, lockout after 5

- **Pre**: a fresh registration, OTP email arrived but not yet entered.
- **Action**: enter a wrong 6-digit code → tap Verify → repeat with wrong codes 4 more times.
- **Expected**:
  - First 4 attempts: error reads "Invalid or expired code".
  - 5th attempt: error reads "Too many invalid attempts. Please request a new code."
  - Resending OTP works after lockout.

### [ ] 5. OTP resend

- **Pre**: registration complete, on OTP screen.
- **Action**: tap Resend.
- **Expected**: confirmation message appears, new email arrives, original code is invalidated.

---

## OAuth

### [ ] 6. Google sign-in (new account)

- **Pre**: signed-out, Google account not yet linked to Cinemagraphs.
- **Action**: tap Continue with Google → complete OAuth.
- **Expected**: navigates to onboarding (Eras). New user record created. No error.

### [ ] 7. Google sign-in (returning account)

- **Pre**: signed-out, Google account previously used.
- **Action**: tap Continue with Google → complete OAuth.
- **Expected**: navigates to main tabs. No onboarding shown again.

### [ ] 8. Apple sign-in (real iOS device, not simulator)

- **Pre**: signed-out on iOS device. Apple ID configured.
- **Action**: tap Continue with Apple → complete via FaceID/TouchID/passcode.
- **Expected**: navigates to onboarding (new) or main tabs (existing). For new accounts, the user record uses whatever email Apple returned (real or private relay).

### [ ] 9. Apple sign-in with "Hide My Email"

- **Pre**: signed-out on iOS, never used Cinemagraphs.
- **Action**: Continue with Apple → choose "Hide My Email" in the Apple sheet.
- **Expected**: signup completes. User email in DB is the @privaterelay.appleid.com forwarder. App functions normally.

---

## Password recovery

### [ ] 10. Forgot password happy path

- **Pre**: existing email/password account, signed out.
- **Action**: tap Forgot password? → enter email → tap Send reset link.
- **Expected**:
  - "Check your email for the reset link" success state.
  - Email arrives with a https://cinemagraphs.ca/auth/reset-password?token=... link.
  - Clicking the link opens a working reset page.
  - Setting a new password succeeds.
  - New password works for sign-in; old password is rejected.

### [ ] 11. Forgot password with unknown email

- **Pre**: an email never registered.
- **Action**: tap Forgot password? → enter unknown email → tap Send reset link.
- **Expected**: same success state as 10 ("Check your email..."). Anti-enumeration: no reveal that the email is unknown.

---

## Sign-out and re-auth

### [ ] 12. Sign-out

- **Pre**: signed in.
- **Action**: navigate to Settings → tap Sign out.
- **Expected**:
  - UI clears immediately (lands on Landing screen, no perceptible network wait).
  - Vercel logs show one `User signed out, family revoked` debug log within 2 seconds.
  - SecureStore no longer has tokens (verify by killing and reopening; should land on Landing).

### [ ] 13. Sign-out then sign back in

- **Pre**: signed in.
- **Action**: sign out → immediately sign back in with the same account (any auth method).
- **Expected**: clean re-auth. No leftover state from the previous session. New refresh token family.

### [ ] 14. Sign-out with airplane mode

- **Pre**: signed in.
- **Action**: enable airplane mode → tap Sign out.
- **Expected**: local sign-out still completes immediately (UI clears, lands on Landing). Server-side family revocation will fail silently; the family will expire naturally at 30 days.

---

## Mount restore and refresh

### [ ] 15. Kill and reopen, signed-in state

- **Pre**: signed in, app in foreground.
- **Action**: swipe up to close app → tap icon to reopen.
- **Expected**: still signed in, lands on main tabs (not Landing). No perceptible delay beyond the normal cold start.

### [ ] 16. Background 16 minutes, then foreground (refresh path)

- **Pre**: signed in. Note the current time.
- **Action**: background the app (home button or swipe up but don't close) → wait at least 16 minutes (access token TTL is 15 minutes) → foreground the app → trigger any API call (refresh a list, view a film).
- **Expected**:
  - User remains signed in (no kick to Landing).
  - The API call succeeds.
  - Vercel logs show one POST to `/api/auth/mobile/refresh` followed by the original endpoint succeeding.

### [ ] 17. Refresh token revoked mid-session

- **Pre**: signed in. Have admin access to the production DB or a way to manually revoke.
- **Action**: revoke the user's RefreshToken family in the DB (set revokedAt to now) → trigger an API call after the access token expires.
- **Expected**:
  - apiFetch attempts refresh → /refresh returns 401.
  - onAuthFailure fires → user is signed out locally.
  - User lands on Landing screen.

(Skip if you don't have a clean way to revoke; this path is covered by the unit tests.)

---

## Pending banner (onboarding output)

### [ ] 18. New signup applies pendingBanner

- **Pre**: fresh email signup. Onboarding flow completed including a banner pick (any non-default).
- **Action**: complete onboarding → reach the Reveal screen → tap Get started.
- **Expected**:
  - Vercel logs show one `funnel_event` with `event: 'reveal_complete'`.
  - Profile screen shows the banner the user picked, NOT the default midnight gradient.
  - DB User record has `bannerType` and `bannerValue` matching the pick.

### [ ] 19. Returning user with custom banner ignores stale pendingBanner

- **Pre**: existing account with a customized banner. Set a `pendingBanner` in SecureStore via local debug tooling (or by aborting an onboarding flow mid-way).
- **Action**: sign in with the existing account.
- **Expected**: existing banner remains unchanged. The pendingBanner cache is cleared regardless.

(Skip if there's no easy way to seed pendingBanner without going through onboarding — this path is covered by the unit tests.)

---

## Funnel events

### [ ] 20. Onboarding step views and skips land in logs

- **Pre**: fresh signup, onboarding flow open.
- **Action**: walk through onboarding tapping Skip on Eras and Genres, and selecting on Films, then completing Reveal.
- **Expected**: Vercel logs show:
  - `onboarding_step_view` with `screen: 'eras'`
  - `onboarding_skip` with `screen: 'eras'`
  - `onboarding_step_view` with `screen: 'genres'`
  - `onboarding_skip` with `screen: 'genres'`
  - `onboarding_step_view` with `screen: 'films'`
  - `onboarding_step_view` with `screen: 'reveal'`
  - `reveal_complete`

---

## Findings

(Empty before walkthrough. Append failures, deviations, or surprises here. Use the format: `<item number> <short description>`.)
