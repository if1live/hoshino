import { APIGatewayProxyHandler } from "aws-lambda";
import { decodePacket } from "engine.io-parser";
import { deriveEndpoint } from "../engine/helpers.js";
import { WebSocketHandler } from "./types.js";
import * as Engine from "../engine/engine.js";
import { ConnectionModel, ConnectionStore } from "../engine/stores.js";
import { redis } from "../handlers/instances.js";
import { app } from "../app.js";

const connect_engine: APIGatewayProxyHandler = async (event, context) => {
  const connectionId = event.requestContext.connectionId!;
  const endpoint = deriveEndpoint(event);
  const ts_now = Date.now();
  const ts_connect = event.requestContext.connectedAt ?? ts_now;

  const model: ConnectionModel = {
    connectionId,
    endpoint,
    ts_connect: ts_connect,
    ts_touch: ts_connect,
  };

  const store = new ConnectionStore(redis);
  await store.set(model.connectionId, model);

  return {
    statusCode: 200,
    body: "OK",
  };
};

const disconnect_engine: APIGatewayProxyHandler = async (event, context) => {
  const connectionId = event.requestContext.connectionId!;
  const endpoint = deriveEndpoint(event);

  const connection: Engine.Connection = {
    connectionId,
    endpoint,
  };

  const socket = new Engine.Socket(connection);
  app.handle_close(socket, "blank");

  const store = new ConnectionStore(redis);
  await store.del(connectionId);

  return {
    statusCode: 200,
    body: "OK",
  };
};

const dispatch_engine: APIGatewayProxyHandler = async (event, context) => {
  const connectionId = event.requestContext.connectionId!;
  const endpoint = deriveEndpoint(event);

  const body = event.body ?? "";
  const parsed = decodePacket(body);

  const connection: Engine.Connection = {
    connectionId,
    endpoint,
  };
  const socket = new Engine.Socket(connection);

  const store = new ConnectionStore(redis);

  switch (parsed.type) {
    case "noop": {
      // 람다에서는 웹소켓 connect에서 자신한테 메세지를 보낼 경우 410 gone이 발생한다
      // 그렇다고 연결 이후에 서버에서 알아서 로직을 돌릴수 있는것도 아니다.
      // 이를 우회하려고 noop에 예약어 추가해서 클라에서 웹소켓 연결 즉시 메세지를 보내도록 했다
      if (parsed.data === "handshake") {
        await Engine.handshake(connection);
        app.handle_open(socket);
      }
      break;
    }
    case "message": {
      await app.handle_message(socket, parsed.data);
      break;
    }
    case "ping": {
      await store.touch(connectionId, Date.now());
      await Engine.heartbeat_pong(connection, parsed.data);
      break;
    }
    case "pong": {
      await store.touch(connectionId, Date.now());
      break;
    }
    case "close": {
      await socket.close();
      break;
    }
    case "error": {
      console.log("error", parsed.data);
      await socket.close();
      break;
    }
    default: {
      console.log(parsed.type, parsed.data);
      await socket.close();
      break;
    }
  }

  return {
    statusCode: 200,
    body: "OK",
  };
};

export const handlers_engine: WebSocketHandler = {
  connect: connect_engine,
  disconnect: disconnect_engine,
  dispatch: dispatch_engine,
};
