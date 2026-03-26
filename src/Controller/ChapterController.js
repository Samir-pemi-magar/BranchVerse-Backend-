const Chapter = require("../Models/Chapter");
const Story = require("../Models/StoryModel");
const checkAchievements = require("../Utils/achivement");
const User = require("../Models/Users")
// ==================== CREATE CHAPTER ====================
exports.createChapter = async (req, res) => {
    try {
        const { storyId, title, content, parentChapterId, branchTitle } = req.body;

        const lastChapter = await Chapter.findOne({ storyId }).sort({ chapterNumber: -1 });
        const chapterNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1;

        let tags = [];
        let genre = [];

        if (parentChapterId) {
            const parentChapter = await Chapter.findById(parentChapterId);
            if (!parentChapter) return res.status(404).json({ error: "Parent chapter not found" });

            tags = [...(parentChapter.tags || [])];
            genre = [...(parentChapter.genre || [])];
        } else {
            const story = await Story.findById(storyId);
            if (!story) return res.status(404).json({ error: "Story not found" });

            tags = [...(story.tags || [])];
            genre = [...(story.genre || [])];
        }

        const chapter = await Chapter.create({
            storyId,
            title,
            content,
            parentChapterId: parentChapterId || null,
            isMainBranch: !parentChapterId,
            branchTitle: parentChapterId ? (branchTitle || "Untitled Branch") : null,
            chapterNumber,
            author: req.user.id,
            tags,
            genre
        });

        // ✅ Increment story branch count if this chapter is a branch
        if (parentChapterId) {
            await Story.findByIdAndUpdate(storyId, { $inc: { branchesCount: 1 } });
            await User.findByIdAndUpdate(req.user._id, { $inc: { totalStoriesBranched: 1 } });
            await checkAchievements(req.user._id);
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

        const chapters = await Chapter.find({ storyId })
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
            { storyId: req.params.storyId, isMainBranch: true },
            { title: 1, chapterNumber: 1 }
        ).sort({ chapterNumber: 1 });

        res.json(chapters);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
};

// ==================== READ SINGLE CHAPTER WITH META ====================
exports.readChapter = async (req, res) => {
    try {
        const { storyId, chapterId } = req.params;

        const chapter = await Chapter.findOne({ _id: chapterId, storyId });
        if (!chapter) return res.status(404).json({ error: "Chapter not found" });

        chapter.views += 1;
        await chapter.save();

        const branchCount = await Chapter.countDocuments({ parentChapterId: chapter._id });

        const story = await Story.findById(storyId).select("cover tags");

        res.json({
            ...chapter.toObject(),
            branchCount,
            cover: story?.cover || null,
            tags: story?.tags || []
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


// ==================== GET BRANCHES OF A CHAPTER ====================
exports.getBranches = async (req, res) => {
    try {
        const branches = await Chapter.find({ parentChapterId: req.params.chapterId }).sort({ createdAt: 1 });
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
        const branches = await Chapter.find({
            author: req.user._id,
            isMainBranch: false
        })
            .populate({
                path: "storyId",
                select: "title cover tags branchesCount",
                populate: {
                    path: "author",
                    select: "username"
                }
            })
            .populate("author", "username")
            .sort({ createdAt: -1 });

        // Shape the response to match the Story card format used in the frontend
        const formatted = branches.map(branch => ({
            _id: branch._id,
            branchTitle: branch.branchTitle,
            chapterTitle: branch.title,
            chapterNumber: branch.chapterNumber,
            createdAt: branch.createdAt,
            likes: branch.likes,
            views: branch.views,
            tags: branch.tags,
            // Story info for the card display
            story: branch.storyId
                ? {
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
                : null
        }));

        res.json(formatted);
    } catch (err) {
        console.error("GET MY BRANCHES ERROR:", err);
        res.status(500).json({ error: err.message });
    }
};
