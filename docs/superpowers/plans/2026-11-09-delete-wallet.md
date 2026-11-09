# Delete Wallet Implementation Plan

**Goal:** Add wallet deletion to `card-wallet` with the supplied trash icon and confirmation design.

**Architecture:** Keep the wallet detail dialog mounted while a nested native `alert-card` dialog confirms deletion. `CardWallet` calls the existing `deleteWallet(wallet_account_no)` API; only a successful result closes details and notifies `Mt5Wallet` to refresh accounts.

**Tech Stack:** Angular signals, native HTML dialog, Tailwind, Vitest.

**Spec:** User request and two attached reference images in this conversation.

## Constraints

- Place the trash button at the lower right of the overview in `card-wallet`.
- Cancel, close, and Escape dismiss only confirmation without issuing DELETE.
- Show “Delete Account”, “Are you sure you want to delete account?”, “Cancel”, and “Yes, delete”.
- Preserve the supplied API and SVG assets already present in the workspace.
- Prevent duplicate requests; show failures and allow retry; refresh accounts after success.

## Tasks

- [x] Add integration tests for cancellation, correct wallet number, pending state, failures/retry, and refreshed list; run and observe missing-feature failures.
- [x] Build `alert-card` with pending/error inputs and confirmed/cancelled outputs. Wire the lower-right delete button and API in `card-wallet`; notify the parent to refresh.
- [x] Run targeted tests, the full test suite, and production build. Review the final diff.

## Review focus

Leading zeroes in account numbers, duplicate submission, Escape while pending, unsuccessful API result versus rejected request, and wallet details remaining visible after cancellation.

## Verification

- Targeted component and route tests: 47 passed.
- Full suite: 367 passed, 3 failed. A separate copy of HEAD reproduces all three existing failures: `App > should render title`; `Button > should apply primary variant classes by default`; `Button > should apply ghost variant classes when variant is ghost`.
- Production build passes outside the sandbox, with bundle size and qrcode CommonJS warnings.
- Independent code review found no concrete implementation issues.
- Chrome smoke test with mocked APIs verifies real nested dialogs, initial Cancel focus, trusted Escape preserving details, Cancel restoring trash focus, desktop/mobile layout, exact DELETE account number, and list refresh.
