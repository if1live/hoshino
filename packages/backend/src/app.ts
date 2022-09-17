import * as eio from "engine.io";
import { Socket as MySocket } from "./engine/engine.js";

const server = new eio.Server({
  cors: {
    origin: "http://127.0.0.1:5173",
  },
});

server.on("connection", (socket) => {
  handle_open(socket);
  socket.on("message", (data: any) => handle_message(socket, data));
  socket.on("close", (data: any) => handle_close(socket, data));
});

function extractSocketId(socket: eio.Socket | MySocket): string {
  const id = (socket as any).id;
  return id;
}

async function handle_open(socket: eio.Socket | MySocket) {
  const id = extractSocketId(socket);
  console.log("eio_connection", id);
}

async function handle_message(socket: eio.Socket | MySocket, data: any) {
  console.log("eio_message", data);

  // examples-latency: ping -> pong
  if (data === "ping") {
    await socket.send("pong", {});
  }

  // custom command
  if (data === "command:close") {
    await socket.close();
  }

  // if (data === "command:info") {
  //   const id = (socket as any).id;
  //   const store = new ConnectionStore(redis);
  //   const model = await store.get(id);
  //   await socket.send(JSON.stringify(model), {});
  // }

  // echo
  await socket.send(data, {});
}

async function handle_close(socket: eio.Socket | MySocket, data: any) {
  const id = extractSocketId(socket);
  console.log("eio_close", JSON.stringify({ id, data }));
}

export const app = {
  server,
  handle_open,
  handle_close,
  handle_message,
};
