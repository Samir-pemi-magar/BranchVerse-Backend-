const https = require("http");
require("dotenv").config();

const data = JSON.stringify({
  username: "admin",
  email: "admin@example.com",
  password: "securepassword"
});

const options = {
  hostname: "localhost",
  port: 4000,
  path: "/api/admin/signup",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-admin-secret": process.env.ADMIN_SECRET,
    "Content-Length": Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  let body = "";
  res.on("data", (chunk) => body += chunk);
  res.on("end", () => console.log("✅ Response:", JSON.parse(body)));
});

req.on("error", (err) => console.error("❌ Error:", err.message));
req.write(data);
req.end();