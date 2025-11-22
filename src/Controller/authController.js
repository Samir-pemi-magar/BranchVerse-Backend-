const User = require("../Models/Users");
const { hashPassword, comparePassword } = require("../Utils/hashPassword");
const generateToken = require("../Utils/generateToken");
const sendVerificationEmail = require("../Utils/VerificationMailer");
const jwt = require("jsonwebtoken");

//this is Signup page
exports.Signup = async (req, res) => {
    try {
        console.log("this is signup")
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ msg: "Email alredy exists" });
        const hashed = await hashPassword(password);
        const user = await User.create({ username, email, password: hashed });
        const token = generateToken(user._id);
        await sendVerificationEmail(email, token);
        res.status(201).json({ msg: "Signup successful", user });
    }
    catch (err) {
        res.status(500).json({ msg: "Server error", error: err });
    }
}
//this is Login page
exports.Login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: "User not found" });
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Invalid Password" });
        if (!user.verified) return res.status(400).json({ msg: "Please verify your email first" });
        const token = generateToken(user._id);
        res.status(201).json({ msg: "Login Sucessful", token });
    }
    catch (err) {
        res.status(500).json({ msg: "Server error", error: err });
    }
}
exports.Verify = async (req, res) => {
    try {
        const data = jwt.verify(req.params.token, process.env.JWT_SECRET);

        await User.findByIdAndUpdate(data.id, { verified: true });

        res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verified</title>
        <style>
          body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #ffffff; /* plain white background */
            margin: 0;
          }
          .container {
            background: #fff;
            padding: 40px 60px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            text-align: center;
          }
          h1 {
            color: #10B981;
            margin-bottom: 20px;
          }
          p {
            color: #374151;
            font-size: 18px;
          }
          a {
            display: inline-block;
            margin-top: 25px;
            padding: 10px 25px;
            background: #3B82F6;
            color: white;
            border-radius: 6px;
            text-decoration: none;
            font-weight: bold;
            transition: 0.3s;
          }
          a:hover {
            background: #2563EB;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✔ Email Verified!</h1>
          <p>Thank you for verifying your email. You can now log in to your account.</p>
          <a href="http://localhost:3000/auth/login">Go to Login</a>
        </div>
      </body>
      </html>
    `);
    } catch (err) {
        res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification Failed</title>
        <style>
          body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #ffffff; /* plain white background */
            margin: 0;
          }
          .container {
            background: #fff;
            padding: 40px 60px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            text-align: center;
          }
          h1 {
            color: #EF4444;
            margin-bottom: 20px;
          }
          p {
            color: #374151;
            font-size: 18px;
          }
          a {
            display: inline-block;
            margin-top: 25px;
            padding: 10px 25px;
            background: #EF4444;
            color: white;
            border-radius: 6px;
            text-decoration: none;
            font-weight: bold;
            transition: 0.3s;
          }
          a:hover {
            background: #B91C1C;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Verification Failed</h1>
          <p>The verification link is invalid or has expired.</p>
          <a href="http://localhost:3000/signup">Try Again</a>
        </div>
      </body>
      </html>
    `);
    }
};




