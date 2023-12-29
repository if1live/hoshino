# hoshino

engine.io v4 implementation for AWS Lambda.
based on [AWS WebSocket API](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html)

* [engine.io-protocol](https://github.com/socketio/engine.io-protocol)
* [engine.io](https://github.com/socketio/engine.io)

![hoshino](./docs/hoshino-execution.jpg)

## start

### prepare

```sh
pnpm install
```

### deploy

```
# deploy backend
cd ./packages/backends
cp .env.sample .env
pnpm sls deploy
...

✔ Service deployed to stack hoshino-main (265s)

endpoints:
  wss://abcdefghij.execute-api.ap-northeast-1.amazonaws.com/main
  ANY - https://abcdefghij.execute-api.ap-northeast-1.amazonaws.com
functions:
  ...
```
### test engine.io from script

```sh
cd ./packages/backends
edit .env
WS_URL="wss://abcdefghij.execute-api.ap-northeast-1.amazonaws.com/main"

pnpm ts-node-esm ./scripts/scenario_engine.ts
```

### examples-latency

examples from engine.io
https://github.com/socketio/engine.io/tree/main/examples/latency

```
cd ./packages/examples-latency
cp .env.sample .env
edit .env
VITE_WS_URL="wss://abcdefghij.execute-api.ap-northeast-1.amazonaws.com/main"

pnpm dev
```
