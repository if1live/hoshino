import RedisMock from "ioredis-mock";
import type { Redis } from "ioredis";

export function createMockRedis(port?: number) {
  const redisMock: Redis = new RedisMock(port);

  // https://github.com/stipsan/ioredis-mock/issues/962#issuecomment-679202886
  const hscan_prev = redisMock.hscan;
  const hscan_next = async (key, ...args) => {
    // ioredis-mock.hscan의 리턴값이 redis와 달라서 우회
    const result_prev = await (hscan_prev as any)(key, ...args);
    const [cursor, fields] = result_prev as [string, string[]];

    const trueResults: (string | null)[] = [];

    const values = await redisMock.hmget(key, ...fields);
    for (let i = 0; i < fields.length; i++) {
      trueResults.push(fields[i]);
      trueResults.push(values[i]);
    }

    return [cursor, trueResults];
  };
  redisMock.hscan = hscan_next as any;

  return redisMock;
}
