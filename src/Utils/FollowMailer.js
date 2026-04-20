const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Unified follow/story notification mailer.
 *
 * @param {Object} opts
 * @param {string}  opts.toEmail           – recipient email
 * @param {string}  opts.toUsername        – recipient display name
 * @param {string}  [opts.followerUsername] – who followed (type: new_follower)
 * @param {string}  [opts.authorUsername]  – who published (type: new_story)
 * @param {string}  [opts.storyTitle]      – story title   (type: new_story)
 * @param {string}  [opts.storyId]         – story _id     (type: new_story)
 * @param {string}  opts.type              – "new_follower" | "new_story"
 */
async function sendFollowNotificationEmail(opts) {
    const { toEmail, toUsername, type } = opts;

    let subject, bodyHtml;

    // ── NEW FOLLOWER ──────────────────────────────────────────────────────────
    if (type === "new_follower") {
        const { followerUsername } = opts;
        subject = `${followerUsername} started following you on BranchVerse!`;

        bodyHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;">
        <h2 style="color:#10B981;margin-bottom:8px;">🎉 New Follower!</h2>
        <p style="font-size:16px;color:#374151;">Hi <strong>${toUsername}</strong>,</p>
        <p style="font-size:15px;color:#374151;">
          <strong>${followerUsername}</strong> just started following you on BranchVerse.
          Keep writing — your stories are drawing an audience!
        </p>

        <a href="${process.env.FRONTEND_URL}/profile/${followerUsername}"
           style="display:inline-block;margin:20px 0;padding:12px 28px;background:#3B82F6;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
          View their profile
        </a>

        <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;" />
        <p style="font-size:12px;color:#9ca3af;">
          You're receiving this because you have <em>new follower</em> notifications turned on.
          <a href="${process.env.FRONTEND_URL}/settings/notifications" style="color:#6B7280;">Manage preferences</a>
        </p>
      </div>`;
    }

    // ── NEW STORY FROM SOMEONE YOU FOLLOW ─────────────────────────────────────
    else if (type === "new_story") {
        const { authorUsername, storyTitle, storyId } = opts;
        subject = `${authorUsername} just published a new story on BranchVerse!`;
        const storyUrl = `${process.env.FRONTEND_URL}/story/${storyId}`;

        bodyHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;">
        <h2 style="color:#10B981;margin-bottom:8px;">📖 New Story Alert</h2>
        <p style="font-size:16px;color:#374151;">Hi <strong>${toUsername}</strong>,</p>
        <p style="font-size:15px;color:#374151;">
          Someone you follow — <strong>${authorUsername}</strong> — just published a new story:
        </p>

        <div style="background:#f9fafb;border-left:4px solid #10B981;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="margin:0;font-size:18px;font-weight:bold;color:#111827;">${storyTitle}</p>
          <p style="margin:6px 0 0;font-size:13px;color:#6B7280;">by ${authorUsername}</p>
        </div>

        <a href="${storyUrl}"
           style="display:inline-block;margin:20px 0;padding:12px 28px;background:#10B981;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
          Read the Story →
        </a>

        <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;" />
        <p style="font-size:12px;color:#9ca3af;">
          You're receiving this because you follow <strong>${authorUsername}</strong> and have story notifications set to <em>all</em>.
          <a href="${process.env.FRONTEND_URL}/settings/notifications" style="color:#6B7280;">Manage preferences</a>
        </p>
      </div>`;
    } else {
        throw new Error(`Unknown notification type: ${type}`);
    }

    await transporter.sendMail({
        from: `"BranchVerse" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject,
        html: bodyHtml,
    });

    console.log(`[Mailer] ${type} email sent to ${toEmail}`);
}

module.exports = sendFollowNotificationEmail;
