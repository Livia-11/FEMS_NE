const nodemailer = require('nodemailer');

function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_USER !== 'your_email@gmail.com' &&
    process.env.SMTP_PASS !== 'your_app_password_not_your_gmail_password'
  );
}

let transporter = null;

function getTransporter() {
  if (!isEmailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text }) {
  const mailer = getTransporter();
  if (!mailer) {
    const err = new Error('SMTP email is not configured');
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }

  await mailer.sendMail({
    from: `"${process.env.FROM_NAME || 'TZW LTD Fire Safety'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  });
}

module.exports = {
  isEmailConfigured,
  sendMail,
};
