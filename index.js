require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/database");
const authRoutes = require("./src/Router/authRoutes");
const storyRoutes = require("./src/Router/storyRoutes");
const app = express();
app.use(express.json());
app.use(
    cors({
        origin: "http://localhost:3000",
        credentials: true,
    })
);
app.use("/api/auth", authRoutes);
app.use("api/stories", storyRoutes);
connectDB();
const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));