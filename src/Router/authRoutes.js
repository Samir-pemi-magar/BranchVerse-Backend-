const express = require("express");
const router = express.Router();
const AuthController = require("../Controller/AuthController");
const { savePreferences } = require("../Controller/AuthController"); // import the preferences function
const protect = require("../middleware/authMiddleware"); // import your protect middleware
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });


router.post("/signup", AuthController.Signup);
router.post("/login", AuthController.Login);
router.get("/verify/:token", AuthController.Verify);
router.post("/preferences", protect, savePreferences);
router.get("/preferences", protect, AuthController.getPreferences);
router.get("/profile", protect, AuthController.getProfile);
router.put(
    "/profile",
    protect,
    upload.single("profilePicture"), // expects 'profilePicture' field
    AuthController.updateProfile
);
router.get("/profile/image/:id", AuthController.getProfilePicture);
router.get("/profile/:userId", AuthController.getPublicProfile);
router.post("/forgot-password", AuthController.ForgotPassword);
router.post("/reset-password/:token", AuthController.ResetPassword);
router.get("/search", protect, AuthController.searchUsers);




module.exports = router;
