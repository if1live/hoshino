import {
  APIGatewayProxyHandler,
  Context,
  DynamoDBStreamHandler,
  ScheduledHandler,
  SQSHandler,
} from "aws-lambda";
import { decodePacket } from "engine.io-parser";
import { mapLimit } from "async";
import { nanoid } from "nanoid";
import { defaultHandshake, MySocket } from "../engine/engine.js";
import {
  ConnectionModel,
  ConnectionStore,
  ConnectionStore_Redis,
  ConnectionStore_DynamoDB,
} from "../engine/stores.js";
import { dynamodb, redis, sqs } from "../handlers/instances.js";
import { app } from "../app.js";
import {
  SendMessageBatchCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";

// const store = new ConnectionStore_Redis(redis);
const store: ConnectionStore = new ConnectionStore_DynamoDB(dynamodb);

interface Message_Handshake {
  tag: "handshake";
  connectionId: string;
  endpoint: string;
}

interface Message_Heartbeat {
  tag: "heartbeat";
  connectionId: string;
  endpoint: string;
}

type Message = Message_Handshake | Message_Heartbeat;
const delaySeconds_heartbeat = Math.floor(defaultHandshake.pingInterval / 1000);

function createQueueUrl(context: Context) {
  // https://www.radishlogic.com/aws/lambda/how-to-get-the-aws-account-id-in-lambda-python/
  const tokens = context.invokedFunctionArn.split(":");
  const region = tokens[3];
  const awsAccountId = tokens[4];
  const queueUrl = `https://sqs.${region}.amazonaws.com/${awsAccountId}/hoshino-main-task`;
  return queueUrl;
}

const connect: APIGatewayProxyHandler = async (event, context) => {
  const socket = app.registeSocketListener(MySocket.fromEvent(event, store));

  console.log({ tag: "ws_connect", id: socket.id });

  const ts_connect = event.requestContext.connectedAt ?? Date.now();
  const seconds_connect = ts_connect / 1000.0;
  const model = await socket.eio_connect(seconds_connect);

  const message_handshake: Message_Handshake = {
    tag: "handshake",
    connectionId: model.connectionId,
    endpoint: model.endpoint,
  };
  const message_heartbeat: Message_Heartbeat = {
    tag: "heartbeat",
    connectionId: model.connectionId,
    endpoint: model.endpoint,
  };

  const command = new SendMessageBatchCommand({
    QueueUrl: createQueueUrl(context),
    Entries: [
      {
        Id: nanoid(),
        MessageBody: JSON.stringify(message_handshake),
        DelaySeconds: 1,
      },
      {
        Id: nanoid(),
        MessageBody: JSON.stringify(message_heartbeat),
        DelaySeconds: delaySeconds_heartbeat,
      },
    ],
  });
  const result = await sqs.send(command);

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
    case "open":
    case "upgrade": {
      console.log(parsed.type, parsed.data);
      await socket.eio_close(`unhandled packet: ${parsed.type}`);
      break;
    }
    case "error": {
      console.log("error", parsed.data);
      await socket.eio_close("parse error");
      break;
    }
  }

  return {
    statusCode: 200,
    body: "OK",
  };
};

export const schedule: ScheduledHandler = async (event) => {
  if (store.tag === "redis") {
    const redisStore = store as ConnectionStore_Redis;
    const models = await redisStore.dump();

    const seconds_now = Date.now() / 1000.0;
    await mapLimit(models, 5, async (model: ConnectionModel) => {
      const socket = app.registeSocketListener(
        new MySocket(model.connectionId, model.endpoint, store)
      );
      await socket.schedule(model, seconds_now);
    });
  }
};

export const handle_task: SQSHandler = async (event, context) => {
  for (const record of event.Records) {
    const obj = JSON.parse(record.body);
    const message = obj as Message;
    const socket = new MySocket(message.connectionId, message.endpoint, store);

    switch (message.tag) {
      case "handshake": {
        await sqs_handshake(socket, message, context);
        break;
      }
      case "heartbeat": {
        await sqs_heartbeat(socket, message, context);
        break;
      }
    }
  }
};

const sqs_handshake = async (
  socket: MySocket,
  message: Message_Handshake,
  context: Context
) => {
  await socket.eio_handshake();
  await app.handle_open(socket);
};

const sqs_heartbeat = async (
  socket: MySocket,
  message: Message_Heartbeat,
  context: Context
) => {
  const seconds_now = Date.now() / 1000.0;
  const model = await store.get(message.connectionId);
  if (!model) {
    // 연결이 사라진 이후에 SQS가 처리된거. 무시
    return;
  }

  const result = await socket.schedule(model, seconds_now);
  switch (result) {
    case "dead":
    case "timeout": {
      // timeout과 비슷하게 처리된 경우에는 schedule에서 알아서 대응한다
      break;
    }

    case "ping": {
      // loop
      const message_heartbeat: Message = {
        ...message,
        tag: "heartbeat",
      };
      const command = new SendMessageCommand({
        QueueUrl: createQueueUrl(context),
        MessageBody: JSON.stringify(message_heartbeat),
        DelaySeconds: delaySeconds_heartbeat,
      });
      await sqs.send(command);
      break;
    }
  }
};

export const handlers_engine = {
  connect,
  disconnect,
  dispatch,
  schedule,
  handle_task,
};
