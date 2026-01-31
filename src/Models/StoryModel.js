const mongoose = require("mongoose");

const storySchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },

    tags: {
        type: [String],
        required: true,
    },

    description: String,

    cover: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },

    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },

    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            text: String,
            createdAt: { type: Date, default: Date.now }
        }
    ],

    branchAllowed: { type: Boolean, default: false },

    // ✅ NEW FIELD
    branchesCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],


    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Story", storySchema);
