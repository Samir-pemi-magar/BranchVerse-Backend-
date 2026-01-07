const express = require("express");
const router = express.Router();
const AuthController = require("../Controller/AuthController");
const { savePreferences } = require("../Controller/AuthController"); // import the preferences function
const protect = require("../middleware/authMiddleware"); // import your protect middleware


router.post("/signup", AuthController.Signup);
router.post("/login", AuthController.Login);
router.get("/verify/:token", AuthController.Verify);
router.post("/preferences", protect, savePreferences);
router.get("/preferences", protect, AuthController.getPreferences);

module.exports = router;
