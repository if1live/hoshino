import { default as Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL!;
const url = new URL(REDIS_URL);

export const redis = new Redis({
  host: url.hostname,
  port: parseInt(url.port, 10),
  password: url.password,
  lazyConnect: true,
});
