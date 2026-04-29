const express = require("express");
const router = express.Router();
const protect = require("../middleware/Protect"); // your existing JWT middleware
const {
    getOrCreateDM,
    createGroup,
    renameGroup,
    addToGroup,
    removeFromGroup,
    getMyConversations,
} = require("../Controller/ChatController");

router.use(protect); // all chat routes require auth

router.get("/", getMyConversations);           // GET  /api/chat
router.get("/dm/:userId", getOrCreateDM);      // GET  /api/chat/dm/:userId
router.post("/group", createGroup);            // POST /api/chat/group
router.put("/group/:conversationId/rename", renameGroup);   // PUT
router.put("/group/:conversationId/add", addToGroup);       // PUT
router.put("/group/:conversationId/remove", removeFromGroup); // PUT

module.exports = router;