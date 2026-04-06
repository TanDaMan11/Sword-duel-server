const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const rooms = {};

function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("create_room", (data) => {
    const code = data.code;
    rooms[code] = {
      players: [socket.id],
      gameOver: false
    };
    socket.join(code);
    console.log(`Room ${code} created by ${socket.id}`);
    socket.emit("room_created", { code });
  });

  socket.on("join_room", (data) => {
    const code = data.code;
    if (rooms[code] && rooms[code].players.length < 2) {
      rooms[code].players.push(socket.id);
      socket.join(code);
      console.log(`Player ${socket.id} joined room ${code}`);
      socket.emit("room_joined", { code });
      socket.to(code).emit("player_joined");
    } else {
      socket.emit("error", { message: "Room full or not found" });
    }
  });

  socket.on("start_game", (data) => {
    const code = data.room;
    if (rooms[code]) {
      console.log(`Game starting in room ${code}`);
      io.to(code).emit("game_start");
    }
  });

  socket.on("game_state", (data) => {
    const code = data.room;
    if (rooms[code]) {
      socket.to(code).emit("game_state", {
        playerId: data.playerId,
        x: data.x,
        y: data.y,
        vx: data.vx,
        vy: data.vy,
        health: data.health,
        attacking: data.attacking,
        facingRight: data.facingRight
      });
    }
  });

  socket.on("game_over", (data) => {
    const code = data.room;
    if (rooms[code]) {
      console.log(`Game over in room ${code}. Winner: ${data.winner}`);
      rooms[code].gameOver = true;
      io.to(code).emit("game_over", { winner: data.winner });
    }
  });

  socket.on("rematch_ready", (data) => {
    const code = data.room;
    if (rooms[code]) {
      console.log(`Player ${socket.id} is ready for rematch in room ${code}`);
      socket.to(code).emit("rematch_ready");
    }
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    for (const code in rooms) {
      if (rooms[code].players.includes(socket.id)) {
        rooms[code].players = rooms[code].players.filter(id => id !== socket.id);
        io.to(code).emit("player_left");
        if (rooms[code].players.length === 0) {
          delete rooms[code];
          console.log(`Room ${code} deleted`);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
