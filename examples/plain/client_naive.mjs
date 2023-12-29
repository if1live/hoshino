import { setTimeout } from "timers/promises";
import { default as WebSocket } from "ws";

const host = process.env.WS_URL ?? "ws://127.0.0.1:3001";

async function main() {
  console.log(`init	${Date.now()}`);

  const ws = new WebSocket(`${host}/engine.io/?EIO=4&transport=websocket`);
  ws.onopen = () => {
    console.log(`open	${Date.now()}`);

    ws.send('4ping');
    console.log(`ping	${Date.now()}`);
  };

  ws.onclose = () => {
    console.log(`close	${Date.now()}`);
  };

  ws.onerror = () => {
    console.log(`error	${Date.now()}`);
  };

  /**
   * @param {MessageEvent} ev 
   */
  ws.onmessage = (ev) => {
    console.log(`message	${Date.now()}	${ev.data} [${ev.data.constructor.name}]`);
  };

  await setTimeout(3000);
  ws.close();
}
await main();
