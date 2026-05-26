const express = require("express");
const auth = require("../middleware/authMiddleware");
const chapterController = require("../Controller/ChapterController");

const router = express.Router();

// Create chapter
router.post("/", auth, chapterController.createChapter);

// ── Named/static routes FIRST (before any /:chapterId wildcard) ──
router.get("/my-branches", auth, chapterController.getMyBranches);
router.get("/my-drafts", auth, chapterController.getMyDrafts);               // ✅ new
router.get("/bookmarks/chapters", auth, chapterController.getBookmarkedChapters);
router.get("/user/:userId/branches", auth, chapterController.getBranchesByUser);

// Story-scoped
router.get("/story/:storyId/hierarchy", chapterController.getChaptersHierarchy);
router.get("/:storyId/main", chapterController.getMainChapters);
router.get("/read/:storyId/:chapterId", auth, chapterController.readChapter);
router.get("/branches/:chapterId", chapterController.getBranches);

// Comments
router.get("/:chapterId/comments", chapterController.getComments);
router.post("/:chapterId/comment", auth, chapterController.commentChapter);
router.post("/:chapterId/comment/:commentId/reply", auth, chapterController.replyToComment);

// Like & bookmark
router.post("/:chapterId/like", auth, chapterController.likeChapter);
router.post("/:chapterId/bookmark", auth, chapterController.toggleChapterBookmark);

// Enable / Disable
router.put("/:chapterId/disable", auth, chapterController.disableChapter);
router.put("/:chapterId/enable", auth, chapterController.enableChapter);

// Publish draft
router.patch("/:chapterId/publish", auth, chapterController.publishDraft);   // ✅ new

// CRUD
router.put("/:chapterId", auth, chapterController.updateChapter);
router.delete("/:chapterId", auth, chapterController.deleteChapter);

module.exports = router;