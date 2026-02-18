const express = require("express");
const auth = require("../middleware/authMiddleware");
const chapterController = require("../Controller/ChapterController");

const router = express.Router();

// Create chapter
router.post("/", auth, chapterController.createChapter);

// Get main storyline chapters
router.get("/:storyId/main", chapterController.getMainChapters);

// Read single chapter with metadata
router.get("/read/:storyId/:chapterId", chapterController.readChapter);

// Like a chapter
router.post("/:chapterId/like", auth, chapterController.likeChapter);

// Comment on a chapter
router.post("/:chapterId/comment", auth, chapterController.commentChapter);

// Get branches of a chapter
router.get("/branches/:chapterId", chapterController.getBranches);

// Get comments of a chapter
router.get("/:chapterId/comments", chapterController.getComments);

router.post("/:chapterId/comment/:commentId/reply", auth, chapterController.replyToComment);


module.exports = router;
