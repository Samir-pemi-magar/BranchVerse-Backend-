const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
    toggleFollow,
    getFollowers,
    getFollowing,
    checkFollowStatus,
    updateNotificationPreferences,
    getNotificationPreferences,
} = require("../Controller/followController");

// Follow / Unfollow a user
router.post("/:userId/toggle", protect, toggleFollow);

// Get followers / following lists of any user
router.get("/:userId/followers", getFollowers);
router.get("/:userId/following", getFollowing);

// Check if the logged-in user follows another user
router.get("/:userId/status", protect, checkFollowStatus);

// Notification preferences (own account only)
router.get("/notifications/preferences", protect, getNotificationPreferences);
router.patch("/notifications/preferences", protect, updateNotificationPreferences);

module.exports = router;