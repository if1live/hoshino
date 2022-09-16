import * as dotenv from "@tinyhttp/dotenv";
import * as eio from "engine.io-client";
import { setTimeout } from "node:timers/promises";

dotenv.config();

const socket = new eio.Socket(host, {
  path: "/main",
  transports: ["websocket"],
});

socket.on("handshake", (data) => console.log("handshake", data));
socket.on("message", (data) => console.log("message", data));
socket.on("ping", () => console.log("ping"));
socket.on("pong", () => console.log("pong"));
socket.on("error", (data) => console.log("error", data));
socket.on("close", (data) => console.log("close", data));

socket.on("open", async () => {
  console.log("open");

  for (let i = 0; i < 2; i++) {
    await setTimeout(1000);
    const message = `${Date.now()}`;
    socket.send(message, {});
  }

  await setTimeout(1000);
  socket.close();
});

// send initial packet
const ws: WebSocket = socket.transport.ws;
const fn_onopen_initial = ws.onopen!.bind(ws);
ws.onopen = async () => {
  ws.send("6handshake");
  await fn_onopen_initial();
};
