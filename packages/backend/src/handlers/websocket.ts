import { handlers_naive, handlers_engine } from "../examples/index.js";
import { redis } from "./instances.js";

// keep-alive 구현하려면 결국 db가 필요하다
await redis.connect();

// 갈아끼우기 쉬운 구조로
// export const { connect, disconnect, dispatch } = handlers_naive;
export const { connect, disconnect, dispatch } = handlers_engine;
