const express = require("express");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const storyController = require("../Controller/StoryController");

const router = express.Router();

// ── Create ────────────────────────────────────────────────
router.post("/", auth, upload.single("cover"), storyController.createStory);

// ── Static feed routes (MUST be before /:id) ─────────────
router.get("/feed/trending", storyController.getTrendingStories);
router.get("/feed/recommended", auth, storyController.getRecommendedStories);
router.get("/feed/personalized", auth, storyController.getPersonalizedFeed);
router.get("/feed/filter", storyController.getFilteredStories);
router.get("/feed/popular-week", storyController.popularThisWeekStories);
router.get("/feed/top-writers-week", storyController.topWritersThisWeek);
router.get("/feed/top-stories", storyController.topStoriesOverall);

// ── Other static routes (MUST be before /:id) ────────────
router.get("/cover/:id", storyController.getCover);
router.get("/my-stories", auth, storyController.getMyStories);
router.get("/", storyController.getAllStories);

// ── BOOKMARKS ─────────────────────────────
router.post("/:storyId/bookmark", auth, storyController.toggleStoryBookmark);
router.get("/bookmarks/stories", auth, storyController.getBookmarkedStories);
router.get("/bookmarks/all", auth, storyController.getAllBookmarks);


// ── Dynamic :id routes ────────────────────────────────────
router.get("/:id", storyController.getStoryById);
router.put("/:id", auth, upload.single("cover"), storyController.updateStory);
router.delete("/:id", auth, storyController.deleteStory);
router.patch("/:id/disable", auth, storyController.disableStory);
router.patch("/:id/enable", auth, storyController.enableStory);

// ── Story actions ─────────────────────────────────────────
router.post("/:storyId/like", auth, storyController.toggleLikeStory);
router.post("/:storyId/comment", auth, storyController.commentStory);
router.get("/user/:userId", auth, storyController.getStoriesByUser);


module.exports = router;