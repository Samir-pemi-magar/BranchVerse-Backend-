const express = require("express");
const router = express.Router();
const protect = require("../middleware/Protect");
const {
    sendMessage,
    getMessages,
    markAsRead,
    deleteMessage,
} = require("../Controller/MessageController");

router.use(protect);

router.post("/", sendMessage);                         // POST /api/message
router.get("/:conversationId", getMessages);           // GET  /api/message/:conversationId
router.put("/:messageId/read", markAsRead);            // PUT  /api/message/:id/read
router.delete("/:messageId", deleteMessage);           // DELETE /api/message/:id

module.exports = router;