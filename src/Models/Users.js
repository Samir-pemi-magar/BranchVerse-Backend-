const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    verified: {
        type: Boolean,
        default: false
    },
    preferences: {
        genres: { type: [String], default: [] },
        interests: { type: String, default: "" },
    },

    description: { type: String, default:      "" },
    profilePicture: { type: mongoose.Schema.Types.ObjectId, default: null },

    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    contact: {
        facebook: { type: String, default: "" },
        instagram: { type: String, default: "" }
    },
    totalStoriesWritten: { type: Number, default: 0 },
    totalLikes: { type: Number, default: 0 },
    totalStoriesBranched: { type: Number, default: 0 },

    achievements: [{
        achievement: { type: mongoose.Schema.Types.ObjectId, ref: "Achievement" },
        dateUnlocked: { type: Date, default: Date.now }
    }],
    points: { type: Number, default: 0 }

}, { timestamps: true });
module.exports = mongoose.model("User", userSchema);