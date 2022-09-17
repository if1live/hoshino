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

const key = "eio:connection";

export class ConnectionStore {
  constructor(private readonly redis: Redis) {}

  public async set(id: string, model: ConnectionModel): Promise<void> {
    if (id !== model.connectionId) {
      throw new Error("invalid input");
    }
    await this.mset([model]);
  }

  public async mset(models: ConnectionModel[]): Promise<void> {
    const args: string[] = [];
    for (const model of models) {
      args.push(model.connectionId);
      args.push(JSON.stringify(model));
    }
    await this.redis.hset(key, ...args);
  }

  public async get(id: string): Promise<ConnectionModel | null> {
    const value = await this.redis.hget(key, id);
    if (value) {
      const obj = JSON.parse(value);
      return obj as ConnectionModel;
    } else {
      return null;
    }
  }

  public async del(id: string): Promise<boolean> {
    const result = await this.redis.hdel(key, id);
    return result > 0;
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
    await this.set(id, next);
  }

  public async dump(): Promise<ConnectionModel[]> {
    const models: ConnectionModel[] = [];
    let cursor = "0";
    while (true) {
      const result = await this.redis.hscan(key, cursor, "COUNT", 1000);
      const [nextCursor, elements] = result;

      for (let i = 0; i < elements.length; i++) {
        if (i % 2 === 0) {
          const id = elements[i];
        } else {
          const obj = JSON.parse(elements[i]);
          const model = obj as ConnectionModel;
          models.push(model);
        }
      }

      cursor = nextCursor;
      if (nextCursor === "0") {
        break;
      }
    }

    return models;
  }
}
