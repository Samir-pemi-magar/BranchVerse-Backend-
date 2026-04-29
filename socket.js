const { Server } = require("socket.io");

function initSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: "http://localhost:3000",
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);

        // Join room (important for DM/group chat later)
        socket.on("joinRoom", (roomId) => {
            socket.join(roomId);
            console.log(`User joined room: ${roomId}`);
        });

        // Send message event
        socket.on("sendMessage", (data) => {
            // data = { roomId, message }
            io.to(data.roomId).emit("receiveMessage", data.message);
        });

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
        });
    });

    return io;
}

module.exports = initSocket;