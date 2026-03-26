const mongoose = require("mongoose");
const Story = require("../Models/StoryModel");
const User = require("../Models/Users");
const getGridFS = require("../config/Gridfs");
const checkAchievements = require("../Utils/achivement");

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
                genre: Array.isArray(req.body.genre) ? req.body.genre : [req.body.genre],
                description: req.body.description,
                branchAllowed: req.body.branchAllowed === "true",
                cover: uploadStream.id,
                author: req.user._id,
            });
            await User.findByIdAndUpdate(req.user._id, { $inc: { totalStoriesWritten: 1 } });
            await checkAchievements(req.user._id);

            res.status(201).json({ msg: "Story created", storyId: story._id });
        });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// ==================== POPULAR THIS WEEK STORIES (7) ====================
exports.popularThisWeekStories = async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        let stories = await Story.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
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
            { $limit: 7 }
        ]);

        stories = await Story.populate(stories, { path: "author", select: "username" });

        res.json(stories);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: err.message });
    }
};

// ==================== TOP WRITERS THIS WEEK (3 MAX) ====================
exports.topWritersThisWeek = async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const writers = await Story.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: "$author",
                    totalScore: {
                        $sum: {
                            $add: [
                                { $multiply: ["$views", 0.4] },
                                { $multiply: ["$likes", 0.5] },
                                { $multiply: ["$branchesCount", 0.1] }
                            ]
                        }
                    },
                    storiesCount: { $sum: 1 }
                }
            },
            { $sort: { totalScore: -1 } },
            { $limit: 3 }
        ]);

        // Populate username
        const populated = await User.populate(writers, { path: "_id", select: "username" });

        // Only return if 2 or 3 writers exist
        if (populated.length < 2) return res.json([]);

        res.json(populated.map(w => ({
            writer: w._id.username,
            totalScore: w.totalScore,
            storiesCount: w.storiesCount
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: err.message });
    }
};

// ==================== TOP STORIES (3) ====================
exports.topStoriesOverall = async (req, res) => {
    try {
        let stories = await Story.aggregate([
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
            { $limit: 3 }
        ]);

        stories = await Story.populate(stories, { path: "author", select: "username" });

        res.json(stories);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: err.message });
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
 * GET STORIES BY FILTER
 */
exports.getFilteredStories = async (req, res) => {
    try {
        const { tags, genre } = req.query;
        let filter = {};

        if (tags) {
            const tagsArray = tags.split(",");
            filter.tags = { $in: tagsArray };
        }

        if (genre) {
            const genresArray = genre.split(",");
            filter.genre = { $in: genresArray };
        }


        const stories = await Story.find(filter)
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

        if (!user || !user.preferences || !user.preferences.genres || user.preferences.genres.length === 0) {
            return res.json([]);
        }

        const stories = await Story.find({
            genre: { $in: user.preferences.genres }
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

        if (!user || !user.preferences || !user.preferences.genres || user.preferences.genres.length === 0) {
            return res.json([]);
        }

        const stories = await Story.aggregate([
            {
                $match: { genre: { $in: user.preferences.genres } }
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

        // Populate author
        const populatedStories = await Story.populate(stories, {
            path: "author",
            select: "username"
        });

        res.json(populatedStories);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};

exports.getMyStories = async (req, res) => {
    try {
        const stories = await Story.find({ author: req.user._id })
            .populate("author", "username")
            .sort({ createdAt: -1 });

        res.json(stories);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};

exports.toggleLikeStory = async (req, res) => {
    try {
        const story = await Story.findById(req.params.storyId);
        if (!story) return res.status(404).json({ msg: "Story not found" });

        const userId = req.user._id.toString();

        if (story.likedBy.includes(userId)) {
            // User already liked → remove like
            story.likes -= 1;
            story.likedBy = story.likedBy.filter(id => id.toString() !== userId);
            await User.findByIdAndUpdate(story.author, { $inc: { totalLikes: -1 } });

        } else {
            // User hasn’t liked → add like
            story.likes += 1;
            story.likedBy.push(userId);
            await User.findByIdAndUpdate(story.author, { $inc: { totalLikes: 1 } });
            await checkAchievements(story.author);
        }

        await story.save();

        res.json({ likes: story.likes, liked: story.likedBy.includes(userId) });
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};


// COMMENT STORY
exports.commentStory = async (req, res) => {
    try {
        const story = await Story.findById(req.params.storyId);
        if (!story) return res.status(404).json({ msg: "Story not found" });

        story.comments.push({
            user: req.user._id,
            text: req.body.text
        });

        await story.save();

        // Populate username for the new comment
        const populated = await Story.findById(req.params.storyId)
            .populate("comments.user", "username");

        res.json(populated.comments);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};


