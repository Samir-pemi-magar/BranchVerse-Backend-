const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

transporter.verify((err, success) => {
    if (err) console.error("Reset Mailer SMTP error:", err);
    else console.log("Reset Mailer SMTP ready");
});

async function sendPasswordResetEmail(email, token) {
    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password/${token}`;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin:auto; padding:20px; border:1px solid #ddd; border-radius:10px;">
      <h2 style="color:#EF4444;">🔐 Reset Your Password</h2>
      <p>Hi there!</p>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>
      <a href="${resetUrl}" 
         style="display:inline-block; padding:12px 25px; margin:20px 0; background-color:#3B82F6; color:#fff; text-decoration:none; border-radius:6px; font-weight:bold;">
         Reset Password
      </a>
      <p>If you didn't request this, you can safely ignore this email. Your password will not change.</p>
      <hr style="border:none; border-top:1px solid #eee; margin:20px 0;" />
      <p style="font-size:12px; color:#555;">This link expires in 1 hour.</p>
    </div>
  `;

    try {
        await transporter.sendMail({
            from: `"BranchVerse" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Reset Your Password",
            html,
        });
        console.log("Password reset email sent to", email);
    } catch (err) {
        console.error("Failed to send reset email:", err);
        throw err;
    }
}

module.exports = sendPasswordResetEmail;