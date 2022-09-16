import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { encodePacket, decodePacket } from "engine.io-parser";
import { redis } from "./instances.js";
import * as Engine from "../engine/index.js";

await redis.connect();

function deriveEndpoint(event: APIGatewayProxyEvent): string {
  // lambda: f3w1jmmhb3.execute-api.ap-northeast-2.amazonaws.com/dev
  // offline: private.execute-api.ap-northeast-2.amazonaws.com/local
  const region = process.env.AWS_REGION;
  const apiId = event.requestContext.apiId;
  const stage = event.requestContext.stage;
  if (apiId === "private") {
    const port = (event.headers ?? {})["X-Forwarded-Port"] ?? 3001;
    if (port) {
      return `http://${event.requestContext.identity.sourceIp}:${port}`;
    } else {
      return `http://${event.requestContext.identity.sourceIp}`;
    }
  } else {
    return `https://${apiId}.execute-api.${region}.amazonaws.com/${stage}`;
  }
}

interface WebSocketHandler {
  connect: APIGatewayProxyHandler;
  disconnect: APIGatewayProxyHandler;
  dispatch: APIGatewayProxyHandler;
}

const connect_naive: APIGatewayProxyHandler = async (event, context) => {
  const connectionId = event.requestContext.connectionId;
  const status = parseInt(event.queryStringParameters?.status ?? "200", 10);

  console.log(`connect: ${Date.now()} ${connectionId} ${status}`);
  return {
    statusCode: status,
    body: "OK",
  };
};

const disconnect_naive: APIGatewayProxyHandler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  console.log(`disconnect: ${Date.now()} ${connectionId}`);
  return {
    statusCode: 200,
    body: "OK",
  };
};

const dispatch_naive: APIGatewayProxyHandler = async (event) => {
  const connectionId = event.requestContext.connectionId!;
  const endpoint = deriveEndpoint(event);
  const data = new TextEncoder().encode(`pong	${connectionId}`);
  const client = new ApiGatewayManagementApiClient({ endpoint });
  await client.send(
    new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: data,
    })
  );

  console.log(`ping	${Date.now()}	${connectionId}`);
  return {
    statusCode: 200,
    body: "OK",
  };
};

const handlers_naive: WebSocketHandler = {
  connect: connect_naive,
  disconnect: disconnect_naive,
  dispatch: dispatch_naive,
};

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

  switch (parsed.type) {
    case "message": {
      console.log("message", parsed.data);

      // echo
      const connectionId = event.requestContext.connectionId!;
      const text = `${connectionId}:${parsed.data}`;
      await Engine.send(event, text);

      break;
    }
    case "noop": {
      if (parsed.data === "handshake") {
        await Engine.handshake(event);
      }
      break;
    }
    case "ping": {
      await Engine.ping(event, parsed);
      break;
    }
    case "error": {
      console.log("error", parsed.data);
      break;
    }
    default: {
      console.log(parsed.type, parsed.data);
      break;
    }
  }

  return {
    statusCode: 200,
    body: "OK",
  };
};

const handlers_engine: WebSocketHandler = {
  connect: connect_engine,
  disconnect: disconnect_engine,
  dispatch: dispatch_engine,
};

// 갈아끼우기 쉬운 구조로
// export const { connect, disconnect, dispatch } = handlers_naive;
export const { connect, disconnect, dispatch } = handlers_engine;
