const nodemailer = require("nodemailer");

let transporter;

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function getTransport() {
  if (!smtpConfigured()) throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASSWORD.");
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  return getTransport().sendMail({ from, to, subject, text });
}

async function sendMemberCredentials({ to, name, username, temporaryPassword }) {
  const frontendUrl = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  const loginUrl = `${frontendUrl}/user/user-login.html`;
  await sendMail({
    to,
    subject: "Your FinTrack member account",
    text: `Hello ${name},\n\nYour manager created your FinTrack member account.\n\nUsername: ${username}\nTemporary password: ${temporaryPassword}\n\nSign in at ${loginUrl}. You will be asked to choose a new password before you can view your account.\n\nIf you did not expect this message, contact your manager.`
  });
}

async function sendPasswordResetOtp({ to, name, otp }) {
  await sendMail({
    to,
    subject: "Your FinTrack password reset code",
    text: `Hello ${name},\n\nYour FinTrack password reset code is: ${otp}\n\nThis code expires in 10 minutes and can be used once. If you did not request a password reset, ignore this email.`
  });
}

module.exports = { smtpConfigured, sendMemberCredentials, sendPasswordResetOtp };
