import { default as Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL!;
const url = new URL(REDIS_URL);

// typescript 4.8에서 에러 발생. 4.7로는 되는거같은데?
export const redis: Redis.Redis = new (Redis as any)({
  host: url.hostname,
  port: parseInt(url.port, 10),
  password: url.password,
  lazyConnect: true,
});
