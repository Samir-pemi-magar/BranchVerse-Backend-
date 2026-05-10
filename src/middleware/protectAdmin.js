const jwt = require("jsonwebtoken");
const User = require("../Models/Users");

/**
 * protectAdmin middleware
 *
 * Use this on any route that should only be accessible to admins.
 * Stack it after (or instead of) your regular `protect` middleware.
 *
 * Usage in routes:
 *   router.get("/dashboard", protectAdmin, adminDashboardHandler);
 */
const protectAdmin = async (req, res, next) => {
    try {
        // 1. Extract Bearer token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ msg: "No token provided" });
        }

        const token = authHeader.split(" ")[1];

        // 2. Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Load user from DB (ensures account still exists)
        const user = await User.findById(decoded.id).select("-password");
        if (!user) {
            return res.status(401).json({ msg: "User not found" });
        }

        // 4. Enforce admin role
        if (user.role !== "admin") {
            return res.status(403).json({ msg: "Access denied: admins only" });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error("protectAdmin error:", err.message);
        return res.status(401).json({ msg: "Invalid or expired token" });
    }
};

module.exports = protectAdmin;