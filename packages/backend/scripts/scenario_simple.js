import * as dotenv from "@tinyhttp/dotenv";
import { default as WebSocket } from "ws";
import { setTimeout } from "timers/promises";

dotenv.config();

// const host = 'ws://127.0.0.1:3001';
const host = process.env.WS_URL;

async function main() {
  console.log(`init	${Date.now()}`);

  // status=200 or 401
  const ws = new WebSocket(`${host}?status=200`);
  ws.onopen = () => {
    console.log(`open	${Date.now()}`);

    ws.send(`ping`);
    console.log(`ping	${Date.now()}`);
  };

  ws.onclose = () => {
    console.log(`close	${Date.now()}`);
  };

  ws.onerror = () => {
    console.log(`error	${Date.now()}`);
  };

  ws.onmessage = (ev) => {
    console.log(`message	${Date.now()}	${ev.data}`);
  };

  await setTimeout(3000);
  ws.close();
}
await main();
