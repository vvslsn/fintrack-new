# FinTrack — MongoDB Full Update

This version makes **MongoDB the persistent source of truth** for FinTrack. The browser no longer stores members, schemes, payments, winners or payment requests in localStorage.

## Architecture

Frontend HTML/JS → Express REST API → Mongoose → MongoDB

### Collections

- users
- members
- schemes
- memberSchemeTickets
- payments
- onlinePaymentRequests
- winners
- adminPayouts
- notifications
- paymentSettings / bankAccounts
- auditLogs

## Run locally

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and fill in your MongoDB connection string and a private JWT secret of at least 32 characters:

```env
PORT=5000
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER/fintrack
JWT_SECRET=use-a-long-random-secret
FRONTEND_ORIGIN=http://127.0.0.1:5500,http://localhost:5500
```

Start the API and frontend together:

```bash
npm run dev
```

or:

```bash
npm start
```

Open the app at `http://localhost:5000`. The API health endpoint is:

`http://localhost:5000/api/health`

The frontend is served by Express from the same origin. Do not open HTML files with `file://`. For separate frontend hosting, the default API URL is:

`http://localhost:5000/api`

To use another API URL before loading the page:

```html
<script>
window.FINTRACK_API_URL = "https://your-api.example.com/api";
</script>
```

## Authentication

- Admin accounts are created from `signup.html`.
- Admins log in through `admin-login.html`.
- Members get a linked user account from Admin → Members.
- User login is `user/user-login.html`.
- Passwords are stored only as bcrypt hashes.
- JWTs are kept client-side only as authentication tokens; financial/business records are not kept in localStorage.

## FinTrack rules implemented

### Cash chit

- Normal installment = 5% of chit value.
- From the winning month onward = 6% of chit value.
- Winning payout starts at 95% in month 1 and increases by 1% of chit value per month.
- A ticket can win only once in a scheme.
- Maximum two winners per month.

### Gold chit

- Total cash chit value is not required.
- Gold grams are stored.
- Monthly rupee installments can be configured per month.
- Winner payout is represented in grams.

### Payments

Every installment is uniquely identified by:

`member + scheme + ticket + month`

This prevents duplicate ledger entries.

Online payment requests:

1. User submits UTR.
2. Request is stored in `onlinePaymentRequests`.
3. Admin sees pending requests.
4. Admin approves/rejects.
5. Approval automatically creates/updates the paid ledger record.
6. User receives a notification.

### Payment gateway

FinTrack uses Razorpay Standard Checkout for UPI, net banking, and credit/debit cards. Checkout orders are created by the backend; a payment is added to the ledger only after the signed checkout response is verified and Razorpay reports the payment as captured. Card data is entered on Razorpay Checkout and is not stored by FinTrack.

To enable gateway payments, add these values to `backend/.env` using Razorpay **Test Mode** credentials first:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

Enable automatic payment capture in the Razorpay Dashboard. Configure a webhook URL of `https://YOUR_PUBLIC_HOST/api/payments/gateway/webhook` and subscribe to the `payment.captured` event. The webhook secret must match `RAZORPAY_WEBHOOK_SECRET`. Localhost cannot receive provider webhooks without a public HTTPS tunnel. After successful test payments, replace the test credentials with live-mode keys before accepting real payments.

## Important

The original uploaded project contained a MongoDB Atlas credential in `backend/.env`. That credential was **removed from this updated project**. Create a new `.env` using `.env.example` and use a newly rotated database credential.

The old localStorage business-data implementation was removed from the active frontend flow. Existing browser localStorage records from an older version are **not automatically imported** into MongoDB. If you need the old browser data preserved, export it before switching versions or provide the old data for a controlled migration.

## Main frontend structure

Each functional area has its own JavaScript file:

```text
frontend/
  api.js
  fintrack-core.js

  dashboard.html
  scriptdashboard.js

  schemes.html
  schemes.js

  members.html
  members.js

  payments.html
  payments.js

  scheme-details.html
  scheme-details.js

  payment-settings.html
  payment-settings.js

  user/
    user-common.js
    user-pages.js
    user-auth.js
```

Shared authentication and API communication are kept separate from page-specific business logic.
