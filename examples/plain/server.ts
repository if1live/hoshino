import http from "node:http";
import { setTimeout } from "node:timers/promises";
import * as eio from "engine.io";

/*
https://github.com/socketio/engine.io
공식 문서에 정의된 이벤트 대부분 넣어봄
*/

const server = http.createServer();
const io = eio.attach(server, {
  transports: ["websocket"],
  path: "/",
});

/** Fired when a new connection is established. */
io.on("connection", async (socket) => {
  console.log("open", {
    id: socket.id,
    readyState: socket.readyState,
  });

  socket.on("heartbeat", () => console.log("heartbeat"));

  /** Fired when the client sends a message. */
  socket.on("message", (data: string | Buffer) => {
    // 편의상 echo
    socket.send(data);
  });

  /** Fired when an error occurs. */
  socket.on("error", (err: Error) => console.log("error", err));

  /** Fired when the client is disconnected. */
  socket.on("close", (reason: string) => console.log("close", reason));

  // 명시적으로 ping 호출하는거 테스트
  await setTimeout(1_000);
  socket.send("ping", {
    wsPreEncoded: "2probe",
  });
});

/**
 * Fired on the first request of the connection, before writing the response headers
 * Arguments
 * headers (Object): a hash of headers
 * req (http.IncomingMessage): the request
 */
io.on("initial_headers", (headers, req) => {
  console.log("initial_headers");
});

/**
 * Fired on the all requests of the connection, before writing the response headers
 * Arguments
 * headers (Object): a hash of headers
 * req (http.IncomingMessage): the request
 */
io.on("headers", (headers, req) => {
  console.log("headers");
});

/**
 * Fired when an error occurs when establishing the connection.
 * Arguments
 * error: an object with following properties:
 * req (http.IncomingMessage): the request that was dropped
 * code (Number): one of Server.errors
 * message (string): one of Server.errorMessages
 * context (Object): extra info about the error
 */
io.on("connection_error", (err, socket) => {
  console.log("connection_error", err, socket);
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`\x1B[96mlistening on localhost:${port} \x1B[39m`);
});
