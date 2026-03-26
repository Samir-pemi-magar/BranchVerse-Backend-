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
router.get("/my-stories", auth, storyController.getMyStories);
router.get("/:id", storyController.getStoryById);
router.get("/", storyController.getAllStories);
router.get("/feed/filter", storyController.getFilteredStories);
router.post("/:storyId/like", auth, storyController.toggleLikeStory);


// Popular / Top routes
router.get("/feed/popular-week", storyController.popularThisWeekStories); // 7 stories
router.get("/feed/top-writers-week", storyController.topWritersThisWeek); // 3 writers max
router.get("/feed/top-stories", storyController.topStoriesOverall); // 3 stories


module.exports = router;
