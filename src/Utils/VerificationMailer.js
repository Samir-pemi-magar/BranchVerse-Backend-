const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function sendVerificationEmail(email, token) {
    const verifyUrl = `${process.env.BASE_URL}/api/auth/verify/${token}`;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin:auto; padding:20px; border:1px solid #ddd; border-radius:10px;">
      <h2 style="color:#10B981;">✔ Verify Your Email</h2>
      <p>Hi there!</p>
      <p>Thanks for signing up. Please click the button below to verify your email address:</p>
      <a href="${verifyUrl}" 
         style="display:inline-block; padding:12px 25px; margin:20px 0; background-color:#3B82F6; color:#fff; text-decoration:none; border-radius:6px; font-weight:bold;">
         Verify Email
      </a>
      <p>If you did not create an account, you can safely ignore this email.</p>
      <hr style="border:none; border-top:1px solid #eee; margin:20px 0;" />
      <p style="font-size:12px; color:#555;">This link expires in 1 hour.</p>
    </div>
  `;

    await transporter.sendMail({
        from: `"BranchVerse" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Verify Your Email Address",
        html,
    });
}

module.exports = sendVerificationEmail;
