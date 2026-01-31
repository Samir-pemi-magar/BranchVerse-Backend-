const Chapter = require("../Models/Chapter");
const Story = require("../Models/StoryModel");

// ==================== CREATE CHAPTER ====================
exports.createChapter = async (req, res) => {
    try {
        const { storyId, title, content, parentChapterId, branchTitle } = req.body;

        // Determine next chapter number
        const lastChapter = await Chapter.findOne({ storyId }).sort({ chapterNumber: -1 });
        const chapterNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1;

        const chapter = await Chapter.create({
            storyId,
            title,
            content,
            parentChapterId: parentChapterId || null,
            isMainBranch: !parentChapterId,
            branchTitle: parentChapterId ? (branchTitle || "Untitled Branch") : null,
            chapterNumber,
            author: req.user.id,
        });

        res.status(201).json({ chapterId: chapter._id, message: "Chapter created successfully" });
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

// ==================== LIKE CHAPTER ====================
exports.likeChapter = async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.chapterId);
        if (!chapter) return res.status(404).json({ error: "Chapter not found" });

        if (!chapter.likedBy.includes(req.user._id)) {
            chapter.likes += 1;
            chapter.likedBy.push(req.user._id);
            await chapter.save();
        }

        res.json({ likes: chapter.likes });
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

        const populated = await Chapter.findById(req.params.chapterId)
            .populate("comments.user", "username");

        res.json(populated.comments);
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
