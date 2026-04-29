const Message = require("../Models/Message");
const Conversation = require("../Models/Conversation");

// POST /api/message — send a message
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, content } = req.body;

        if (!conversationId || !content?.trim())
            return res.status(400).json({ msg: "conversationId and content are required" });

        const conversation = await Conversation.findById(conversationId);
        if (!conversation)
            return res.status(404).json({ msg: "Conversation not found" });

        // Make sure the sender is actually in this conversation
        if (!conversation.participants.map(String).includes(req.user._id.toString()))
            return res.status(403).json({ msg: "You are not part of this conversation" });

        let message = await Message.create({
            conversation: conversationId,
            sender: req.user._id,
            content: content.trim(),
            readBy: [req.user._id], // sender has already "read" their own message
        });

        // Update latestMessage on the conversation (keeps inbox list fresh)
        await Conversation.findByIdAndUpdate(conversationId, {
            latestMessage: message._id,
        });

        message = await Message.findById(message._id).populate(
            "sender",
            "username profilePicture"
        );

        res.status(201).json(message);
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// GET /api/message/:conversationId — fetch messages (paginated, newest first)
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const skip = (page - 1) * limit;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation)
            return res.status(404).json({ msg: "Conversation not found" });

        if (!conversation.participants.map(String).includes(req.user._id.toString()))
            return res.status(403).json({ msg: "Access denied" });

        const messages = await Message.find({ conversation: conversationId })
            .populate("sender", "username profilePicture")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Message.countDocuments({ conversation: conversationId });

        res.status(200).json({
            messages: messages.reverse(), // return oldest-first for UI rendering
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalMessages: total,
        });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// PUT /api/message/:messageId/read — mark a message as read by the current user
exports.markAsRead = async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        if (!message) return res.status(404).json({ msg: "Message not found" });

        if (!message.readBy.map(String).includes(req.user._id.toString())) {
            message.readBy.push(req.user._id);
            await message.save();
        }

        res.status(200).json({ msg: "Marked as read" });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// DELETE /api/message/:messageId — soft delete (sender only)
exports.deleteMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        if (!message) return res.status(404).json({ msg: "Message not found" });

        if (message.sender.toString() !== req.user._id.toString())
            return res.status(403).json({ msg: "You can only delete your own messages" });

        message.isDeleted = true;
        message.content = "[deleted]";
        await message.save();

        res.status(200).json({ msg: "Message deleted" });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};