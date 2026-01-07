const mongoose = require("mongoose");
const Story = require("../Models/StoryModel");
const User = require("../Models/Users");
const getGridFS = require("../config/Gridfs");

/**
 * CREATE STORY
 */
exports.createStory = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: "Cover image is required" });
        }

        const gridfsBucket = getGridFS();
        const uploadStream = gridfsBucket.openUploadStream(
            Date.now() + "-" + req.file.originalname,
            { contentType: req.file.mimetype }
        );

        uploadStream.end(req.file.buffer);

        uploadStream.on("finish", async () => {
            const story = await Story.create({
                title: req.body.title,
                tags: Array.isArray(req.body.tags)
                    ? req.body.tags
                    : [req.body.tags],
                description: req.body.description,
                branchAllowed: req.body.branchAllowed === "true",
                cover: uploadStream.id,
                author: req.user._id,
            });

            res.status(201).json({ msg: "Story created", storyId: story._id });
        });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

/**
 * GET ALL STORIES
 */
exports.getAllStories = async (req, res) => {
    try {
        const stories = await Story.find()
            .populate("author", "username")
            .sort({ createdAt: -1 });

        res.json(stories);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};

/**
 * GET SINGLE STORY (+ VIEW COUNT)
 */
exports.getStoryById = async (req, res) => {
    try {
        const story = await Story.findById(req.params.id)
            .populate("author", "username");

        if (!story) return res.status(404).json({ msg: "Story not found" });

        story.views += 1;
        await story.save();

        res.json(story);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};

/**
 * GET COVER IMAGE
 */
exports.getCover = async (req, res) => {
    try {
        const gridfsBucket = getGridFS();
        const fileId = new mongoose.Types.ObjectId(req.params.id);
        gridfsBucket.openDownloadStream(fileId).pipe(res);
    } catch {
        res.status(400).json({ msg: "Invalid image id" });
    }
};

/**
 * 🔥 TRENDING STORIES (GLOBAL)
 */
exports.getTrendingStories = async (req, res) => {
    try {
        const stories = await Story.aggregate([
            {
                $addFields: {
                    trendingScore: {
                        $add: [
                            { $multiply: ["$views", 0.4] },
                            { $multiply: ["$likes", 0.5] },
                            { $multiply: ["$branchesCount", 0.1] }
                        ]
                    }
                }
            },
            { $sort: { trendingScore: -1 } },
            { $limit: 10 }
        ]);

        res.json(stories);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};

/**
 * 🎯 RECOMMENDED STORIES (USING preferences.genres)
 */
exports.getRecommendedStories = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user || !user.preferences.genres.length) {
            return res.status(200).json([]);
        }

        const stories = await Story.find({
            tags: { $in: user.preferences.genres }
        })
            .populate("author", "username")
            .sort({ createdAt: -1 })
            .limit(20);

        res.json(stories);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};

/**
 * 🧠 PERSONALIZED FEED (TRENDING + PREFERENCE)
 */
exports.getPersonalizedFeed = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user || !user.preferences.genres.length) {
            return res.status(200).json([]);
        }

        const stories = await Story.aggregate([
            {
                $match: {
                    tags: { $in: user.preferences.genres }
                }
            },
            {
                $addFields: {
                    score: {
                        $add: [
                            { $multiply: ["$views", 0.3] },
                            { $multiply: ["$likes", 0.4] },
                            { $multiply: ["$branchesCount", 0.2] }
                        ]
                    }
                }
            },
            { $sort: { score: -1 } },
            { $limit: 15 }
        ]);

        res.json(stories);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};
