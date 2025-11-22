const express = require("express");
const router = express.Router();
const AuthController = require("../Controller/AuthController");

router.post("/signup", AuthController.Signup);
router.post("/login", AuthController.Login);
router.get("/verify/:token", AuthController.Verify);

module.exports = router;
