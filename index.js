require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/database");
const authRoutes = require("./src/Router/authRoutes");
const app = express();
app.use(express.json());
app.use(
    cors({
        origin: "http://localhost:3000",
        credentials: true,
    })
);
app.use("/api/auth", authRoutes);
connectDB();
const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));