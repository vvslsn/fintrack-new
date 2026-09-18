# FinTrack — Frontend-Only Edition

This version intentionally uses HTML, CSS, JavaScript and localStorage only. No Node.js, Express, MongoDB, API server or backend dependencies are included.

## Included frontend safeguards
- Role and member/admin separation checks remain in the existing UI flows.
- Shared monthly payment calculation helper.
- Duplicate payment detection by member + scheme + ticket + month.
- Duplicate UTR detection.
- Lightweight local audit log stored in `fintrack_audit_logs`.
- Winner-to-ledger calculation helper for cash chits and gold-chit installment support.

## Run
Open `index.html` or serve the folder using a static server. Example:

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`.

## Limitation
Because this is frontend-only, localStorage data can be edited or deleted by a browser user and is not suitable for real financial production use. Backend security must be added before deployment for real customers.
