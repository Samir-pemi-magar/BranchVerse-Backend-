const express = require("express");
const Chapter = require("../Models/Chapter");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

// CREATE CHAPTER
router.post("/", auth, async (req, res) => {
    try {
        const {
            storyId,
            title,
            content,
            parentChapterId,
            branchTitle
        } = req.body;

        const lastChapter = await Chapter.findOne({ storyId })
            .sort({ chapterNumber: -1 });

        const chapterNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1;

        const chapter = await Chapter.create({
            storyId,
            title,
            content,
            parentChapterId: parentChapterId || null,

            // ✅ MAIN vs BRANCH LOGIC (THIS IS THE KEY CHANGE)
            isMainBranch: !parentChapterId,
            branchTitle: parentChapterId ? (branchTitle || "Untitled Branch") : null,

            chapterNumber,
            author: req.user.id,
        });

        res.status(201).json({ chapterId: chapter._id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET CHAPTER (ownership check)
router.get("/:id", auth, async (req, res) => {
    const chapter = await Chapter.findOne({
        _id: req.params.id,
        author: req.user.id,
    });

    if (!chapter) {
        return res.status(403).json({ error: "Access denied" });
    }

    res.json(chapter);
});

module.exports = router;
