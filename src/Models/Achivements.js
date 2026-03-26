const mongoose = require("mongoose");

const achievementSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, required: true }, // emoji, URL, or GridFS ID
    points: { type: Number, default: 0 }, // optional gamification points
    unlockedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

module.exports = mongoose.model("Achievement", achievementSchema);