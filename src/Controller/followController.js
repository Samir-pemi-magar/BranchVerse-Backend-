const User = require("../Models/Users");
const Story = require("../Models/StoryModel");
const sendFollowNotificationEmail = require("../Utils/FollowMailer");

// ==================== FOLLOW / UNFOLLOW ====================
exports.toggleFollow = async (req, res) => {
    try {
        const targetId = req.params.userId;          // the person being followed
        const currentUserId = req.user._id.toString();

        if (targetId === currentUserId) {
            return res.status(400).json({ msg: "You cannot follow yourself" });
        }

        const [currentUser, targetUser] = await Promise.all([
            User.findById(currentUserId),
            User.findById(targetId),
        ]);

        if (!targetUser) return res.status(404).json({ msg: "User not found" });

        const isFollowing = currentUser.following.some(
            (id) => id.toString() === targetId
        );

        if (isFollowing) {
            // ── UNFOLLOW ──────────────────────────────────────────────
            currentUser.following = currentUser.following.filter(
                (id) => id.toString() !== targetId
            );
            targetUser.followers = targetUser.followers.filter(
                (id) => id.toString() !== currentUserId
            );

            await Promise.all([currentUser.save(), targetUser.save()]);

            return res.json({
                followed: false,
                followersCount: targetUser.followers.length,
            });
        }

        // ── FOLLOW ────────────────────────────────────────────────────
        currentUser.following.push(targetId);
        targetUser.followers.push(currentUserId);

        await Promise.all([currentUser.save(), targetUser.save()]);

        // Send a "you have a new follower" email to the target user
        // only if they have notifications enabled
        if (targetUser.notificationPreferences?.newFollower) {
            sendFollowNotificationEmail({
                toEmail: targetUser.email,
                toUsername: targetUser.username,
                followerUsername: currentUser.username,
                type: "new_follower",
            }).catch((err) => console.error("Follow email error:", err));
        }

        return res.json({
            followed: true,
            followersCount: targetUser.followers.length + 1, // optimistic
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// ==================== GET FOLLOWERS ====================
exports.getFollowers = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .populate("followers", "username profilePicture")
            .lean();

        if (!user) return res.status(404).json({ msg: "User not found" });

        res.json({ followers: user.followers, count: user.followers.length });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// ==================== GET FOLLOWING ====================
exports.getFollowing = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId)
            .populate("following", "username profilePicture")
            .lean();

        if (!user) return res.status(404).json({ msg: "User not found" });

        res.json({ following: user.following, count: user.following.length });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// ==================== CHECK IF FOLLOWING ====================
exports.checkFollowStatus = async (req, res) => {
    try {
        const currentUser = await User.findById(req.user._id).select("following");
        const isFollowing = currentUser.following.some(
            (id) => id.toString() === req.params.userId
        );
        res.json({ isFollowing });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// ==================== UPDATE NOTIFICATION PREFERENCES ====================
/**
 * Body shape:
 * {
 *   newFollower: true | false,        // email when someone follows you
 *   newStoryFromFollowing: "all" | "none" | "digest"
 *     "all"    → email on every new story from people you follow
 *     "digest" → (future) daily digest (stored but not implemented here)
 *     "none"   → no story emails
 * }
 */
exports.updateNotificationPreferences = async (req, res) => {
    try {
        const { newFollower, newStoryFromFollowing } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ msg: "User not found" });

        const validStoryPrefs = ["all", "none", "digest"];

        if (newFollower !== undefined) {
            user.notificationPreferences.newFollower = Boolean(newFollower);
        }

        if (newStoryFromFollowing !== undefined) {
            if (!validStoryPrefs.includes(newStoryFromFollowing)) {
                return res.status(400).json({
                    msg: `newStoryFromFollowing must be one of: ${validStoryPrefs.join(", ")}`,
                });
            }
            user.notificationPreferences.newStoryFromFollowing = newStoryFromFollowing;
        }

        await user.save();

        res.json({
            msg: "Notification preferences updated",
            notificationPreferences: user.notificationPreferences,
        });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// ==================== GET NOTIFICATION PREFERENCES ====================
exports.getNotificationPreferences = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select(
            "notificationPreferences"
        );
        if (!user) return res.status(404).json({ msg: "User not found" });
        res.json({ notificationPreferences: user.notificationPreferences });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};
