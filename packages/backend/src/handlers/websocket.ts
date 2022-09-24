import {
  APIGatewayProxyWebsocketHandlerV2,
  DynamoDBStreamHandler,
  ScheduledHandler,
  SQSHandler,
} from "aws-lambda";
import { handlers_engine } from "../examples/index.js";
import { wrapHandler_redis } from "./instances.js";

// 갈아끼우기 쉬운 구조로
// export const { connect, disconnect, dispatch } = handlers_naive;
export const handlers = handlers_engine;

// export const connect = wrapHandler_redis(handlers.connect);
// export const disconnect = wrapHandler_redis(handlers.disconnect);
// export const dispatch = wrapHandler_redis(handlers.dispatch);
// export const schedule = wrapHandler_redis(handlers.schedule);

export const connect = handlers.connect;
export const disconnect = handlers.disconnect;
export const dispatch = handlers.dispatch;
export const schedule = handlers.schedule;
export const handle_task = handlers.handle_task;
