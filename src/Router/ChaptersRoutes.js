const express = require("express");
const Chapter = require("../Models/Chapter"); // your chapter schema
const auth = require("../middleware/authMiddleware");

const router = express.Router();

// CREATE CHAPTER
router.post("/", auth, async (req, res) => {
    try {
        const chapter = await Chapter.create({
            storyId: req.body.storyId,
            title: req.body.title,
            content: req.body.content,
            parentChapterId: req.body.parentChapterId || null,
            author: req.user.id,
        });

        res.status(201).json({ chapterId: chapter._id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET CHAPTER BY ID (ownership check)
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
