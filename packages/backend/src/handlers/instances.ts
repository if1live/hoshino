import type { Handler } from "aws-lambda";
import { default as Redis } from "ioredis";
import { setTimeout } from "node:timers/promises";

const REDIS_URL = process.env.REDIS_URL!;
const url = new URL(REDIS_URL);

// typescript 4.8에서 에러 발생. 4.7로는 되는거같은데?
export const redis: Redis.Redis = new (Redis as any)({
  host: url.hostname,
  port: parseInt(url.port, 10),
  password: url.password,
  // https://github.com/luin/ioredis/issues/1123#issuecomment-920905876
  enableAutoPipelining: true,
  enableOfflineQueue: false,
  lazyConnect: true,
});

// redislabs의 무료 redis는 동시 접속이 30개로 제한된다
// 비효율적이지만 일단 돌아가게 만드려고 요청 시작과 끝에서 redis 연결을 제어
export const wrapHandler_redis = <T1, T2>(
  handler: Handler<T1, T2>
): Handler<T1, T2> => {
  return async (event, context, callback) => {
    await redis.connect();
    const result = await handler(event, context, callback);

    // redis.disconnect는 리턴이 Promise가 아니다
    // 문서상에서 즉시 끊어진다고 되어있지만 약간 밀리는 느낌?
    await redis.quit();
    await setTimeout(10);

    return result as any;
  };
};
