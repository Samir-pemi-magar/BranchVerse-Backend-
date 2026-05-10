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

// ── Auth (public) ──────────────────────────────────────────────────────────
router.post("/signup", AdminSignup);   // requires x-admin-secret header
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

module.exports = router;