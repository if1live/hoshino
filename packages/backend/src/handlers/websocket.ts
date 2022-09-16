import type { APIGatewayProxyHandler } from "aws-lambda";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { redis } from "./instances.js";

await redis.connect();

export const connect: APIGatewayProxyHandler = async (event, context) => {
  const connectionId = event.requestContext.connectionId;
  const status = parseInt(event.queryStringParameters?.status ?? "200", 10);

  console.log(`connect: ${Date.now()} ${connectionId} ${status}`);
  return {
    statusCode: status,
    body: "OK",
  };
};

export const disconnect: APIGatewayProxyHandler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  console.log(`disconnect: ${Date.now()} ${connectionId}`);
  return {
    statusCode: 200,
    body: "OK",
  };
};

export const dispatch: APIGatewayProxyHandler = async (event) => {
  const connectionId = event.requestContext.connectionId!;

  // lambda: f3w1jmmhb3.execute-api.ap-northeast-2.amazonaws.com/dev
  // offline: private.execute-api.ap-northeast-2.amazonaws.com/local
  const region = process.env.AWS_REGION;
  const apiId = event.requestContext.apiId;
  const stage = event.requestContext.stage;
  let endpoint = "";
  if (apiId === "private") {
    const port = (event.headers ?? {})["X-Forwarded-Port"] ?? 3001;
    if (port) {
      endpoint = `http://${event.requestContext.identity.sourceIp}:${port}`;
    } else {
      endpoint = `http://${event.requestContext.identity.sourceIp}`;
    }
  } else {
    endpoint = `https://${apiId}.execute-api.${region}.amazonaws.com/${stage}`;
  }

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
