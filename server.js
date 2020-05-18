const express = require("express");
const http = require("http");
const socketio = require("socket.io");

const app = express();
const port = process.env.PORT | 3030;
const server = http.Server(app);
const io = socketio(server);
server.listen(port);

app.use(express.static("public"));
console.log(
  "\x1b[32;2m%s\x1b[0m",
  `Server running on http://localhost:${port}`
);
/**
 * list of members connected to server
 */
let members = [];

io.on("connection", (socket) => {
  console.log("\x1b[36m%s\x1b[0m", `Socket connected     :: ${socket.id} `);
  // member joined server
  socket.on("join", (nickName) => {
    members.push({ socketId: socket.id, nickName });
    io.emit("newMember", members);
  });
  // member making offer
  socket.on("makeOffer", ({ to, offer, nickName }) => {
    socket.to(to).emit("receiveOffer", { offer, from: socket.id, nickName });
  });
  // recipient of offer responds with answer
  socket.on("makeAnswer", ({ to, answer }) => {
    socket.to(to).emit("receiveAnswer", { answer, from: socket.id });
  });
  // request to end video call
  socket.on("closeVideoCall", (socketId) => {
    socket.to(socketId).emit("closeVideoCall");
  });

  socket.on("disconnect", () => {
    members = members.filter((member) => member.socketId != socket.id);
    console.log("\x1b[91m%s\x1b[0m", `Socket disconnected  :: ${socket.id} `);
    io.emit("newMember", members);
  });
});
