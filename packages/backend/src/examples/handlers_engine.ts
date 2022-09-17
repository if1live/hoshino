import { APIGatewayProxyHandler, ScheduledHandler } from "aws-lambda";
import { decodePacket } from "engine.io-parser";
import { mapLimit } from "async";
import { WebSocketHandler } from "./types.js";
import { MySocket } from "../engine/engine.js";
import { ConnectionModel, ConnectionStore } from "../engine/stores.js";
import { redis } from "../handlers/instances.js";
import { app } from "../app.js";

const store = new ConnectionStore(redis);

const connect: APIGatewayProxyHandler = async (event, context) => {
  const socket = app.registeSocketListener(MySocket.fromEvent(event, store));

  console.log({ tag: "ws_connect", id: socket.id });

  const ts_connect = event.requestContext.connectedAt ?? Date.now();
  await socket.eio_connect(ts_connect);

  return {
    statusCode: 200,
    body: "OK",
  };
};

const disconnect: APIGatewayProxyHandler = async (event, context) => {
  const socket = app.registeSocketListener(MySocket.fromEvent(event, store));

  console.log({ tag: "ws_disconnect", id: socket.id });

  // 웹소켓 연결을 지우는건 aws에서 하니까 db에서만 지운다
  const deleted = await store.del(socket.id);
  if (deleted) {
    await socket.listener_close("$disconnect");
  }

  return {
    statusCode: 200,
    body: "OK",
  };
};

const dispatch: APIGatewayProxyHandler = async (event, context) => {
  const socket = app.registeSocketListener(MySocket.fromEvent(event, store));

  const body = event.body ?? "";
  const parsed = decodePacket(body);

  switch (parsed.type) {
    case "noop": {
      // 람다에서는 웹소켓 connect에서 자신한테 메세지를 보낼 경우 410 gone이 발생한다
      // 그렇다고 연결 이후에 서버에서 알아서 로직을 돌릴수 있는것도 아니다.
      // 이를 우회하려고 noop에 예약어 추가해서 클라에서 웹소켓 연결 즉시 메세지를 보내도록 했다
      if (parsed.data === "handshake") {
        await socket.eio_handshake();
        await app.handle_open(socket);
      }
      break;
    }
    case "message": {
      await socket.listener_message(parsed.data);
      break;
    }
    case "ping": {
      await store.touch(socket.id, Date.now());
      await socket.eio_pong(parsed.data);
      break;
    }
    case "pong": {
      await store.touch(socket.id, Date.now());
      break;
    }
    case "close": {
      await socket.eio_close("close packet");
      break;
    }
    case "error": {
      console.log("error", parsed.data);
      await socket.eio_close("error packet");
      break;
    }
    default: {
      console.log(parsed.type, parsed.data);
      await socket.eio_close("unhandled packet");
      break;
    }
  }

  return {
    statusCode: 200,
    body: "OK",
  };
};

export const schedule: ScheduledHandler = async (event) => {
  const models = await store.dump();

  const ts_now = Date.now();
  await mapLimit(models, 5, async (model: ConnectionModel) => {
    const socket = app.registeSocketListener(
      new MySocket(model.connectionId, model.endpoint, store)
    );
    await socket.schedule(model, ts_now);
  });
};

export const handlers_engine: WebSocketHandler = {
  connect,
  disconnect,
  dispatch,
  schedule,
};
