const User = require("../Models/Users");
const Story = require("../Models/StoryModel");
const Chapter = require("../Models/Chapter");

// ==================== DASHBOARD STATS ====================

/**
 * GET /api/admin/stats
 * Returns platform-wide counts for the admin dashboard.
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const [
            totalUsers,
            bannedUsers,
            totalStories,
            disabledStories,
            totalChapters,
            disabledChapters,
            totalBranches,
        ] = await Promise.all([
            User.countDocuments({ role: { $ne: "admin" } }),
            User.countDocuments({ banned: true }),
            Story.countDocuments(),
            Story.countDocuments({ disabled: true }),
            Chapter.countDocuments({ isMainBranch: true }),
            Chapter.countDocuments({ disabled: true }),
            Chapter.countDocuments({ isMainBranch: false }),
        ]);

        res.json({
            users: { total: totalUsers, banned: bannedUsers },
            stories: { total: totalStories, disabled: disabledStories },
            chapters: { total: totalChapters, disabled: disabledChapters },
            branches: { total: totalBranches },
        });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// ==================== USER MANAGEMENT ====================

/**
 * GET /api/admin/users
 * Returns all non-admin users with pagination.
 * Query params: page (default 1), limit (default 20), search (username/email)
 */
exports.getAllUsers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim();

        const filter = { role: { $ne: "admin" } };
        if (search) {
            filter.$or = [
                { username: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }

        const [users, total] = await Promise.all([
            User.find(filter)
                .select("-password -passwordResetToken -passwordResetExpires")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            User.countDocuments(filter),
        ]);

        res.json({ users, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

/**
 * PATCH /api/admin/users/:userId/ban
 * Bans a user (sets banned: true). Banned users cannot log in.
 */
exports.banUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ msg: "User not found" });
        if (user.role === "admin") return res.status(403).json({ msg: "Cannot ban an admin" });
        if (user.banned) return res.status(400).json({ msg: "User is already banned" });

        user.banned = true;
        await user.save();

        res.json({ msg: `User "${user.username}" has been banned.` });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

/**
 * PATCH /api/admin/users/:userId/unban
 * Lifts a ban from a user.
 */
exports.unbanUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ msg: "User not found" });
        if (!user.banned) return res.status(400).json({ msg: "User is not banned" });

        user.banned = false;
        await user.save();

        res.json({ msg: `User "${user.username}" has been unbanned.` });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

/**
 * DELETE /api/admin/users/:userId
 * Permanently deletes a user and all their stories/chapters.
 */
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ msg: "User not found" });
        if (user.role === "admin") return res.status(403).json({ msg: "Cannot delete an admin account" });

        // Delete all their stories and chapters
        const userStories = await Story.find({ author: user._id }).select("_id");
        const storyIds = userStories.map((s) => s._id);

        await Chapter.deleteMany({ storyId: { $in: storyIds } });
        await Story.deleteMany({ author: user._id });
        await Chapter.deleteMany({ author: user._id }); // branches on other stories
        await user.deleteOne();

        res.json({ msg: `User "${user.username}" and all their content have been deleted.` });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// ==================== STORY MODERATION ====================

/**
 * GET /api/admin/stories
 * Returns ALL stories (including disabled) with pagination + optional search.
 */
exports.getAllStoriesAdmin = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim();

        const filter = {};
        if (search) filter.title = { $regex: search, $options: "i" };

        const [stories, total] = await Promise.all([
            Story.find(filter)
                .populate("author", "username email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Story.countDocuments(filter),
        ]);

        res.json({ stories, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

/**
 * PATCH /api/admin/stories/:storyId/disable
 * Admin force-disables any story.
 */
exports.adminDisableStory = async (req, res) => {
    try {
        const story = await Story.findById(req.params.storyId);
        if (!story) return res.status(404).json({ msg: "Story not found" });
        if (story.disabled) return res.status(400).json({ msg: "Story is already disabled" });

        story.disabled = true;
        await story.save();

        await Chapter.updateMany(
            { storyId: story._id },
            { $set: { disabled: true, disabledByStory: true } }
        );

        res.json({ msg: `Story "${story.title}" has been disabled.` });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

/**
 * PATCH /api/admin/stories/:storyId/enable
 * Admin force-enables any story.
 */
exports.adminEnableStory = async (req, res) => {
    try {
        const story = await Story.findById(req.params.storyId);
        if (!story) return res.status(404).json({ msg: "Story not found" });
        if (!story.disabled) return res.status(400).json({ msg: "Story is already active" });

        story.disabled = false;
        await story.save();

        await Chapter.updateMany(
            { storyId: story._id, disabledByStory: true },
            { $set: { disabled: false, disabledByStory: false } }
        );

        res.json({ msg: `Story "${story.title}" has been enabled.` });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

/**
 * DELETE /api/admin/stories/:storyId
 * Admin force-deletes any story and all its chapters (bypasses branch guard).
 */
exports.adminDeleteStory = async (req, res) => {
    try {
        const story = await Story.findById(req.params.storyId);
        if (!story) return res.status(404).json({ msg: "Story not found" });

        await Chapter.deleteMany({ storyId: story._id });
        await story.deleteOne();

        // Decrement author's story count
        await User.findByIdAndUpdate(story.author, {
            $inc: { totalStoriesWritten: -1 },
        });

        res.json({ msg: `Story "${story.title}" and all its chapters have been permanently deleted.` });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// ==================== CHAPTER MODERATION ====================

/**
 * GET /api/admin/chapters
 * Returns ALL chapters (including disabled) with pagination + optional search.
 */
exports.getAllChaptersAdmin = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim();

        const filter = {};
        if (search) filter.title = { $regex: search, $options: "i" };

        const [chapters, total] = await Promise.all([
            Chapter.find(filter)
                .populate("author", "username email")
                .populate("storyId", "title")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Chapter.countDocuments(filter),
        ]);

        res.json({ chapters, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

/**
 * PATCH /api/admin/chapters/:chapterId/disable
 * Admin force-disables any chapter.
 */
exports.adminDisableChapter = async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.chapterId);
        if (!chapter) return res.status(404).json({ msg: "Chapter not found" });
        if (chapter.disabled) return res.status(400).json({ msg: "Chapter is already disabled" });

        chapter.disabled = true;
        chapter.disabledByStory = false; // explicitly disabled by admin, not cascaded
        await chapter.save();

        res.json({ msg: `Chapter "${chapter.title}" has been disabled.` });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

/**
 * PATCH /api/admin/chapters/:chapterId/enable
 * Admin force-enables any chapter.
 */
exports.adminEnableChapter = async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.chapterId);
        if (!chapter) return res.status(404).json({ msg: "Chapter not found" });
        if (!chapter.disabled) return res.status(400).json({ msg: "Chapter is already active" });

        chapter.disabled = false;
        chapter.disabledByStory = false;
        await chapter.save();

        res.json({ msg: `Chapter "${chapter.title}" has been enabled.` });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

/**
 * DELETE /api/admin/chapters/:chapterId
 * Admin force-deletes any chapter (bypasses branch guard).
 */
exports.adminDeleteChapter = async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.chapterId);
        if (!chapter) return res.status(404).json({ msg: "Chapter not found" });

        // If it was a branch, decrement story's branch count
        if (!chapter.isMainBranch) {
            await Story.findByIdAndUpdate(chapter.storyId, {
                $inc: { branchesCount: -1 },
            });
            await User.findByIdAndUpdate(chapter.author, {
                $inc: { totalStoriesBranched: -1 },
            });
        }

        await chapter.deleteOne();

        res.json({ msg: `Chapter "${chapter.title}" has been permanently deleted.` });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};