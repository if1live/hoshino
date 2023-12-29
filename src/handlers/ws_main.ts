import { setTimeout } from "node:timers/promises";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
  APIGatewayProxyWebsocketEventV2,
  Context,
} from "aws-lambda";
import { Packet, decodePacket, encodePacket } from "engine.io-parser";
import { apps } from "../apps.js";
import { MySocket, MySocketPolicy } from "../engine/MySocket.js";
import { encodePacketAsync } from "../engine/helpers.js";
import {
  Command_Handshake,
  Command_Schedule,
  Handshake,
  defaultHandshake,
} from "../engine/types.js";
import { createQueueUrl, sqsClient, sqsEndpoint } from "../instances/aws.js";
import { redis } from "../instances/redis.js";
import {
  ConnectionAction,
  ConnectionModel,
  ConnectionRepository,
} from "../repositories.js";
import * as settings from "../settings.js";

const { handlers_socket } = apps;

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
  const sock = new MySocket(connectionId, endpoint);

  const resp_ok: APIGatewayProxyResult = {
    statusCode: 200,
    body: "OK",
  };

  const packet = decodePacket(event.body, "arraybuffer");

  // engine.io 패킷으로의 파싱 처리에 실패한 경우, message로 취급
  // engine.io-client를 쓴다면 여기 진입하는 일은 없다.
  // wscat같은 툴로 손으로 패킷 넣다가 "4" 붙이는거 까먹었을떄 발생하는 에러일듯.
  if (packet.type === "error" && packet.data === "parser error") {
    const packet: Packet = { type: "message", data: event.body };
    const data = `pong,${connectionId},${packet.data}`;
    await sock.send(data);
    return resp_ok;
  }

  switch (packet.type) {
    case "open": {
      // 웹소켓 구현에서 서버가 open 받는 일은 없다.
      return resp_ok;
    }
    case "close": {
      // 명세를 보면 "Used to indicate that a transport can be closed."
      // 명세로는 존재하는데 어떤 상황에서 사용되는 패킷인지 모르겠다.
      // 서버에서 close(), 클라에서 close() 둘다 해당되진 않던데.
      // 폴링에서 사용되는 패킷으로 추정된다. engine.io 저장소를 뜯어보면
      // polling.ts에는 있는데 `this.send([{ type: "close" }]);`
      // websocket.ts에서는 보이지 않는다.
      return resp_ok;
    }
    case "ping": {
      // v4 프로토콜은 ping의 시작이 서버라서 ping 패킷을 받을 일은 없다.
      return resp_ok;
    }
    case "pong": {
      // TODO: ping의 올바른 답을 받은 경우
      // 1. 커넥션의 수명을 연장한다
      // 2. 핸들러 호출하기. event emitter?
      await handlers_socket.dispatch_heartbeat(sock);
      return resp_ok;
    }
    case "message": {
      await handlers_socket.dispatch_message(sock, packet.data);
      return resp_ok;
    }
    case "upgrade": {
      // upgrade는 websocket에서는 필요 없다.
      return resp_ok;
    }
    case "noop": {
      return resp_ok;
    }
    case "error": {
      // TODO: ??
      return resp_ok;
    }
    default: {
      const x: never = packet.type;
      return resp_ok;
    }
  }
};

const fn_connect = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId ?? "";
  const requestAt = new Date(event.requestContext.requestTimeEpoch);
  const endpoint = deriveEndpoint(event);

  // TODO: 핸들러로 빠져야한다
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

  // 람다에서는 웹소켓 connect에서 자신한테 메세지를 보낼 경우 410 gone이 발생한다.
  // 클라의 onopen에서 패킷 하나 보내서 서버 로직을 돌리는것도 생각했으나 engine.io 명세와 달라진다.
  // SQS 핸들러를 무료처럼 쓸수 있게 되어서 그냥 SQS로 때웠다.
  // connect 붙은 다음에 SQS가 돌아가도록 적당히 시간 손대면 되지 않을까?
  const command: Command_Handshake = {
    tag: "handshake",
    connectionId,
    endpoint,
    ts_connect: model.ts_connect,
  };
  const queueName = `hoshino-${settings.STAGE}-ws`;
  const queueUrl = createQueueUrl(sqsEndpoint, queueName);
  const output = await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(command),
    }),
  );

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

  // TODO: 핸들러로 빠져야한다
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
