const express = require("express");
const Story = require("../Models/StoryModel");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * CREATE STORY (Page 1)
 */
router.post("/", auth, async (req, res) => {
    try {
        const story = await Story.create({
            title: req.body.title,
            tags: req.body.tags,
            cover: req.body.cover,
            description: req.body.description,
            author: req.user.id
        });

        res.json({ storyId: story._id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * GET STORY (ownership check)
 */
router.get("/:id", auth, async (req, res) => {
    const story = await Story.findOne({
        _id: req.params.id,
        author: req.user.id
    });

    if (!story) {
        return res.status(403).json({ error: "Access denied" });
    }

    res.json(story);
});

module.exports = router;
