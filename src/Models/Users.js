const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        require: true
    },
    email: {
        type: String,
        require: true
    },
    password: {
        type: String,
        require: true
    },
    verified: {
        type: Boolean,
        default: false
    },
    preferences: {
        genres: { type: [String], default: [] },
        interests: { type: String, default: "" },
    },
});
module.exports = mongoose.model("User", userSchema);