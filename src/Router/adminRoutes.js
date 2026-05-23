const express = require("express");
const router = express.Router();

const { AdminSignup, AdminLogin, getAdminProfile } = require("../Controller/adminAuth");
const {
    getDashboardStats,
    getAllUsers,
    banUser,
    unbanUser,
    deleteUser,
    getAllStoriesAdmin,
    adminDisableStory,
    adminEnableStory,
    adminDeleteStory,
    getAllChaptersAdmin,
    adminDisableChapter,
    adminEnableChapter,
    adminDeleteChapter,
} = require("../Controller/adminController");
const protectAdmin = require("../middleware/protectAdmin");

// Import your support controller here
const { getMessages, markRead } = require("../Controller/supportController"); // Update path to your file name

// ── Auth (public) ──────────────────────────────────────────────────────────
router.post("/signup", AdminSignup);
router.post("/login", AdminLogin);

// ── Everything below requires a valid admin JWT ────────────────────────────
router.use(protectAdmin);

// Profile
router.get("/me", getAdminProfile);

// Dashboard stats
router.get("/stats", getDashboardStats);

// User management
router.get("/users", getAllUsers);
router.patch("/users/:userId/ban", banUser);
router.patch("/users/:userId/unban", unbanUser);
router.delete("/users/:userId", deleteUser);

// Story moderation
router.get("/stories", getAllStoriesAdmin);
router.patch("/stories/:storyId/disable", adminDisableStory);
router.patch("/stories/:storyId/enable", adminEnableStory);
router.delete("/stories/:storyId", adminDeleteStory);

// Chapter moderation
router.get("/chapters", getAllChaptersAdmin);
router.patch("/chapters/:chapterId/disable", adminDisableChapter);
router.patch("/chapters/:chapterId/enable", adminEnableChapter);
router.delete("/chapters/:chapterId", adminDeleteChapter);

// ── Support Message Management ──────────────────────────────────────────────
router.get("/support", getMessages);              // GET /api/admin/support
router.patch("/support/:id/read", markRead);      // PATCH /api/admin/support/:id/read

module.exports = router;