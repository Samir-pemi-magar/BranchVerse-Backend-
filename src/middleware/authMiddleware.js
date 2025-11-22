const jwt = require("jsonwebtoken");
const User = require("../Models/Users");

const protect = async (req, res) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWR_SECRET);
            req.user = await User.findById(decode.id).select("password");
            next();
        } catch (err) {
            return res.status(401).json({ msg: "Not authorized, token failed" });
        }
    }
    if (!token) {
        return res.status(401).json({ msg: "No token, authorization denied" });
    }
};
module.exports = protect;