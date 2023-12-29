import * as eio from "engine.io-client";
import { setTimeout } from "timers/promises";

/*
https://github.com/socketio/engine.io-client
예제에서는 engine.io-client 의 메세지를 보고 싶어서 처리할수 있는 대부분을 넣었다.
webscoekt만 쓸거라서 upgrade는 안넣었다
*/

const host = process.env.WS_URL ?? "ws://127.0.0.1:3001";
const socket = new eio.Socket(host, {
  path: "/",
  transports: ["websocket"],
});
socket.binaryType = "arraybuffer";

/** Fired upon successful connection. */
socket.on("open", async () => {
  // 핸들러 등록 이후에 원하는 작업을 시작해야한다.
  // 메세지 전송과 message 핸들러 등록의 순서를 바꾸면 응답을 못받을 수 있다.
  console.log(`open: ${new Date().toISOString()}`);

  {
    socket.send("message-text");
    await setTimeout(10);
  }
  
  // TODO: 바이너리 패킷은 aws websocket api 제약과 겹쳐서 더 봐야함
  // {
  //   const arr = new Uint8Array(2);
  //   arr[0] = 0x12;
  //   arr[1] = 0x34;
  //   socket.send(arr);
  //   await setTimeout(10);
  // }

  await setTimeout(60_000);
  socket.close();
});

/**
 * Fired when data is received from the server.
 * Arguments
 * String | ArrayBuffer: utf-8 encoded data or ArrayBuffer containing binary data
 */
socket.on("message", (data) => {
  if (typeof data === "string") {
    console.log(`message_string: ${new Date().toISOString()} ${data}`);
  } else if (data instanceof ArrayBuffer) {
    let line = "";
    for (const byte of new Uint8Array(data)) {
      const hex = byte.toString(16).padStart(2, "0");
      line += `0x${hex} `;
    }
    console.log(`message_arraybuffer: ${new Date().toISOString()} ${line}`);
  } else {
    console.log(`message_unknown: ${new Date().toISOString()} ${data}`);
  }
});

/**
 * Fired upon disconnection.
 * In compliance with the WebSocket API spec, this event may be fired even if the open event does not occur
 * (i.e. due to connection error or close()).
 */
socket.on("close", () => {
  console.log(`close: ${new Date().toISOString()}`);
});

/** Fired when an error occurs. */
socket.on("error", (err) => {
  console.log(`error: ${new Date().toISOString()} ${err}`);
});

/** Fired upon completing a buffer flush */
socket.on("flush", () => {
  console.log(`flush: ${new Date().toISOString()}`);
});

/** Fired after drain event of transport if writeBuffer is empty */
socket.on("drain", () => {
  console.log(`drain: ${new Date().toISOString()}`);
});

/** Fired upon receiving a ping packet. */
socket.on("ping", () => {
  console.log(`ping: ${new Date().toISOString()}`);
});

/** Fired upon flushing a pong packet (ie: actual packet write out) */
socket.on("pong", (x) => {
  console.log(`pong: ${new Date().toISOString()}`);
});
