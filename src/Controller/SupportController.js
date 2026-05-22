const SupportMessage = require("../Models/SupportMessage");

// POST /api/support  — public, no auth required
exports.submitMessage = async (req, res) => {
    try {
        const { issueType, message, storyId, storyTitle } = req.body;
        if (!issueType || !message?.trim())
            return res.status(400).json({ msg: "Issue type and message are required" });

        await SupportMessage.create({
            issueType,
            message: message.trim(),
            storyId: storyId || null,
            storyTitle: storyTitle || null,
        });
        res.status(201).json({ msg: "Message received. Thank you!" });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// GET /api/admin/support  — admin only
exports.getMessages = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const filter = req.query.unread === "true" ? { read: false } : {};

        const [messages, total] = await Promise.all([
            SupportMessage.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
            SupportMessage.countDocuments(filter),
        ]);

        res.json({ messages, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// PATCH /api/admin/support/:id/read  — mark as read
exports.markRead = async (req, res) => {
    try {
        await SupportMessage.findByIdAndUpdate(req.params.id, { read: true });
        res.json({ msg: "Marked as read" });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};