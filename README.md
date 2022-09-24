# hoshino

engine.io/socket.io implementation for AWS Lambda

## start

```sh
# prepare
pnpm install

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


# run engine.io test script
edit .env
WS_URL="wss://abcdefghij.execute-api.ap-northeast-1.amazonaws.com/main"
pnpm ts-node-esm ./scripts/scenario_engine.ts

# examples-latency
cd ./packages/examples-latency
cp .env.sample .env

edit .env
VITE_WS_URL="wss://abcdefghij.execute-api.ap-northeast-1.amazonaws.com/main"

pnpm dev
```
