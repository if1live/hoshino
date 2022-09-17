import * as dotenv from "@tinyhttp/dotenv";
import * as eio from "engine.io-client";
import { setTimeout } from "node:timers/promises";

dotenv.config();

const url = new URL(process.env.WS_URL!);
const opts: Partial<eio.SocketOptions> = {
  transports: ["websocket"],
};
if (url.pathname !== "/") {
  opts["path"] = url.pathname;
}
const socket = new eio.Socket(url.origin, opts);

socket.on("handshake", (data) => console.log("handshake", data));
socket.on("message", (data) => console.log("message", data));
socket.on("ping", () => console.log("ping"));
socket.on("pong", () => console.log("pong"));
socket.on("error", (data) => console.log("error", data));
socket.on("close", (data) => console.log("close", data));

socket.on("open", async () => {
  console.log("open");

  // socket.send("command:info", {});
  // await setTimeout(1000);

  for (let i = 0; i < 2; i++) {
    const message = `${Date.now()}`;
    socket.send(message, {});
    await setTimeout(1000);
  }

  // socket.send("command:ping", {});
  // await setTimeout(1000);

  // socket.send("command:info", {});
  // await setTimeout(1000);

  socket.send("ping", {});
  await setTimeout(1000);

  socket.send("command:close", {});
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
