const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const achivementController = require("../Controller/achivementsController");

// Add this debug line temporarily
console.log("achivementController:", achivementController);

if (typeof achivementController.getAllAchievements !== "function") {
    throw new Error("getAllAchievements is not a function — check controller exports");
}

router.get("/", achivementController.getAllAchievements);

router.get("/me", authMiddleware, achivementController.getUserAchievements);

module.exports = router;