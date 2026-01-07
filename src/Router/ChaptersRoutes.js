const express = require("express");
const Chapter = require("../Models/Chapter");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

// ==================== CREATE CHAPTER ====================
router.post("/", auth, async (req, res) => {
    try {
        const { storyId, title, content, parentChapterId, branchTitle } = req.body;

        // Determine next chapter number in the story
        const lastChapter = await Chapter.findOne({ storyId })
            .sort({ chapterNumber: -1 });

        const chapterNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1;

        const chapter = await Chapter.create({
            storyId,
            title,
            content,
            parentChapterId: parentChapterId || null,
            isMainBranch: !parentChapterId, // main if no parent
            branchTitle: parentChapterId ? (branchTitle || "Untitled Branch") : null,
            chapterNumber,
            author: req.user.id,
        });

        res.status(201).json({ chapterId: chapter._id, message: "Chapter created successfully" });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});

// GET MAIN STORYLINE CHAPTERS (metadata only)
router.get("/:storyId/main", async (req, res) => {
    try {
        const chapters = await Chapter.find(
            { storyId: req.params.storyId, isMainBranch: true },
            { title: 1, chapterNumber: 1 } // only return title and chapterNumber
        ).sort({ chapterNumber: 1 });

        res.json(chapters);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});


// ==================== READ SINGLE CHAPTER ====================
router.get("/read/:storyId/:chapterId", async (req, res) => {
    try {
        const chapter = await Chapter.findOne({
            _id: req.params.chapterId,
            storyId: req.params.storyId
        });

        if (!chapter) return res.status(404).json({ error: "Chapter not found" });

        res.json(chapter);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});

// ==================== GET BRANCHES OF A CHAPTER ====================
router.get("/branches/:chapterId", async (req, res) => {
    try {
        const branches = await Chapter.find({
            parentChapterId: req.params.chapterId
        }).sort({ createdAt: 1 });

        res.json(branches);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
