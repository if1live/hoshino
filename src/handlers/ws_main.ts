import {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
  APIGatewayProxyWebsocketEventV2,
  Context,
} from "aws-lambda";
import { redis } from "../instances/redis.js";
import {
  ConnectionAction,
  ConnectionModel,
  ConnectionRepository,
} from "../repositories.js";
import * as settings from "../settings.js";

export const dispatch: APIGatewayProxyHandler = async (event, context) => {
  const eventType = event.requestContext.eventType;
  switch (eventType) {
    case "CONNECT":
      return await fn_connect(event, context);
    case "DISCONNECT":
      return await fn_disconnect(event, context);
    case "MESSAGE":
      return await fn_message(event as any, context);
    default: {
      throw new Error("unknown event.requestContext.eventType", {
        cause: {
          eventType,
        },
      });
    }
  }
};

const fn_message = async (
  event: APIGatewayProxyWebsocketEventV2,
  context: Context,
) => {
  const connectionId = event.requestContext.connectionId;
  const endpoint = deriveEndpoint(event);
  const client = ConnectionAction.client(endpoint);
  const data = `pong,${connectionId},${event.body}`;
  const output = await ConnectionAction.post(client, connectionId, data);

  return {
    statusCode: 200,
    body: "OK",
  };
};

const fn_connect = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId ?? "";
  const requestAt = new Date(event.requestContext.requestTimeEpoch);
  console.log("connect", { connectionId });

  // TODO: 더 깔끔하게 + service로 교체
  const repo = new ConnectionRepository();
  const model: ConnectionModel = {
    connectionId,
    endpoint: deriveEndpoint(event),
    ts_connect: requestAt.getTime(),
    ts_touch: requestAt.getTime(),
  };
  await repo.setAsync(redis, model);

  return {
    statusCode: 200,
    body: "OK",
  };
};

const fn_disconnect = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId ?? "";
  const requestAt = new Date(event.requestContext.requestTimeEpoch);
  console.log("disconnect", { connectionId });

  // TODO: 더 깔끔하게 + service로 교체
  const repo = new ConnectionRepository();
  await repo.del(redis, connectionId);

  return {
    statusCode: 200,
    body: "OK",
  };
};

function deriveEndpoint(
  event: APIGatewayProxyEvent | APIGatewayProxyWebsocketEventV2,
): string {
  // lambda: f3w1jmmhb3.execute-api.ap-northeast-2.amazonaws.com/dev
  // offline: private.execute-api.ap-northeast-2.amazonaws.com/local
  const region = settings.AWS_REGION;
  const apiId = event.requestContext.apiId;
  const stage = event.requestContext.stage;

  const endpoint_prod = `https://${apiId}.execute-api.${region}.amazonaws.com/${stage}`;

  // APIGatewayProxyWebsocketEventV2로는 포트 정보까지 얻을 수 없다.
  // 로컬이라고 가정되면 좌표가 뻔해서 편법을 써도 된다
  const endpoint_private = settings.WEBSOCKET_URL.replace("ws://", "http://");

  return apiId === "private" ? endpoint_private : endpoint_prod;
}
