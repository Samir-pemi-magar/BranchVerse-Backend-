const express = require("express");
const router = express.Router();
const AuthController = require("../Controller/authController");
const { savePreferences } = require("../Controller/authController");
const SupportController = require("../Controller/SupportController");
const protect = require("../middleware/authMiddleware");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const passport = require("passport");
const generateToken = require("../Utils/generateToken");

router.post("/signup", AuthController.Signup);
router.post("/login", AuthController.Login);
router.get("/verify/:token", AuthController.Verify);
router.post("/preferences", protect, savePreferences);
router.get("/preferences", protect, AuthController.getPreferences);
router.get("/profile", protect, AuthController.getProfile);
router.put("/profile", protect, upload.single("profilePicture"), AuthController.updateProfile);
router.get("/profile/image/:id", AuthController.getProfilePicture);
router.get("/profile/:userId", AuthController.getPublicProfile);
router.post("/forgot-password", AuthController.ForgotPassword);
router.post("/reset-password/:token", AuthController.ResetPassword);
router.get("/search", protect, AuthController.searchUsers);

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: "http://localhost:3000/auth/login?error=google_failed" }),
    (req, res) => {
        if (req.user.banned) {
            return res.redirect("http://localhost:3000/auth/login?error=banned");
        }
        const token = generateToken(req.user._id);
        res.redirect(`http://localhost:3000/auth/success?token=${token}&userId=${req.user._id}`);
    }
);
// In your public routes (no auth middleware):
router.post("/support", SupportController.submitMessage);

// In your admin routes (behind your admin middleware):
router.get("/support", SupportController.getMessages);
router.patch("/support/:id/read", SupportController.markRead);

module.exports = router;