import { setTimeout } from "node:timers/promises";
import { faker } from "@faker-js/faker";
import { assert, beforeAll, describe, it } from "vitest";
import { createRedis_mock } from "../src/instances/redis.js";
import { ConnectionModel, ConnectionRepository } from "../src/repositories.js";

describe("ConnectionRepository", async () => {
  const redis = await createRedis_mock();
  const repo = new ConnectionRepository();

  const createModel = (): ConnectionModel => {
    const id = faker.string.uuid();
    return {
      connectionId: id,
      endpoint: faker.internet.url(),
      ts_connect: 1_000,
      ts_touch: 1_000,
    };
  };

  it("get: not exist", async () => {
    const actual = await repo.get(redis, "invalid");
    assert.equal(actual, null);
  });

  describe("get: exists", async () => {
    const model = createModel();
    beforeAll(async () => repo.setAsync(redis, model));

    it("get", async () => {
      const actual = await repo.get(redis, model.connectionId);
      assert.deepEqual(actual, model);
    });
  });

  it("del: not exist", async () => {
    const actual = await repo.del(redis, "invalid");
    assert.equal(actual, 0);
  });

  describe("del: exists", async () => {
    const model = createModel();
    beforeAll(async () => repo.setAsync(redis, model));

    it("del", async () => {
      const actual = await repo.del(redis, model.connectionId);
      assert.equal(actual, 1);
    });

    it("get: not exists", async () => {
      const found = await repo.get(redis, model.connectionId);
      assert.equal(found, null);
    });
  });

  describe("set: ttl", () => {
    const model = createModel();
    const key = ConnectionRepository.createKey(model.connectionId);

    it("not saved", async () => {
      // -2 = key does not exist
      assert.equal(await redis.expiretime(key), -2);
    });

    it("keep ttl", async () => {
      // 한번 설정된 ttl은 바뀌지 않는다.
      // aws websocket api는 웹소켓 커넥션 생성 시점에서 수명이 결정되니까
      await repo.setAsync(redis, model);
      const actual_a = await redis.expiretime(key);

      await setTimeout(10);

      await repo.setAsync(redis, model);
      const actual_b = await redis.expiretime(key);

      assert.equal(actual_a, actual_b);
      assert.isTrue(actual_a > 0);
    });
  });
});
