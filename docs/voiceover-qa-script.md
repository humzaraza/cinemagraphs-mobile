# VoiceOver QA Script - Auth Screens

Run on a physical iOS device with VoiceOver enabled (Settings > Accessibility > VoiceOver). Right-swipe to advance focus. Every focus stop must announce a meaningful label, not just "button" or "image".

Last updated: 2026-05-12
Last run on device: <fill on each test run>

## Sign in screen

Right-swipe sequence from the top:

- [ ] Back button -> "Back, button"
- [ ] Header -> "Welcome back, heading"
- [ ] Subtitle -> "Sign in to your account"
- [ ] Tab toggle 1 -> "Sign in, button, selected" (this tab is active)
- [ ] Tab toggle 2 -> "Create account, button"
- [ ] Email field -> "Email address, text field" (followed by current value if any)
- [ ] Password field -> "Password, secure text field"
- [ ] Forgot password link -> "Forgot password, button"
- [ ] Submit button (idle, fields empty) -> "Sign in, button, dimmed"
- [ ] Submit button (fields valid) -> "Sign in, button"
- [ ] Submit button (mid-submit) -> "Sign in, button, dimmed, busy"

## Create account screen

Tap the "Create account" tab. Right-swipe sequence:

- [ ] Back button -> "Back, button"
- [ ] Header -> "Create your account, heading"
- [ ] Subtitle -> "Join the community"
- [ ] Tab toggle 1 -> "Sign in, button"
- [ ] Tab toggle 2 -> "Create account, button, selected"
- [ ] Profile name field -> "Profile name, text field"
- [ ] Email field -> "Email address, text field"
- [ ] Password field -> "Password, secure text field"
- [ ] Submit button (idle, fields empty) -> "Create account, button, dimmed"
- [ ] Submit button (fields valid, password >= 8 chars) -> "Create account, button"
- [ ] Submit button (mid-submit) -> "Create account, button, dimmed, busy"

## Forgot password screen

Navigate from Sign in via the Forgot password link. Right-swipe:

- [ ] Back button -> "Back, button"
- [ ] Header -> "Reset password, heading"
- [ ] Subtitle -> "Enter your email and we'll send you a reset link"
- [ ] Email field -> "Email address, text field"
- [ ] Submit button (idle, field empty) -> "Send reset link, button, dimmed"
- [ ] Submit button (email entered) -> "Send reset link, button"
- [ ] Submit button (mid-submit) -> "Send reset link, button, dimmed, busy"

After a successful submit the inline success box ("Check your email for the reset link") appears in place of the form. Verify VoiceOver reads it on focus.

## OTP entry screen

Reach this screen by completing Create account. Right-swipe:

- [ ] Back button -> "Back, button"
- [ ] Header -> "Check your email, heading"
- [ ] Subtitle (includes email address inline) -> "We sent a verification code to <email>"
- [ ] OTP row container -> "Verification code, 6 digits" followed by the hint "Enter the 6-digit code sent to your email"
- [ ] OTP cells (6 stops) -> each cell announces as "text field". Individual cells intentionally have no label so VoiceOver does not read "Digit 1 of 6" through "Digit 6 of 6" on every navigation.
- [ ] Verify button (idle, < 6 digits) -> "Verify, button, dimmed"
- [ ] Verify button (all 6 filled) -> "Verify, button"
- [ ] Verify button (mid-submit) -> "Verify, button, dimmed, busy"
- [ ] Resend prompt text -> "Didn't receive a code?"
- [ ] Resend link -> "Resend code, button"

## Error state announcements

- [ ] FieldError appearing on a field (e.g. submit Sign in with an empty password) -> "Password is required" is auto-announced by FieldError on the null-to-non-empty transition. The user does not need to navigate to the field to hear it.
- [ ] FieldError on email format (e.g. "abc" as email) -> "Enter a valid email address" auto-announced.
- [ ] FieldError on short password during Create -> "Password must be at least 8 characters" auto-announced.
- [ ] Sign in API failure (wrong password, valid format) -> Toast appears with the server message or "Sign in failed. Please check your credentials.", auto-announced by Toast on show.
- [ ] Create account API failure -> Toast auto-announces server message or "Account creation failed. Please try again."
- [ ] Forgot password API failure -> Toast auto-announces server message or "Could not send code. Please try again."
- [ ] OTP verify API failure -> Toast auto-announces server message or "Invalid or expired code. Please try again."
- [ ] Success toasts also auto-announce: "Signed in", "Account created", "Check your email", "Verified".

When a FieldError clears (user starts typing), no announcement fires (the component only announces on null-to-non-empty transitions, by design).
