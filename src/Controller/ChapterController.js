const Chapter = require("../Models/Chapter");
const Story = require("../Models/StoryModel");
const checkAchievements = require("../Utils/achivement");
const User = require("../Models/Users")
// ==================== CREATE CHAPTER ====================
exports.createChapter = async (req, res) => {
    try {
        const { storyId, title, content, parentChapterId, branchTitle } = req.body;

        // 🔹 Fetch story and check if disabled
        const story = await Story.findById(storyId);
        if (!story) return res.status(404).json({ error: "Story not found" });
        if (story.disabled) return res.status(403).json({ error: "Cannot add chapter to a disabled story" });

        let tags = [];
        let genre = [];

        // 🔹 Branching logic
        if (parentChapterId) {
            const parentChapter = await Chapter.findById(parentChapterId);
            if (!parentChapter) return res.status(404).json({ error: "Parent chapter not found" });
            if (parentChapter.disabled) return res.status(403).json({ error: "Cannot branch from a disabled chapter" });

            tags = [...(parentChapter.tags || [])];
            genre = [...(parentChapter.genre || [])];
        } else {
            // Main branch uses story tags/genre
            tags = [...(story.tags || [])];
            genre = [...(story.genre || [])];
        }

        // 🔹 Determine chapter number
        const lastChapter = await Chapter.findOne({ storyId }).sort({ chapterNumber: -1 });
        const chapterNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1;

        // 🔹 Create chapter
        const chapter = await Chapter.create({
            storyId,
            title,
            content,
            parentChapterId: parentChapterId || null,
            isMainBranch: !parentChapterId,
            branchTitle: parentChapterId ? (branchTitle || "Untitled Branch") : null,
            chapterNumber,
            author: req.user._id,
            tags,
            genre,
            disabled: false, // ✅ Ensure new chapters are active by default
            disabledByStory: false
        });

        if (parentChapterId) {
            await Story.findByIdAndUpdate(storyId, { $inc: { branchesCount: 1 } });
            await User.findByIdAndUpdate(req.user._id, { $inc: { totalStoriesBranched: 1 } });
            await checkAchievements(req.user._id);

            // ✅ Notify story author's followers about new branch
            try {
                const sendFollowNotificationEmail = require("../Utils/FollowMailer");
                const fullStory = await Story.findById(storyId).populate("author", "username");
                const storyAuthor = await User.findById(fullStory.author._id)
                    .populate("followers", "email username notificationPreferences");

                for (const follower of storyAuthor.followers) {
                    const pref = follower.notificationPreferences?.newStoryFromFollowing ?? "all";
                    if (pref === "none") continue;

                    await sendFollowNotificationEmail({
                        toEmail: follower.email,
                        toUsername: follower.username,
                        authorUsername: req.user.username,
                        storyTitle: `a new branch on "${fullStory.title}"`,
                        storyId: storyId,
                        type: "new_story",
                    });
                }
            } catch (notifErr) {
                console.error("Failed to send branch notifications:", notifErr.message);
            }
        }

        res.status(201).json({ chapterId: chapter._id, message: "Chapter created successfully" });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
};

// GET /api/chapters/story/:storyId/hierarchy
exports.getChaptersHierarchy = async (req, res) => {
    try {
        const { storyId } = req.params;

        const chapters = await Chapter.find({
            storyId,
            disabled: { $ne: true }
        })
            .sort({ createdAt: 1 })
            .lean();

        // Create map for quick lookup
        const chapterMap = {};
        chapters.forEach(chapter => {
            chapter.branches = [];
            chapterMap[chapter._id.toString()] = chapter;
        });

        const rootChapters = [];

        chapters.forEach(chapter => {
            if (chapter.parentChapterId) {
                const parent = chapterMap[chapter.parentChapterId.toString()];
                if (parent) {
                    parent.branches.push(chapter);
                }
            } else {
                rootChapters.push(chapter);
            }
        });

        res.json(rootChapters);

    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
};


// ==================== GET MAIN STORYLINE CHAPTERS (metadata only) ====================
exports.getMainChapters = async (req, res) => {
    try {
        const chapters = await Chapter.find(
            {
                storyId: req.params.storyId,
                isMainBranch: true,
                disabled: { $ne: true }
            },
            { title: 1, chapterNumber: 1, likes: 1 }  // ← add likes
        ).sort({ chapterNumber: 1 });

        res.json(chapters);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
};

exports.readChapter = async (req, res) => {
    try {
        const { storyId, chapterId } = req.params;

        const chapter = await Chapter.findOne({ _id: chapterId, storyId })
            .populate("author", "username");  // ← ADD THIS

        if (!chapter) return res.status(404).json({ error: "Chapter not found" });

        if (chapter.disabled) {
            return res.status(403).json({ error: "Chapter is disabled" });
        }

        chapter.views += 1;
        await chapter.save();

        const branchCount = await Chapter.countDocuments({ parentChapterId: chapter._id });
        const story = await Story.findById(storyId).select("cover tags");
        const currentUserId = req.user?._id;

        res.json({
            ...chapter.toObject(),
            branchCount,
            cover: story?.cover || null,
            tags: story?.tags || [],
            currentUserId
        });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
};
// ==================== LIKE / UNLIKE CHAPTER ====================
exports.likeChapter = async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.chapterId);
        if (!chapter) return res.status(404).json({ error: "Chapter not found" });
        if (chapter.disabled) {
            return res.status(403).json({ error: "Cannot interact with disabled chapter" });
        }

        let liked = false;

        if (chapter.likedBy.includes(req.user._id)) {
            chapter.likes -= 1;
            chapter.likedBy = chapter.likedBy.filter(
                userId => userId.toString() !== req.user._id.toString()
            );
            await User.findByIdAndUpdate(chapter.author, { $inc: { totalLikes: -1 } });
            await checkAchievements(chapter.author);
        } else {
            chapter.likes += 1;
            chapter.likedBy.push(req.user._id);
            liked = true;
            await User.findByIdAndUpdate(chapter.author, { $inc: { totalLikes: 1 } });
        }

        await chapter.save();

        res.json({ likes: chapter.likes, liked });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};


// ==================== COMMENT ON CHAPTER ====================
exports.commentChapter = async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.chapterId);
        if (!chapter) return res.status(404).json({ error: "Chapter not found" });

        if (chapter.disabled) {
            return res.status(403).json({ error: "Cannot comment on disabled chapter" });
        }

        chapter.comments.push({
            user: req.user._id,
            text: req.body.text
        });

        await chapter.save();
        await checkAchievements(req.user._id);

        const populated = await Chapter.findById(req.params.chapterId)
            .populate("comments.user", "username");

        res.json(populated.comments);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getComments = async (req, res) => {
    try {
        const chapter = await Chapter.findById(
            req.params.chapterId,
            { comments: 1 }
        ).populate("comments.user", "username");

        if (!chapter)
            return res.status(404).json({ error: "Chapter not found" });

        res.json(chapter.comments);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getBranches = async (req, res) => {
    try {
        const branches = await Chapter.find({
            parentChapterId: req.params.chapterId,
            disabled: { $ne: true }
        }).sort({ createdAt: 1 });
        res.json(branches);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
};

// POST /api/chapters/:chapterId/comment/:commentId/reply
exports.replyToComment = async (req, res) => {
    try {
        const { chapterId, commentId } = req.params;
        const { text } = req.body;

        const chapter = await Chapter.findById(chapterId);
        if (!chapter) return res.status(404).json({ error: "Chapter not found" });
        if (chapter.disabled) {
            return res.status(403).json({ error: "Cannot reply on disabled chapter" });
        }

        const comment = chapter.comments.id(commentId);
        if (!comment) return res.status(404).json({ error: "Comment not found" });

        comment.replies.push({
            user: req.user._id,
            text
        });

        await chapter.save();

        // Return updated comments populated with usernames
        const populated = await Chapter.findById(chapterId).populate(
            "comments.user comments.replies.user",
            "username"
        );

        res.json(populated.comments);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getMyBranches = async (req, res) => {
    try {
        // In getMyBranches controller
        const branches = await Chapter.find({
            author: req.user._id,
            isMainBranch: false,
            // ❌ Remove: disabled: false
        })
            .populate({
                path: "storyId",
                select: "title cover tags branchesCount disabled",
                populate: {
                    path: "author",
                    select: "username"
                }
            })
            .populate("author", "username")
            .sort({ createdAt: -1 });

        // Filter out branches from disabled stories
        const activeBranches = branches.filter(branch => branch.storyId && !branch.storyId.disabled);

        // Shape the response to match the Story card format used in the frontend
        const formatted = activeBranches.map(branch => ({
            _id: branch._id,
            branchTitle: branch.branchTitle,
            chapterTitle: branch.title,
            chapterNumber: branch.chapterNumber,
            createdAt: branch.createdAt,
            likes: branch.likes,
            views: branch.views,
            tags: branch.tags,

            disabled: branch.disabled,

            story: {
                _id: branch.storyId._id,
                title: branch.storyId.title,
                cover: branch.storyId.cover,
                tags: branch.storyId.tags,
                branchesCount: branch.storyId.branchesCount,
                author: branch.storyId.author
                    ? {
                        _id: branch.storyId.author._id,
                        username: branch.storyId.author.username
                    }
                    : null
            }
        }));

        res.json(formatted);
    } catch (err) {
        console.error("GET MY BRANCHES ERROR:", err);
        res.status(500).json({ error: err.message });
    }
};

exports.disableChapter = async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.chapterId);

        if (!chapter) {
            return res.status(404).json({ error: "Chapter not found" });
        }

        if (chapter.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Not authorized" });
        }

        chapter.disabled = true;
        chapter.disabledByStory = false;

        await chapter.save();

        res.json({ message: "Chapter disabled" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.enableChapter = async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.chapterId);

        if (!chapter) {
            return res.status(404).json({ error: "Chapter not found" });
        }

        if (chapter.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Not authorized" });
        }

        chapter.disabled = false;
        chapter.disabledByStory = false;

        await chapter.save();

        res.json({ message: "Chapter enabled" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==================== UPDATE CHAPTER ====================
exports.updateChapter = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const { title, content, branchTitle } = req.body;

        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
            return res.status(404).json({ error: "Chapter not found" });
        }

        if (chapter.disabled) {
            return res.status(403).json({ error: "Cannot update a disabled chapter" });
        }

        if (chapter.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Not authorized" });
        }

        // Update fields if provided
        if (title) chapter.title = title;
        if (content) chapter.content = content;

        // Only allow branchTitle if it's a branch
        if (!chapter.isMainBranch && branchTitle) {
            chapter.branchTitle = branchTitle;
        }

        await chapter.save();

        res.json({ message: "Chapter updated successfully", chapter });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ==================== DELETE CHAPTER ====================
exports.deleteChapter = async (req, res) => {
    try {
        const { chapterId } = req.params;

        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
            return res.status(404).json({ error: "Chapter not found" });
        }

        if (chapter.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Not authorized" });
        }

        // Check if chapter has branches
        const branchCount = await Chapter.countDocuments({
            parentChapterId: chapterId,
            disabled: { $ne: true }
        });

        // 🔹 If branches exist → disable instead of delete
        if (branchCount > 0) {
            chapter.disabled = true;
            chapter.disabledByStory = false;

            await chapter.save();

            return res.json({
                message: "Chapter has branches, so it was disabled instead of deleted"
            });
        }

        // 🔹 No branches → safe to delete
        await Chapter.findByIdAndDelete(chapterId);

        res.json({ message: "Chapter deleted successfully" });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.toggleChapterBookmark = async (req, res) => {
    try {
        const { chapterId } = req.params;

        const user = await User.findById(req.user._id);

        const exists = user.bookmarkedChapters.some(
            id => id.toString() === chapterId
        );

        if (exists) {
            user.bookmarkedChapters = user.bookmarkedChapters.filter(
                id => id.toString() !== chapterId
            );

            await user.save();

            return res.json({ bookmarked: false });
        }

        user.bookmarkedChapters.push(chapterId);
        await user.save();

        return res.json({ bookmarked: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getBookmarkedChapters = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate({
                path: "bookmarkedChapters",
                match: { disabled: { $ne: true } },
                populate: {
                    path: "storyId",
                    select: "title cover author",
                    populate: {
                        path: "author",
                        select: "username"
                    }
                }
            });

        res.json(user.bookmarkedChapters);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getBranchesByUser = async (req, res) => {
    try {
        const branches = await Chapter.find({
            author: req.params.userId,
            isMainBranch: false,
            disabled: { $ne: true }
        })
            .populate({
                path: "storyId",
                select: "title cover tags branchesCount disabled",
                populate: { path: "author", select: "username" }
            })
            .populate("author", "username")
            .sort({ createdAt: -1 });

        const activeBranches = branches.filter(b => b.storyId && !b.storyId.disabled);

        const formatted = activeBranches.map(branch => ({
            _id: branch._id,
            branchTitle: branch.branchTitle,
            chapterTitle: branch.title,
            chapterNumber: branch.chapterNumber,
            createdAt: branch.createdAt,
            likes: branch.likes,
            views: branch.views,
            tags: branch.tags,
            disabled: branch.disabled,
            story: {
                _id: branch.storyId._id,
                title: branch.storyId.title,
                cover: branch.storyId.cover,
                tags: branch.storyId.tags,
                branchesCount: branch.storyId.branchesCount,
                author: branch.storyId.author ? {
                    _id: branch.storyId.author._id,
                    username: branch.storyId.author.username
                } : null
            }
        }));

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

