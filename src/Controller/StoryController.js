const sendFollowNotificationEmail = require("../Utils/FollowMailer");
const mongoose = require("mongoose");
const Story = require("../Models/StoryModel");
const User = require("../Models/Users");
const Chapter = require("../Models/Chapter");
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
            { $match: { createdAt: { $gte: sevenDaysAgo }, disabled: { $ne: true } } },
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
            { $match: { createdAt: { $gte: sevenDaysAgo }, disabled: { $ne: true } } },
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

        const populated = await User.populate(writers, { path: "_id", select: "username" });

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
            { $match: { disabled: { $ne: true } } },
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
 * Updated to ensure author _id and avatar are populated for the frontend UI logic.
 */
exports.getAllStories = async (req, res) => {
    try {
        const stories = await Story.find({ disabled: { $ne: true } })
            .populate("author", "_id username avatar")
            .sort({ createdAt: -1 });

        // Include current user ID for frontend convenience
        const currentUserId = req.user?._id;

        res.json({ currentUserId, stories });
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};

/**
 * GET STORIES BY FILTER
 * Updated to ensure author _id and avatar are populated for the frontend UI logic.
 */
exports.getFilteredStories = async (req, res) => {
    try {
        const { tags, genre } = req.query;
        let filter = { disabled: { $ne: true } };

        if (tags) {
            const tagsArray = tags.split(",");
            filter.tags = { $in: tagsArray };
        }

        if (genre) {
            const genresArray = genre.split(",");
            filter.genre = { $in: genresArray };
        }

        const stories = await Story.find(filter)
            // Explicitly selecting _id, username, and avatar
            .populate("author", "_id username avatar")
            .sort({ createdAt: -1 });

        res.json(stories);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};

/**
 * GET SINGLE STORY (+ VIEW COUNT)
 * — Disabled + no branches → 403 with zero data
 * — Disabled + has branches → 403 with minimal safe fields only
 * — Active → full story with incremented view count
 */
exports.getStoryById = async (req, res) => {
    try {
        const story = await Story.findById(req.params.id)
            .populate("author", "username");

        if (!story) return res.status(404).json({ msg: "Story not found" });

        if (story.disabled) {
            const branchCount = await Chapter.countDocuments({
                storyId: story._id,
                isMainBranch: false
            });

            // Disabled + no branches → send nothing
            if (branchCount === 0) {
                return res.status(403).json({ msg: "This story is unavailable." });
            }

            // Disabled + has branches → minimal payload so branch readers have context
            return res.status(403).json({
                msg: "This story has been disabled by the author.",
                disabled: true,
                story: {
                    _id: story._id,
                    title: story.title,
                    author: story.author,
                    cover: story.cover,
                    tags: story.tags,
                    genre: story.genre,
                    branchesCount: story.branchesCount,
                    disabled: true,
                }
            });
        }

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
 * TRENDING STORIES (GLOBAL)
 */
exports.getTrendingStories = async (req, res) => {
    try {
        const stories = await Story.aggregate([
            { $match: { disabled: { $ne: true } } },
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
 * RECOMMENDED STORIES (USING preferences.genres)
 */
exports.getRecommendedStories = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user || !user.preferences || !user.preferences.genres || user.preferences.genres.length === 0) {
            return res.json([]);
        }

        const stories = await Story.find({
            genre: { $in: user.preferences.genres },
            disabled: { $ne: true }
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
 * PERSONALIZED FEED (TRENDING + PREFERENCE)
 */
exports.getPersonalizedFeed = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user || !user.preferences || !user.preferences.genres || user.preferences.genres.length === 0) {
            return res.json([]);
        }

        const stories = await Story.aggregate([
            {
                $match: {
                    genre: { $in: user.preferences.genres },
                    disabled: { $ne: true }
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

        const populatedStories = await Story.populate(stories, {
            path: "author",
            select: "username"
        });

        res.json(populatedStories);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};

/**
 * GET MY STORIES
 * — Returns all of the author's stories including disabled ones (clearly flagged).
 */
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

        if (story.disabled) {
            return res.status(403).json({ msg: "Cannot interact with a disabled story." });
        }

        const userId = req.user._id.toString();

        if (story.likedBy.includes(userId)) {
            story.likes -= 1;
            story.likedBy = story.likedBy.filter(id => id.toString() !== userId);
            await User.findByIdAndUpdate(story.author, { $inc: { totalLikes: -1 } });
        } else {
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

        if (story.disabled) {
            return res.status(403).json({ msg: "Cannot comment on a disabled story." });
        }

        story.comments.push({
            user: req.user._id,
            text: req.body.text
        });

        await story.save();

        const populated = await Story.findById(req.params.storyId)
            .populate("comments.user", "username");

        res.json(populated.comments);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};

/**
 * DISABLE STORY
 * — Works for any story (with or without branches).
 * — Author can use this to hide their story from public without deleting it.
 */
exports.disableStory = async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);

        if (!story) {
            return res.status(404).json({ msg: "Story not found" });
        }

        if (story.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ msg: "Not authorized to disable this story" });
        }

        if (story.disabled) {
            return res.status(400).json({ msg: "Story is already disabled" });
        }

        story.disabled = true;
        await story.save();

        await Chapter.updateMany(
            { storyId: story._id },
            {
                $set: {
                    disabled: true,
                    disabledByStory: true
                }
            }
        );

        res.json({ msg: "Story has been disabled. You can re-enable it at any time.", disabled: true });
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};

/**
 * ENABLE STORY
 * — Re-activates a previously disabled story.
 * — Only the author can do this.
 */
exports.enableStory = async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);

        if (!story) {
            return res.status(404).json({ msg: "Story not found" });
        }

        if (story.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ msg: "Not authorized to enable this story" });
        }

        if (!story.disabled) {
            return res.status(400).json({ msg: "Story is already active" });
        }

        story.disabled = false;
        await story.save();

        await Chapter.updateMany(
            { storyId: story._id, disabledByStory: true },
            {
                $set: {
                    disabled: false,
                    disabledByStory: false
                }
            }
        );

        res.json({ msg: "Story has been re-enabled successfully", story });
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};

/**
 * DELETE STORY
 * — If the story has branches → block hard delete, tell author to disable instead.
 * — If the story has no branches → hard delete as normal.
 */
exports.deleteStory = async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);

        if (!story) {
            return res.status(404).json({ msg: "Story not found" });
        }

        if (story.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ msg: "Not authorized to delete this story" });
        }

        const branchCount = await Chapter.countDocuments({
            storyId: story._id,
            isMainBranch: false
        });

        if (branchCount > 0) {
            return res.status(400).json({
                msg: "Stories with branches cannot be permanently deleted. Use disable instead to hide it from public.",
                hasBranches: true,
                branchCount
            });
        }

        // BEFORE deleting story
        await Chapter.deleteMany({ storyId: story._id });

        await story.deleteOne();

        res.json({ msg: "Story deleted successfully" });
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};

