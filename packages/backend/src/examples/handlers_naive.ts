import type { APIGatewayProxyHandler, ScheduledHandler } from "aws-lambda";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { deriveEndpoint } from "../engine/helpers.js";

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

const schedule_naive: ScheduledHandler = async (event) => {};

export const handlers_naive = {
  connect: connect_naive,
  disconnect: disconnect_naive,
  dispatch: dispatch_naive,
  schedule: schedule_naive,
};
