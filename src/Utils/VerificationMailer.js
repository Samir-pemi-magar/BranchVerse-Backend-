const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 2525,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.BASE_URL}/api/auth/verify/${token}`;

  await transporter.sendMail({
    from: `"BranchVerse" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify Your Email Address",
    html: `...same html as before...`,
  });

  console.log("Verification email sent to", email);
}

module.exports = sendVerificationEmail;