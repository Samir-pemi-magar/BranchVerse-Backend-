const Achievement = require("../Models/Achivements");
const User = require("../Models/Users");


// GET ALL ACHIEVEMENTS
exports.getAllAchievements = async (req, res) => {
    try {
        const achievements = await Achievement.find();
        res.json(achievements);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// GET LOGGED-IN USER ACHIEVEMENTS
exports.getUserAchievements = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate("achievements.achievement");

        if (!user) return res.status(404).json({ msg: "User not found" });

        const userAchievements = user.achievements.map(a => a.achievement);
        res.json(userAchievements);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

