const mongoose = require("mongoose");

const chapterSchema = new mongoose.Schema({
    storyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Story",
        required: true
    },

    title: { type: String, required: true },
    content: { type: String, required: true },

    parentChapterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Chapter",
        default: null
    },

    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Chapter", chapterSchema);
