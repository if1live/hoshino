import { Packet } from "engine.io-parser";
import { MySocketPolicy } from "./engine/MySocket.js";
import { encodePacketAsync } from "./engine/helpers.js";

// TODO: 핸들러 정책을 어디에서 관리하지?
const socket = new MySocketPolicy();

socket.on("message", async (sock, data) => {
  // latency example
  if (data === "ping") {
    await sock.send("pong");
    return;
  }

  console.log("my_message", sock.id, data);

  // TODO: 간단하게 echo 구현
  await sock.send(data);

  // TODO: ping 야매로 보내기
  // TODO: ping은 독립적으로 전송되도록 바뀌어야한다
  {
    const packet: Packet = { type: "ping" };
    const encoded = await encodePacketAsync(packet);
    await sock.send(encoded, { wsPreEncoded: encoded });
  }
});

socket.on("close", (sock, reason) => {
  console.log("my_close", sock.id, reason);
});

socket.on("error", (sock, error) => {
  console.log("my_error", sock.id, error);
});

socket.on("heartbeat", (sock) => {
  console.log("my_heartbeat", sock.id);
});

export const apps = {
  handlers_socket: socket,
};
