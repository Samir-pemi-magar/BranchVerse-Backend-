const User = require("../Models/Users");
const Achievement = require("../Models/Achivements");

const checkAchievements = async (userId) => {
    const user = await User.findById(userId);
    if (!user) return [];

    const newAchievements = []; // ✅ declare it

    const legendary = await Achievement.findOne({ name: "Legendary Author" });
    const loved = await Achievement.findOne({ name: "Loved by All" });

    if (!legendary || !loved) {
        console.log("Achievements not found in DB");
        return [];
    }

    if (!user.achievements) user.achievements = [];

    const userAchievementIds = user.achievements.map(a =>
        a.achievement?._id
            ? a.achievement._id.toString()
            : a.achievement.toString()
    );

    if (user.totalStoriesWritten >= 1 && !userAchievementIds.includes(legendary._id.toString())) {
        user.achievements.push({ achievement: legendary._id });
        newAchievements.push(legendary);
    }

    if (user.totalLikes >= 500 && !userAchievementIds.includes(loved._id.toString())) {
        user.achievements.push({ achievement: loved._id });
        newAchievements.push(loved);
    }

    await user.save();
    return newAchievements;
};

module.exports = checkAchievements;