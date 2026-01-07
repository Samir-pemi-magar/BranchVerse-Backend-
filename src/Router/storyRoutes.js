const express = require("express");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const storyController = require("../Controller/StoryController");

const router = express.Router();

router.post("/", auth, upload.single("cover"), storyController.createStory);

router.get("/feed/trending", storyController.getTrendingStories);
router.get("/feed/recommended", auth, storyController.getRecommendedStories);
router.get("/feed/personalized", auth, storyController.getPersonalizedFeed);

router.get("/cover/:id", storyController.getCover);
router.get("/:id", storyController.getStoryById);
router.get("/", storyController.getAllStories);

module.exports = router;