exports.updateStory = async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);

        if (!story) {
            return res.status(404).json({ msg: "Story not found" });
        }

        if (story.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ msg: "Not authorized to edit this story" });
        }

        if (req.body.title && req.body.title !== story.title) {
            const branchCount = await Chapter.countDocuments({
                storyId: story._id,
                isMainBranch: false
            });

            if (branchCount > 0) {
                return res.status(400).json({
                    msg: "Cannot update title on a story that already has branches"
                });
            }

            story.title = req.body.title;
        }

        if (req.body.description !== undefined) {
            story.description = req.body.description;
        }

        if (req.body.tags) {
            story.tags = Array.isArray(req.body.tags)
                ? req.body.tags
                : [req.body.tags];
        }

        if (req.body.genre) {
            story.genre = Array.isArray(req.body.genre)
                ? req.body.genre
                : [req.body.genre];
        }

        if (req.body.branchAllowed !== undefined) {
            story.branchAllowed = req.body.branchAllowed === "true";
        }

        if (req.file) {
            const gridfsBucket = getGridFS();
            const uploadStream = gridfsBucket.openUploadStream(
                Date.now() + "-" + req.file.originalname,
                { contentType: req.file.mimetype }
            );

            uploadStream.end(req.file.buffer);

            await new Promise((resolve, reject) => {
                uploadStream.on("finish", resolve);
                uploadStream.on("error", reject);
            });

            story.cover = uploadStream.id;
        }

        await story.save();

        res.json({ msg: "Story updated successfully", story });
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};
exports.toggleStoryBookmark = async (req, res) => {
    try {
        const { storyId } = req.params;

        const user = await User.findById(req.user._id);

        const exists = user.bookmarkedStories.some(
            id => id.toString() === storyId
        );

        if (exists) {
            user.bookmarkedStories = user.bookmarkedStories.filter(
                id => id.toString() !== storyId
            );

            await user.save();

            return res.json({ bookmarked: false });
        }

        user.bookmarkedStories.push(storyId);
        await user.save();

        return res.json({ bookmarked: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getBookmarkedStories = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate({
                path: "bookmarkedStories",
                match: { disabled: { $ne: true } },
                select: "title cover author genre createdAt",
                populate: {
                    path: "author",
                    select: "username"
                }
            });

        res.json(user.bookmarkedStories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllBookmarks = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate({
                path: "bookmarkedStories",
                match: { disabled: { $ne: true } },
                select: "title cover author tags genre createdAt",  // ✅ add tags
                populate: { path: "author", select: "username" }
            })
            .populate({
                path: "bookmarkedChapters",
                match: { disabled: { $ne: true } },
                populate: {
                    path: "storyId",
                    select: "title cover tags author",  // ✅ add tags
                    populate: { path: "author", select: "username" }
                }
            });

        // ✅ Remap storyId → story so frontend interface matches
        const chapters = user.bookmarkedChapters.map(ch => {
            const obj = ch.toObject();
            obj.story = obj.storyId;
            delete obj.storyId;
            return obj;
        });

        return res.json({
            stories: user.bookmarkedStories,
            chapters
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getStoriesByUser = async (req, res) => {
    try {
        const stories = await Story.find({ 
            author: req.params.userId, 
            disabled: { $ne: true } 
        })
            .populate("author", "username")
            .sort({ createdAt: -1 });
        res.json(stories);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
};