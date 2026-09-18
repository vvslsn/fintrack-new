# FinTrack Updated Project

## Changes in this build

- Fixed the scheme/member data-model mismatch by continuing to use `scheme.members` as a count and `chitfund_members` for member records.
- Added duplicate installment protection: `member + scheme + month` cannot be entered twice.
- Changed scheme deletion to preserve financial history: schemes with financial history are closed instead of permanently deleted.
- Changed the payment action from `Pay Now` to `Mark Paid`.
- Manual payment recording now requires an operator confirmation and a real UTR/transaction reference.
- Added SHA-256 password-at-rest migration for the browser demo. Existing legacy plaintext accounts are migrated after a successful login.
- Added `passwordHash` support for new accounts and password resets.

## Important production limitation

This is still a static browser application. Browser-side hashing and `sessionStorage` are not a substitute for real authentication or authorization. Do not use this build for real financial transactions until a backend, database, server-side password hashing (Argon2id/bcrypt), secure sessions, role-based authorization, audit logs, and verified payment-gateway webhooks are implemented.

The payment screen does **not** process UPI/bank payments. It records a payment that has already happened externally and requires the real transaction/UTR reference.


## Data reliability additions
- Centralized Cash/Gold chit type normalization and installment due-date rules.
- Fixed installment status refresh so Paid records remain paid and leave Pending views immediately.
- Added backup/restore and CSV export utilities are retained for future use.
- Added an audit log for key scheme, member, payment, winner, settlement, backup and export actions.
- Added canonical `schemeId` fields during migration.

## Important production limitation
This release remains a browser/localStorage application. Backup/export improves reliability but does not replace a server database. For real-money production use, move authentication, authorization, payment records and audit logging to a trusted backend/database.
