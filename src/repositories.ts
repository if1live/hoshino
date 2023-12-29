import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  PostToConnectionCommandOutput,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { ChainableCommander, Redis } from "ioredis";
import * as z from "zod";
import * as settings from "./settings.js";

// https://docs.aws.amazon.com/ko_kr/apigateway/latest/developerguide/limits.html

/** @summary WebSocket API 연결 기간 */
export const WS_CONNECTION_DURATION_SECONDS = 2 * 3600;

/** @summary 유휴 연결 제한 시간 */
export const WS_IDLE_CONNECTION_TIMEOUT_SECONDS = 10 * 60;

export const ConnectionModel = z.object({
  connectionId: z.string(),
  endpoint: z.string(),

  ts_connect: z.number(),
  ts_touch: z.number(),
});

export type ConnectionModel = z.infer<typeof ConnectionModel>;

/**
 * redis strings 타입으로 저장
 * hash를 사용하면 id와 내용을 redis key 하나에 다 저장할수 있다.
 * 하지만 connection 모델이 늘어날거라고 가정하고 확장성있게 설계해본다.
 */
export class ConnectionRepository {
  static createKey(id: string): string {
    return `hoshiono:connection:${id}`;
  }

  // 웹소켓 커넥션은 1개씩 생기고 사라진다. mset으로 얻는 이점이 없다.
  async setAsync(redis: Redis, model: ConnectionModel): Promise<void> {
    const pipeline = redis.pipeline();
    this.setPipeline(pipeline, model);
    await pipeline.exec();
  }

  setPipeline(
    pipeline: ChainableCommander,
    model: ConnectionModel,
  ): ChainableCommander {
    const ttl_seconds = WS_CONNECTION_DURATION_SECONDS * 3600;
    const key = ConnectionRepository.createKey(model.connectionId);
    const value = JSON.stringify(model);
    pipeline.set(key, value, "KEEPTTL");
    pipeline.expire(key, ttl_seconds, "NX");
    return pipeline;
  }

  async get(redis: Redis, id: string): Promise<ConnectionModel | null> {
    const founds = await this.mget(redis, [id]);
    return founds[0] ?? null;
  }

  async mget(redis: Redis, ids: string[]): Promise<(ConnectionModel | null)[]> {
    if (ids.length <= 0) {
      return [];
    }

    const keys = ids.map(ConnectionRepository.createKey);
    const founds = await redis.mget(keys);
    const models = founds.map((found) => {
      if (found === null) {
        return null;
      }

      const parsed = ConnectionModel.safeParse(JSON.parse(found));
      if (!parsed.success) {
        return null;
      }

      return parsed.data;
    });

    return models;
  }

  async del(redis: Redis, id: string): Promise<number> {
    const key = ConnectionRepository.createKey(id);
    const result = await redis.del(key);
    return result;
  }
}

export const ConnectionAction = {
  client(endpoint: string) {
    return new ApiGatewayManagementApiClient({
      endpoint,
      region: settings.AWS_REGION,
      credentials: settings.AWS_CREDENTIALS,
    });
  },

  async post(
    client: ApiGatewayManagementApiClient,
    connectionId: string,
    data: string,
  ): Promise<PostToConnectionCommandOutput> {
    const output = await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: data,
      }),
    );
    return output;
  },
};
