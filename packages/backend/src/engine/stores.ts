import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import type { Redis } from "ioredis";

// https://docs.aws.amazon.com/ko_kr/apigateway/latest/developerguide/limits.html

/** @summary WebSocket API 연결 기간 */
export const WS_CONNECTION_DURATION_SECONDS = 2 * 3600;

/** @summary 유휴 연결 제한 시간 */
export const WS_IDLE_CONNECTION_TIMEOUT_SECONDS = 10 * 60;

export interface ConnectionModel {
  connectionId: string;
  endpoint: string;

  // dynamodb에서의 시간 규격과 맞추려고 second 기준
  seconds_connect: number;
  seconds_touch: number;
}

export interface ConnectionStore {
  tag: string;

  set(id: string, model: ConnectionModel): Promise<void>;
  get(id: string): Promise<ConnectionModel | null>;
  del(id: string): Promise<boolean>;
  touch(id: string, seconds: number): Promise<void>;
  // dump(): Promise<ConnectionModel[]>
}

export class ConnectionStore_DynamoDB implements ConnectionStore {
  public static readonly s_tag = "dynamodb";
  public readonly tag = ConnectionStore_DynamoDB.s_tag;

  constructor(private readonly client: DynamoDBClient) {}

  private readonly table = "ConnectionIds";
  private readonly seconds_ttl = 60.0;

  public async set(id: string, model: ConnectionModel): Promise<void> {
    if (id !== model.connectionId) {
      throw new Error("invalid input");
    }

    const seconds_ttl = model.seconds_touch + this.seconds_ttl;
    const command = new PutItemCommand({
      TableName: this.table,
      Item: {
        connectionId: { S: model.connectionId },
        endpoint: { S: model.endpoint },
        seconds_connect: { N: model.seconds_connect.toString() },
        seconds_ttl: { N: seconds_ttl.toString() },
      },
    });
    const result = await this.client.send(command);
  }

  public async get(id: string): Promise<ConnectionModel | null> {
    const command = new GetItemCommand({
      TableName: this.table,
      Key: {
        connectionId: { S: id },
      },
    });
    const output = await this.client.send(command);
    if (output.Item) {
      const item = output.Item;

      const connectionId = item.connectionId.S!;
      const endpoint = item.endpoint.S!;
      const seconds_connect = parseFloat(item.seconds_connect.N!);
      const seconds_ttl = parseFloat(item.seconds_ttl.N!);
      const seconds_touch = seconds_ttl - this.seconds_ttl;

      return {
        connectionId,
        endpoint,
        seconds_connect,
        seconds_touch,
      };
    } else {
      return null;
    }
  }

  public async del(id: string): Promise<boolean> {
    const command = new DeleteItemCommand({
      TableName: this.table,
      Key: {
        connectionId: { S: id },
      },
      ReturnValues: "ALL_OLD",
    });
    const output = await this.client.send(command);
    console.log("del", output);

    const wcu = output.ConsumedCapacity?.WriteCapacityUnits ?? 0;
    return wcu > 0;
  }

  public async touch(id: string, seconds: number): Promise<void> {
    const seconds_ttl = seconds + this.seconds_ttl;
    const command = new UpdateItemCommand({
      TableName: this.table,
      Key: {
        connectionId: { S: id },
      },
      UpdateExpression: "SET seconds_ttl = :seconds_ttl",
      ExpressionAttributeValues: {
        ":seconds_ttl": { N: seconds_ttl.toString() },
      },
    });
    const output = await this.client.send(command);
    console.log("touch", output);
  }
}

export class ConnectionStore_Redis implements ConnectionStore {
  public static readonly s_tag = "redis";
  public readonly tag = ConnectionStore_Redis.s_tag;

  constructor(private readonly redis: Redis) {}

  private readonly key = "eio:connection";

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
    await this.redis.hset(this.key, ...args);
  }

  public async get(id: string): Promise<ConnectionModel | null> {
    const value = await this.redis.hget(this.key, id);
    if (value) {
      const obj = JSON.parse(value);
      return obj as ConnectionModel;
    } else {
      return null;
    }
  }

  public async del(id: string): Promise<boolean> {
    const result = await this.redis.hdel(this.key, id);
    return result > 0;
  }

  public async touch(id: string, seconds: number): Promise<void> {
    const prev = await this.get(id);
    if (!prev) {
      return;
    }

    const next: typeof prev = {
      ...prev,
      seconds_touch: seconds,
    };
    await this.set(id, next);
  }

  public async dump(): Promise<ConnectionModel[]> {
    const models: ConnectionModel[] = [];
    let cursor = "0";
    while (true) {
      const result = await this.redis.hscan(this.key, cursor, "COUNT", 1000);
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
