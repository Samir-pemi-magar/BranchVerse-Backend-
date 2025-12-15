const express = require("express");
const Story = require("../Models/StoryModel");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

const router = express.Router();

router.post("/", auth, upload.single("cover"), async (req, res) => {
    try {
        const story = await Story.create({
            title: req.body.title,
            // FormData sends tags as string if only one, array if multiple
            tags: Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags],
            description: req.body.description,
            branchAllowed: req.body.branchAllowed === "true",
            cover: req.file.path,
            author: req.user.id,
        });

        // Send clear JSON response
        res.status(201).json({
            storyId: story._id,
            message: "Story created successfully",
        });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});



module.exports = router;
