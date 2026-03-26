const User = require("../Models/Users");
const Achievement = require("../Models/Achivements");

const checkAchievements = async (userId) => {
    const user = await User.findById(userId).populate("achievements.achievement");
    if (!user) return [];
    const newAchievements = [];
    console.log("totalStoriesWritten:", user.totalStoriesWritten);

    // Example: Legendary Author
    if (user.totalStoriesWritten >= 1 && !user.achievements.find(a => a.achievement?.name === "Legendary Author")) {
        const achievement = await Achievement.findOne({ name: "Legendary Author" });
        console.log("Found achievement:", achievement);
        if (achievement) {
            user.achievements.push({ achievement: achievement._id });
            newAchievements.push(achievement);
        }
    }

    // Example: Loved by All
    if (user.totalLikes >= 500 && !user.achievements.find(a => a.achievement?.name === "Loved by All")) {
        const achievement = await Achievement.findOne({ name: "Loved by All" });
        if (achievement) {
            user.achievements.push({ achievement: achievement._id });
            newAchievements.push(achievement);
        }
    }

    await user.save();
    return newAchievements;
};

module.exports = checkAchievements;