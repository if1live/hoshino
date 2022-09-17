/**
 * Module dependencies.
 */

import express from "express";
import http from "node:http";
import * as eio from "engine.io";

const app = express();
const server = http.createServer(app);
const io = eio.attach(server, {
  cors: {
    origin: "http://127.0.0.1:5173",
  },
});

io.on("connection", (socket) => {
  socket.on("message", () => {
    socket.send("pong");
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log("\x1B[96mlistening on localhost:" + port + " \x1B[39m");
});
