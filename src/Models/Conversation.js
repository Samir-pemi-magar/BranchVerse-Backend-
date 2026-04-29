const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
    {
        // "dm" for direct messages, "group" for group chats
        type: {
            type: String,
            enum: ["dm", "group"],
            required: true,
        },

        // All participants (2 for DM, 2+ for group)
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
        ],

        // Group-only fields
        name: {
            type: String,
            default: "",
            trim: true,
        },
        groupAdmin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        groupPicture: {
            type: mongoose.Schema.Types.ObjectId,
            default: null, // stored in GridFS, same as profilePicture
        },

        // Latest message reference (for conversation list previews)
        latestMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },
    },
    { timestamps: true }
);

// Prevent duplicate DM conversations between the same two users
conversationSchema.index(
    { type: 1, participants: 1 },
    { unique: false } // uniqueness is enforced in the controller logic for DMs
);

module.exports = mongoose.model("Conversation", conversationSchema);