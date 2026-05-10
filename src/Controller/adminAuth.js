const User = require("../Models/Users");
const { hashPassword, comparePassword } = require("../Utils/hashPassword");
const generateToken = require("../Utils/generateToken");

/**
 * POST /api/admin/signup
 *
 * Creates a new admin account. Protected by a server-side secret so
 * only authorised callers (e.g. a super-admin script or an existing admin
 * dashboard) can create new admins.
 *
 * Header required:  x-admin-secret: <ADMIN_SECRET from .env>
 */
exports.AdminSignup = async (req, res) => {
    try {
        // 1. Gate with the admin secret header
        const secret = req.headers["x-admin-secret"];
        if (!secret || secret !== process.env.ADMIN_SECRET) {
            return res.status(403).json({ msg: "Forbidden: invalid admin secret" });
        }

        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ msg: "All fields are required" });
        }

        if (password.length < 6) {
            return res.status(400).json({ msg: "Password must be at least 6 characters" });
        }

        // 2. Check for duplicate email
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ msg: "Email already exists" });
        }

        // 3. Create admin user (verified immediately — no email step needed for admins)
        const hashed = await hashPassword(password);
        const admin = await User.create({
            username,
            email,
            password: hashed,
            role: "admin",
            verified: true,       // skip email verification for admin accounts
        });

        res.status(201).json({
            msg: "Admin created successfully",
            admin: {
                _id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role,
            },
        });
    } catch (err) {
        console.error("AdminSignup error:", err);
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

/**
 * POST /api/admin/login
 *
 * Authenticates an admin. Returns a JWT on success.
 * The JWT payload is identical to the regular user token — the `protectAdmin`
 * middleware is what enforces the role check on protected routes.
 */
exports.AdminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ msg: "Email and password are required" });
        }

        // 1. Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: "Invalid credentials" });
        }

        // 2. Check password
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: "Invalid credentials" });
        }

        // 3. Enforce admin role
        if (user.role !== "admin") {
            return res.status(403).json({ msg: "Access denied: not an admin account" });
        }

        // 4. Issue token
        const token = generateToken(user._id);

        res.status(200).json({
            msg: "Admin login successful",
            token,
            admin: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
        });
    } catch (err) {
        console.error("AdminLogin error:", err);
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

/**
 * GET /api/admin/me   (protected by protectAdmin middleware)
 *
 * Returns the currently logged-in admin's profile.
 */
exports.getAdminProfile = async (req, res) => {
    try {
        const admin = await User.findById(req.user._id).select("-password");
        if (!admin) return res.status(404).json({ msg: "Admin not found" });

        res.status(200).json({
            _id: admin._id,
            username: admin.username,
            email: admin.email,
            role: admin.role,
        });
    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};