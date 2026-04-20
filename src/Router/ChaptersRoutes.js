const express = require("express");
const auth = require("../middleware/authMiddleware");
const chapterController = require("../Controller/ChapterController");

const router = express.Router();

// Create chapter
router.post("/", auth, chapterController.createChapter);

// User branches
router.get("/my-branches", auth, chapterController.getMyBranches);

// Read chapter
router.get("/read/:storyId/:chapterId", auth, chapterController.readChapter);

// Branches
router.get("/branches/:chapterId", chapterController.getBranches);

// Comments
router.get("/:chapterId/comments", chapterController.getComments);
router.post("/:chapterId/comment", auth, chapterController.commentChapter);
router.post("/:chapterId/comment/:commentId/reply", auth, chapterController.replyToComment);

// Like
router.post("/:chapterId/like", auth, chapterController.likeChapter);

// Hierarchy
router.get("/story/:storyId/hierarchy", chapterController.getChaptersHierarchy);

// Main storyline
router.get("/:storyId/main", chapterController.getMainChapters);

// Enable / Disable
router.put("/:chapterId/disable", auth, chapterController.disableChapter);
router.put("/:chapterId/enable", auth, chapterController.enableChapter);

// ✅ NEW ROUTES
router.put("/:chapterId", auth, chapterController.updateChapter);
router.delete("/:chapterId", auth, chapterController.deleteChapter);

// ── BOOKMARKS ─────────────────────────────
router.post("/:chapterId/bookmark", auth, chapterController.toggleChapterBookmark);
router.get("/bookmarks/chapters", auth, chapterController.getBookmarkedChapters);
router.get("/user/:userId/branches", auth, chapterController.getBranchesByUser);

module.exports = router;