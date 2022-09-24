import { expect } from "expect";
import { faker } from "@faker-js/faker";
import {
  ConnectionModel,
  ConnectionStore,
  ConnectionStore_Redis,
} from "../../src/engine/stores.js";
import { createMockRedis } from "../tools.js";

function createConnectionModel() {
  const id = faker.random.alphaNumeric(8);
  const model: ConnectionModel = {
    connectionId: id,
    endpoint: faker.internet.url(),
    seconds_connect: 1000,
    seconds_touch: 1000,
  };
  return model;
}

describe("ConnectionStore", () => {
  const redis = createMockRedis();
  const store = new ConnectionStore_Redis(redis);

  it("get: not exist", async () => {
    const found = await store.get("invalid");
    expect(found).toBeNull();
  });

  it("del: not exists", async () => {
    const result = await store.del("not-exist");
    expect(result).toBe(false);
  });

  it("del: exists", async () => {
    const model = createConnectionModel();
    const id = model.connectionId;
    await store.set(id, model);

    const result = await store.del(id);
    expect(result).toBe(true);
  });

  it("scenario", async () => {
    const model = createConnectionModel();
    const id = model.connectionId;

    await store.set(id, model);

    const found = await store.get(id);
    expect(found).toEqual(model);

    await store.del(id);
    expect(await store.get(id)).toBe(null);
  });

  it("touch", async () => {
    const model = createConnectionModel();
    const id = model.connectionId;
    await store.set(id, model);

    const ts_next = 1234;
    await store.touch(id, ts_next);

    const found = await store.get(id);
    expect(found?.seconds_touch).toBe(ts_next);
  });
});

describe("ConnectionStore#dump", () => {
  const redis = createMockRedis(faker.internet.port());
  const store = new ConnectionStore_Redis(redis);

  // hscan으로 여러번 가져오는거 확인하려고 큰수 넣음
  const models = Array.from({ length: 2345 }).map((x) =>
    createConnectionModel()
  );

  before(async () => {
    await store.mset(models);
  });

  after(async () => {
    await redis.flushall();
  });

  it("dump", async () => {
    const founds = await store.dump();
    const ids_initial = models.map((x) => x.connectionId).sort();
    const ids_founds = founds.map((x) => x.connectionId).sort();
    expect(ids_initial).toEqual(ids_founds);
  });
});
