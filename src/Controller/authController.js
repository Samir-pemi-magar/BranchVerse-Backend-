const mongoose = require("mongoose");
const User = require("../Models/Users");
const { hashPassword, comparePassword } = require("../Utils/hashPassword");
const generateToken = require("../Utils/generateToken");
const sendVerificationEmail = require("../Utils/VerificationMailer");
const jwt = require("jsonwebtoken");
const getGridFS = require("../config/Gridfs");
const checkAchievements = require("../Utils/achivement");

exports.Signup = async (req, res) => {
  try {
    console.log("this is signup");
    console.log("Received body:", req.body); // <--- add this
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      console.log("Missing fields!", req.body);
      return res.status(400).json({ msg: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: "Email already exists" });

    const hashed = await hashPassword(password);
    const user = await User.create({ username, email, password: hashed });
    const token = generateToken(user._id);
    await sendVerificationEmail(email, token);
    res.status(201).json({ msg: "Signup successful", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error", error: err });
  }
};
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
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });

    const profilePictureUrl = user.profilePicture
      ? `${req.protocol}://${req.get("host")}/api/auth/profile/image/${user.profilePicture}`
      : null;

    res.status(200).json({
      username: user.username,
      email: user.email,
      id: user.id,
      description: user.description,
      profilePicture: profilePictureUrl,
      followers: user.followers,
      following: user.following,
      preferences: user.preferences,
      totalStoriesWritten: user.totalStoriesWritten,  // only this user's count
      totalLikes: user.totalLikes,                    // only this user's count
      totalStoriesBranched: user.totalStoriesBranched, // only this user's count
      contact: user.contact
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

exports.getPublicProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });

    const profilePictureUrl = user.profilePicture
      ? `${req.protocol}://${req.get("host")}/api/auth/profile/image/${user.profilePicture}`
      : null;

    res.status(200).json({
      id: user.id,
      username: user.username,
      description: user.description,
      profilePicture: profilePictureUrl,
      followers: user.followers,
      following: user.following,
      totalStoriesWritten: user.totalStoriesWritten,
      totalLikes: user.totalLikes,
      totalStoriesBranched: user.totalStoriesBranched,
      contact: user.contact,
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    // Find the logged-in user
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const { username, email, description, contact } = req.body;

    // Update username if provided
    if (username) user.username = username;

    // Update email if provided & check uniqueness
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ msg: "Email already in use" });
      }
      user.email = email;
    }

    // Update description
    if (description) user.description = description;

    // Update contact (gmail, facebook, instagram)
    if (contact) {
      user.contact = {
        ...user.contact, // keep existing fields if not updated
        ...contact
      };
    }

    // Handle profile picture upload via GridFS
    if (req.file) {
      const gridfsBucket = getGridFS();
      const uploadStream = gridfsBucket.openUploadStream(
        Date.now() + "-" + req.file.originalname,
        { contentType: req.file.mimetype }
      );

      uploadStream.end(req.file.buffer);

      // Handle upload errors
      uploadStream.on("error", (err) => {
        console.error("GridFS upload error:", err);
        return res.status(500).json({ msg: "Image upload failed", error: err.message });
      });

      // When upload finishes
      uploadStream.on("finish", async () => {
        user.profilePicture = uploadStream.id; // store valid ObjectId
        await user.save();

        // Build full URL for frontend
        const profilePictureUrl = `${req.protocol}://${req.get("host")}/api/auth/profile/image/${uploadStream.id}`;

        // Send response with updated user and image URL
        res.status(200).json({ msg: "Profile updated!", user: { ...user.toObject(), profilePicture: profilePictureUrl } });
      });

      return; // prevent sending response before upload finishes
    }

    // Save updates if no file uploaded
    await user.save();
    res.status(200).json({ msg: "Profile updated!", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};
// Save user preferences
exports.savePreferences = async (req, res) => {
  try {
    const { genres, interests } = req.body;

    if (!genres || !Array.isArray(genres) || genres.length === 0) {
      return res.status(400).json({ msg: "Select at least one genre" });
    }

    // req.user is added by the protect middleware
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    user.preferences = { genres, interests };
    await user.save();

    res.status(200).json({ msg: "Preferences saved!", preferences: user.preferences });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("preferences");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (!user.preferences || !user.preferences.genres?.length) {
      return res.status(200).json({ preferences: null });
    }

    res.status(200).json({ preferences: user.preferences });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getProfilePicture = async (req, res) => {
  try {
    const gridfsBucket = getGridFS();
    const fileId = new mongoose.Types.ObjectId(req.params.id);

    const downloadStream = gridfsBucket.openDownloadStream(fileId);

    // Handle download errors
    downloadStream.on("error", (err) => {
      console.error("GridFS download error:", err);
      res.status(404).json({ msg: "Image not found" });
    });

    downloadStream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(400).json({ msg: "Invalid image id" });
  }
};

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




