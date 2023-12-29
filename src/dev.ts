import { FunctionDefinition, standalone } from "serverless-standalone";
import * as http_main from "./handlers/http_main.js";
import * as sqs_main from "./handlers/sqs_main.js";
import * as ws_main from "./handlers/ws_main.js";
import { redis } from "./instances/redis.js";
import { ConnectionRepository } from "./repositories.js";
import * as settings from "./settings.js";

const definitions: FunctionDefinition[] = [
  {
    name: `hoshino-${settings.STAGE}-httpMain`,
    handler: http_main.dispatch,
    events: [
      { httpApi: { route: "ANY /" } },
      { httpApi: { route: "ANY /{pathname+}" } },
    ],
  },
  {
    name: `hoshino-${settings.STAGE}-sqsMain`,
    handler: sqs_main.dispatch,
    events: [
      {
        sqs: {
          queueName: `hoshino-${settings.STAGE}-ws`,
          batchSize: 1,
          enabled: true,
        },
      },
    ],
  },
  {
    name: `karin-${settings.STAGE}-wsMain`,
    handler: ws_main.dispatch,
    events: [
      { websocket: { route: "$connect" } },
      { websocket: { route: "$disconnect" } },
      { websocket: { route: "$default" } },
    ],
  },
];

const options = {
  httpApi: { port: 3000 },
  websocket: { port: 3001 },
  lambda: { port: 3002 },
  sqs: { url: "http://127.0.0.1:9324" },
};

const inst = standalone({
  ...options,
  functions: definitions,
});
await inst.start();
console.log("standalone", options);

// 서버 재시작되면 기존 커넥션은 어차피 못쓴다.
// const repo = new ConnectionRepository(redis);
// await repo.clear();
