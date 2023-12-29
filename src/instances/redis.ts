import { Redis } from "ioredis";
import * as settings from "../settings.js";

export const createRedis_real = async (): Promise<Redis> => {
  // fly.io upstash redis 쓰러면 family 6 필수
  const redis = new Redis(settings.REDIS_URL, {
    lazyConnect: true,
    // family: 6,
  });
  await redis.connect();
  return redis;
};

export const createRedis_mock = async (): Promise<Redis> => {
  const RedisMock = await import("ioredis-mock");
  type MockConstructor = typeof RedisMock.redisMock;
  const Mock = RedisMock.default as any as MockConstructor;
  const redis: Redis = new Mock();
  return redis;
};

export const createRedis = async (): Promise<Redis> => {
  return process.env.NODE_ENV === "test"
    ? await createRedis_mock()
    : await createRedis_real();
};

export const redis = await createRedis();
