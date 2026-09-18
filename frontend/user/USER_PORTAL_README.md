# FinTrack User Portal

The User Portal opens at `user/user-login.html` when the project is launched.

## Sidebar
- Dashboard
- My Schemes
- My Payments
- Notifications

The separate User Profile, User Ticket, and User Winnings HTML pages have been removed from the project. Profile editing remains available from the top-right three-dot menu as a modal.

## Authentication
- `user/user-login.html` is the only User Portal login page.
- Opening `index.html` redirects to `user/user-login.html`.
- Opening `user/index.html` redirects to `user-login.html`.
- Opening any protected User Portal page without a valid logged-in user redirects to `user-login.html`.
- After a successful login, the user is taken to `user-dashboard.html`.

## Three-dot menu
The top-right three-dot menu contains:
- Edit Profile
- Change Password
- Logout

Profile photo upload/change/remove is handled from the Edit Profile modal.

## Member Login

Member credentials are created by the Admin from the Members page and are linked to a specific member record. No generic demo user is auto-created.

