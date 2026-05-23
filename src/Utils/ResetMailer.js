const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendPasswordResetEmail(email, token) {
    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password/${token}`;

    await resend.emails.send({
        from: "BranchVerse <onboarding@resend.dev>",
        to: email,
        subject: "Reset Your Password",
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin:auto; padding:20px; border:1px solid #ddd; border-radius:10px;">
          <h2 style="color:#EF4444;">🔐 Reset Your Password</h2>
          <p>Hi there!</p>
          <p>We received a request to reset your password. Click the button below to choose a new one:</p>
          <a href="${resetUrl}" style="display:inline-block; padding:12px 25px; margin:20px 0; background-color:#3B82F6; color:#fff; text-decoration:none; border-radius:6px; font-weight:bold;">
            Reset Password
          </a>
          <p>If you didn't request this, you can safely ignore this email. Your password will not change.</p>
          <hr style="border:none; border-top:1px solid #eee; margin:20px 0;" />
          <p style="font-size:12px; color:#555;">This link expires in 1 hour.</p>
        </div>
        `,
    });
    console.log("Password reset email sent to", email);
}

module.exports = sendPasswordResetEmail;