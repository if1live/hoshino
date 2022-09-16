import httpPkg from "node:http";
import * as engine from "engine.io";

const http = httpPkg.createServer().listen(3001);
const server = engine.attach(http, {});

server.on("connection", (socket) => {
  console.log("connection", socket.id);

  socket.send("utf 8 string");
  // socket.send(Buffer.from([0, 1, 2, 3, 4, 5])); // binary data

  socket.on("message", (data: any) => {
    console.log("message", data);
  });
});
