require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");

const connectDB = require("./src/config/database");

// Routes
const authRoutes = require("./src/Router/authRoutes");
const storyRoutes = require("./src/Router/storyRoutes");
const chapterRoutes = require("./src/Router/ChaptersRoutes");
const achievementRoutes = require("./src/Router/achivementsRouter");
const followRoutes = require("./src/Router/followRoutes");
const chatRoutes = require("./src/Router/ChatRoutes");
const messageRoutes = require("./src/Router/Messageroutes");

// Socket
const initSocket = require("./socket");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
    cors({
        origin: "http://localhost:3000",
        credentials: true,
    })
);

// DB
connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/chapters", chapterRoutes);
app.use("/api/achievements", achievementRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

// Server + Socket
const server = http.createServer(app);
const io = initSocket(server);

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});