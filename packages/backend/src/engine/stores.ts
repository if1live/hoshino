import { Redis } from "ioredis";

// https://docs.aws.amazon.com/ko_kr/apigateway/latest/developerguide/limits.html

/** @summary WebSocket API 연결 기간 */
export const WS_CONNECTION_DURATION_SECONDS = 2 * 3600;

/** @summary 유휴 연결 제한 시간 */
export const WS_IDLE_CONNECTION_TIMEOUT_SECONDS = 10 * 60;

export interface ConnectionModel {
  connectionId: string;
  endpoint: string;

  ts_connect: number;
  ts_touch: number;
}

function createKey(id: string) {
  return `connection:${id}`;
}

export class ConnectionStore {
  constructor(private readonly redis: Redis) {}

  public async set(id: string, model: ConnectionModel): Promise<void> {
    const key = createKey(id);
    const value = JSON.stringify(model);
    await this.redis.setex(key, WS_CONNECTION_DURATION_SECONDS, value);
  }

  public async get(id: string): Promise<ConnectionModel | null> {
    const key = createKey(id);
    const value = await this.redis.get(key);
    if (value) {
      const obj = JSON.parse(value);
      return obj as ConnectionModel;
    } else {
      return null;
    }
  }

  public async del(id: string): Promise<void> {
    const key = createKey(id);
    await this.redis.del(key);
  }

  public async touch(id: string, ts: number): Promise<void> {
    const prev = await this.get(id);
    if (!prev) {
      return;
    }

    const next: typeof prev = {
      ...prev,
      ts_touch: ts,
    };
    const key = createKey(id);
    const text = JSON.stringify(next);
    await this.redis.set(key, text, "KEEPTTL");
  }
}
