require("dotenv").config();
const mongoose = require("mongoose");
const Achievement = require("./src/Models/Achivements");

mongoose.connect(process.env.MONGO_URL).then(async () => {
    await Achievement.insertMany([
        {
            name: "Legendary Author",
            description: "Write your first story",
            icon: "📖",
            points: 50
        },
        {
            name: "Loved by All",
            description: "Receive 500 likes",
            icon: "❤️",
            points: 100
        }
    ]);

    console.log("Achievements seeded!");
    mongoose.disconnect();
});