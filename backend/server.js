require("dotenv").config();
const { notifyOverdueMembers } = require("./services/payment-reminders");
const app = require("./app");

const PORT = process.env.PORT || 5000;
app.initialize().then(() => {
  const checkPaymentReminders = () => notifyOverdueMembers().catch(error => console.error("Payment reminder check failed:", error));
  checkPaymentReminders();
  const reminderTimer = setInterval(checkPaymentReminders, 6 * 60 * 60 * 1000);
  reminderTimer.unref();
  app.listen(PORT, () => console.log(`FinTrack API running on http://localhost:${PORT}`));
}).catch(error => {
  console.error("FinTrack startup failed:", error);
  process.exit(1);
});
