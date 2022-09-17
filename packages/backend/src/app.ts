import * as eio from "engine.io";
import { MySocket } from "./engine/engine.js";

function extractSocketId(socket: eio.Socket | MySocket): string {
  // eio.Socket의 id는 private라서 우회
  // 소켓 ID를 알면 로그 찍을때 유용하니까
  const id = (socket as any).id;
  return id;
}

const server = new eio.Server({
  cors: {
    origin: "http://127.0.0.1:5173",
  },
});

server.on("connection", (socket) => {
  handle_open(socket);
  registeSocketListener(socket);
});

function registeSocketListener(socket: eio.Socket): eio.Socket;
function registeSocketListener(socket: MySocket): MySocket;
function registeSocketListener(socket: eio.Socket | MySocket) {
  socket.on("message", (data: any) => handle_message(socket, data));
  socket.on("close", (data: any) => handle_close(socket, data));
  return socket;
}

async function handle_open(socket: eio.Socket | MySocket) {
  const id = extractSocketId(socket);
  console.log({ tag: "eio_connection", id });
}

async function handle_message(socket: eio.Socket | MySocket, data: any) {
  const id = extractSocketId(socket);
  console.log({ tag: "eio_message", id, data });

  // examples-latency: ping -> pong
  if (data === "ping") {
    await socket.send("pong", {});
    return;
  }

  // custom command
  if (data === "command:close") {
    await socket.close();
    return;
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
  console.log({ tag: "eio_close", id, data });
}

export const app = {
  server,
  handle_open,
  registeSocketListener,
};
