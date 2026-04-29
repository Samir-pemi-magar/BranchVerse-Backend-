const Conversation = require("../Models/Conversation");
const Message = require("../Models/Message");

// GET or CREATE a DM between logged-in user and another user (idempotent)
exports.getOrCreateDM = async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const { userId } = req.params;

        if (currentUserId.toString() === userId)
            return res.status(400).json({ msg: "Cannot start a DM with yourself" });

        let conversation = await Conversation.findOne({
            type: "dm",
            participants: { $all: [currentUserId, userId], $size: 2 },
        })
            .populate("participants", "-password")
            .populate("latestMessage");

        if (conversation) return res.status(200).json(conversation);

        conversation = await Conversation.create({
            type: "dm",
            participants: [currentUserId, userId],
        });

        conversation = await Conversation.findById(conversation._id).populate(
            "participants",
            "-password"
        );

        res.status(201).json(conversation);
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// POST /api/chat/group — create group chat, creator becomes admin
exports.createGroup = async (req, res) => {
    try {
        const { name, participants } = req.body;

        if (!name || !Array.isArray(participants) || participants.length < 2)
            return res.status(400).json({ msg: "Name and at least 2 participants required" });

        const allParticipants = [...new Set([req.user._id.toString(), ...participants])];

        const group = await Conversation.create({
            type: "group",
            name: name.trim(),
            participants: allParticipants,
            groupAdmin: req.user._id,
        });

        const populated = await Conversation.findById(group._id)
            .populate("participants", "-password")
            .populate("groupAdmin", "-password");

        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// PUT /api/chat/group/:conversationId/rename — admin only
exports.renameGroup = async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.conversationId);
        if (!conversation || conversation.type !== "group")
            return res.status(404).json({ msg: "Group not found" });

        if (conversation.groupAdmin.toString() !== req.user._id.toString())
            return res.status(403).json({ msg: "Admin only" });

        conversation.name = req.body.name?.trim() || conversation.name;
        await conversation.save();

        const populated = await Conversation.findById(conversation._id)
            .populate("participants", "-password")
            .populate("groupAdmin", "-password");

        res.status(200).json(populated);
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// PUT /api/chat/group/:conversationId/add — admin only
exports.addToGroup = async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.conversationId);
        if (!conversation || conversation.type !== "group")
            return res.status(404).json({ msg: "Group not found" });

        if (conversation.groupAdmin.toString() !== req.user._id.toString())
            return res.status(403).json({ msg: "Admin only" });

        if (conversation.participants.map(String).includes(req.body.userId))
            return res.status(400).json({ msg: "User already in group" });

        conversation.participants.push(req.body.userId);
        await conversation.save();

        const populated = await Conversation.findById(conversation._id)
            .populate("participants", "-password")
            .populate("groupAdmin", "-password");

        res.status(200).json(populated);
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// PUT /api/chat/group/:conversationId/remove — admin or self-remove
exports.removeFromGroup = async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.conversationId);
        if (!conversation || conversation.type !== "group")
            return res.status(404).json({ msg: "Group not found" });

        const isAdmin = conversation.groupAdmin.toString() === req.user._id.toString();
        const isSelf = req.body.userId === req.user._id.toString();

        if (!isAdmin && !isSelf)
            return res.status(403).json({ msg: "Not authorised" });

        conversation.participants = conversation.participants.filter(
            (p) => p.toString() !== req.body.userId
        );
        await conversation.save();

        const populated = await Conversation.findById(conversation._id)
            .populate("participants", "-password")
            .populate("groupAdmin", "-password");

        res.status(200).json(populated);
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// GET /api/chat — all conversations for the logged-in user
exports.getMyConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({ participants: req.user._id })
            .populate("participants", "-password")
            .populate("groupAdmin", "-password")
            .populate({
                path: "latestMessage",
                populate: { path: "sender", select: "username profilePicture" },
            })
            .sort({ updatedAt: -1 });

        res.status(200).json(conversations);
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};