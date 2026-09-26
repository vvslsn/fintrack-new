# Run FinTrack with Docker

Docker Compose runs the Express application and MongoDB together. Express serves both the frontend and API at the same address, and MongoDB data persists in the `mongo-data` volume.

## First run

1. Install Docker Desktop (Windows/macOS) or Docker Engine with the Compose plugin (Linux).
2. Copy `.env.example` to `.env` in the repository root. Replace the MongoDB passwords and `JWT_SECRET` with separate random secrets. For email and payment features, also fill in the SMTP and Razorpay values.
3. From the repository root, run:

   ```sh
   docker compose up --build
   ```

4. Open `http://localhost:5000`. Check `http://localhost:5000/api/health` for the API health status.

On later starts, the single command is `docker compose up`. Stop the stack with `Ctrl+C`; run `docker compose down` to stop and remove its containers. The database volume is retained. To rebuild after code changes, run `docker compose up --build` again.

## Deployment notes

- Set `FRONTEND_URL` and `FRONTEND_ORIGIN` to the public HTTPS origin when publishing behind a domain or reverse proxy. Terminate TLS at the proxy and forward requests to the app container on port 5000.
- Keep `.env` private. It is ignored by Git and excluded from the Docker build context.
- Back up the `mongo-data` volume before upgrades or migrations. The initial Mongo app user is created only when MongoDB initializes an empty data directory; changing its environment password later does not rotate the existing MongoDB user's password.
- For a managed MongoDB deployment, configure `MONGO_URI` with an appropriately scoped database user, then update the Compose file to remove the local `mongo` service and the app's `depends_on` entry. The default Compose file is intended for a self-contained deployment.
- SMTP and Razorpay settings are optional for starting the app. Their related features need valid provider settings to send email or process payments.
