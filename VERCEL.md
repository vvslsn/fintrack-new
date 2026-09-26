# Deploy FinTrack to Vercel

The Vercel project must use the repository root as its **Root Directory**. The root Express entry point serves `/api/*`; the Vercel build copies the existing `frontend/` files into `public/` so Vercel can serve them from the CDN.

## Required project settings

In Vercel, open **Project > Settings > General** and set **Root Directory** to `.` (the repository root). Keep the framework preset as **Other** or allow Vercel to detect Express. The build command is configured in `vercel.json`.

Add these values under **Project > Settings > Environment Variables** for both Preview and Production:

- `MONGO_URI`: connection string for a hosted MongoDB database reachable from Vercel.
- `JWT_SECRET`: a private random value at least 32 characters long.

Optional integrations can be configured with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and `FRONTEND_URL`. Do not commit `.env` or paste secret values into GitHub.

After saving environment variables, redeploy the project. Vercel redeploys when changes are pushed to the connected GitHub repository; Preview deployments are created for other branches and Production follows the configured production branch. Share the resulting Vercel URL with your friend.

## MongoDB access

Make sure the MongoDB provider permits connections from the Vercel deployment. For MongoDB Atlas, check the project's Network Access rules and database user permissions. A local MongoDB address such as `localhost` cannot be reached by Vercel.
