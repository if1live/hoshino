import { APIGatewayProxyHandler } from "aws-lambda";
import { decodePacket } from "engine.io-parser";
import { deriveEndpoint } from "../engine/helpers.js";
import { WebSocketHandler } from "./types.js";
import * as Engine from "../engine/engine.js";

const connect_engine: APIGatewayProxyHandler = async (event, context) => {
  return {
    statusCode: 200,
    body: "OK",
  };
};

const disconnect_engine: APIGatewayProxyHandler = async (event, context) => {
  return {
    statusCode: 200,
    body: "OK",
  };
};

const dispatch_engine: APIGatewayProxyHandler = async (event, context) => {
  const body = event.body ?? "";
  const parsed = decodePacket(body);

  const connection: Engine.Connection = {
    connectionId: event.requestContext.connectionId!,
    endpoint: deriveEndpoint(event),
  };

  switch (parsed.type) {
    case "noop": {
      // 람다에서는 웹소켓 connect에서 자신한테 메세지를 보낼 경우 410 gone이 발생한다
      // 그렇다고 연결 이후에 서버에서 알아서 로직을 돌릴수 있는것도 아니다.
      // 이를 우회하려고 noop에 예약어 추가해서 클라에서 웹소켓 연결 즉시 메세지를 보내도록 했다
      if (parsed.data === "handshake") {
        await Engine.handshake(connection);
      }
      break;
    }
    case "message": {
      // echo
      const text = parsed.data;
      await Engine.send(connection, text);

      break;
    }
    case "ping": {
      await Engine.ping(connection, parsed);
      break;
    }
    case "close": {
      await Engine.close(connection);
      break;
    }
    case "error": {
      console.log("error", parsed.data);
      await Engine.close(connection);
      break;
    }
    default: {
      console.log(parsed.type, parsed.data);
      await Engine.close(connection);
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
