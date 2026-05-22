const mongoose = require("mongoose");

const supportMessageSchema = new mongoose.Schema({
    issueType: {
        type: String,
        enum: ["Bug or error", "Inappropriate content", "Account problem", "Feature request", "Other"],
        required: true,
    },
    message: { type: String, required: true, maxlength: 2000 },
    storyId: { type: mongoose.Schema.Types.ObjectId, ref: "Story", default: null },
    storyTitle: { type: String, default: null }, // snapshot so admin sees title even if story is deleted
    read: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("SupportMessage", supportMessageSchema);