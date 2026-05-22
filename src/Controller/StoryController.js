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
// ✅ Add this helper near the top of StoryController.js
async function attachStoryViews(stories) {
    if (!stories.length) return stories;

    const storyIds = stories.map(s => s._id);

    const viewTotals = await Chapter.aggregate([
        {
            $match: {
                storyId: { $in: storyIds },
                isMainBranch: true,
                disabled: { $ne: true }
            }
        },
        {
            $group: {
                _id: "$storyId",
                total: { $sum: "$views" }
            }
        }
    ]);

    const viewMap = {};
    viewTotals.forEach(v => { viewMap[v._id.toString()] = v.total; });

    return stories.map(s => {
        const obj = typeof s.toObject === "function" ? s.toObject() : { ...s };
        obj.views = viewMap[obj._id.toString()] ?? 0;
        return obj;
    });
}

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
                tags: Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags],
                genre: Array.isArray(req.body.genre) ? req.body.genre : [req.body.genre],
                description: req.body.description,
                branchAllowed: req.body.branchAllowed === "true",
                cover: uploadStream.id,
                author: req.user._id,
            });

            const updatedUser = await User.findByIdAndUpdate(
                req.user._id,
                { $inc: { totalStoriesWritten: 1 } },
                { new: true }
            );

            await checkAchievements(updatedUser._id);

            // ✅ Notify followers about new story
            try {
                const authorWithFollowers = await User.findById(req.user._id)
                    .populate("followers", "email username notificationPreferences");

                for (const follower of authorWithFollowers.followers) {
                    const pref = follower.notificationPreferences?.newStoryFromFollowing ?? "all";
                    if (pref === "none") continue;

                    await sendFollowNotificationEmail({
                        toEmail: follower.email,
                        toUsername: follower.username,
                        authorUsername: req.user.username || updatedUser.username,
                        storyTitle: story.title,
                        storyId: story._id,
                        type: "new_story",
                    });
                }
            } catch (notifErr) {
                // Don't fail story creation if notification fails
                console.error("Failed to send story notifications:", notifErr.message);
            }

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

        // ✅ Fallback: if not enough recent stories, get all-time
        if (stories.length < 3) {
            stories = await Story.aggregate([
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
                { $limit: 7 }
            ]);
        }

        stories = await Story.populate(stories, { path: "author", select: "username" });
        stories = await attachStoryViews(stories);
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

        let writers = await Story.aggregate([
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

        // ✅ Fallback: if no writers this week, get all-time top writers
        if (writers.length === 0) {
            writers = await Story.aggregate([
                { $match: { disabled: { $ne: true } } },
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
        }

        const populated = await User.populate(writers, { path: "_id", select: "username profilePicture" });

        // ✅ Removed the length < 2 check
        res.json(populated.map(w => ({
            writer: w._id.username,
            totalScore: w.totalScore,
            storiesCount: w.storiesCount,
            profilePicture: w._id.profilePicture
                ? `${req.protocol}://${req.get("host")}/api/auth/profile/image/${w._id.profilePicture}`
                : null
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
        stories = await attachStoryViews(stories);
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
        let stories = await Story.find({ disabled: { $ne: true } })
            .populate("author", "_id username avatar")
            .sort({ createdAt: -1 });

        stories = await attachStoryViews(stories);  // ✅

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
        if (tags) filter.tags = { $in: tags.split(",") };
        if (genre) filter.genre = { $in: genre.split(",") };

        let stories = await Story.find(filter)
            .populate("author", "_id username avatar")
            .sort({ createdAt: -1 });

        stories = await attachStoryViews(stories);  // ✅
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

            if (branchCount === 0) {
                return res.status(403).json({ msg: "This story is unavailable." });
            }

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

        // ✅ Compute views as sum of all main branch chapter views
        const viewsAgg = await Chapter.aggregate([
            { $match: { storyId: story._id, isMainBranch: true, disabled: { $ne: true } } },
            { $group: { _id: null, total: { $sum: "$views" } } }
        ]);
        const totalViews = viewsAgg[0]?.total ?? 0;

        const storyObj = story.toObject();
        const userId = req.user?._id?.toString();
        const liked = userId ? story.likedBy.some(id => id.toString() === userId) : false;

        res.json({ ...storyObj, views: totalViews, liked });
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
        // Get all active stories first
        let stories = await Story.find({ disabled: { $ne: true } })
            .populate("author", "username")
            .lean();

        stories = await attachStoryViews(stories);  // ✅

        // Re-compute trending score with real views and sort
        stories = stories
            .map(s => ({
                ...s,
                trendingScore: (s.views * 0.4) + (s.likes * 0.5) + (s.branchesCount * 0.1)
            }))
            .sort((a, b) => b.trendingScore - a.trendingScore)
            .slice(0, 10);

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

        // Keep currentUserId present even on empty arrays
        if (!user || !user.preferences || !user.preferences.genres || user.preferences.genres.length === 0) {
            return res.json({ currentUserId: req.user?._id, stories: [] });
        }

        const stories = await Story.find({
            genre: { $in: user.preferences.genres },
            disabled: { $ne: true }
        })
            .populate("author", "username")
            .sort({ createdAt: -1 })
            .limit(20);

        // ✅ Wrap it in an object matching your frontend structure
        res.json({ currentUserId: req.user?._id, stories });
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
            const updatedUser = await User.findByIdAndUpdate(
                story.author,
                { $inc: { totalLikes: 1 } },
                { new: true }
            );

            await checkAchievements(updatedUser._id);
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

        await Chapter.deleteMany({ storyId: story._id });
        await story.deleteOne();

        // ✅ Decrement the counter
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { totalStoriesWritten: -1 }
        });

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
                select: "title cover author genre createdAt branchesCount",
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
                select: "title cover author tags genre createdAt branchesCount",  // ✅ add tags
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