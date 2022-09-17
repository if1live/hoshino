import {
  ApiGatewayManagementApiClient,
  DeleteConnectionCommand,
  DeleteConnectionCommandOutput,
  GetConnectionCommandOutput,
  PostToConnectionCommand,
  PostToConnectionCommandOutput,
  GoneException,
  GetConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { APIGatewayProxyEvent } from "aws-lambda";
import { Packet } from "engine.io-parser";
import { deriveEndpoint, encodePacketAsync } from "./helpers.js";
import {
  ConnectionModel,
  ConnectionStore,
  WS_CONNECTION_DURATION_SECONDS,
} from "./stores.js";

export interface Handshake {
  sid: string;
  upgrades: string[];
  pingTimeout: number;
  pingInterval: number;
  maxPayload: number;
}

export const defaultHandshake: Omit<Handshake, "sid"> = {
  upgrades: [""],
  pingTimeout: 60000 + 20000,
  pingInterval: 60000 + 25000,
  maxPayload: 1e6,
};

export type ListenerFunction = (data: any) => any | Promise<any>;
const emptyListener: ListenerFunction = () => {};

export type WebSocketCommandResult<TOutput> =
  | { tag: "ok"; output: TOutput }
  | { tag: "gone" }
  | { tag: "error"; error: unknown };

export class MySocket {
  constructor(
    private readonly connectionId: string,
    private readonly endpoint: string,
    private readonly store: ConnectionStore
  ) {}

  public static fromEvent(
    event: APIGatewayProxyEvent,
    store: ConnectionStore
  ): MySocket {
    const connectionId = event.requestContext.connectionId!;
    const endpoint = deriveEndpoint(event);
    return new MySocket(connectionId, endpoint, store);
  }

  public get id() {
    return this.connectionId;
  }

  public get client() {
    return new ApiGatewayManagementApiClient({
      endpoint: this.endpoint,
    });
  }

  public async send(data: string, options: any) {
    await this.naive_post({ type: "message", data });
  }

  public async close(): Promise<{ flag_db: boolean }> {
    const connectionId = this.connectionId;

    // 이미 지워진 연결으로 close 다시 호출하면 무시한다
    // aws websocket api에서는 disconnect과 관련된 지점이 많아서 db로 검사했다
    const found = await this.store.get(connectionId);
    if (!found) {
      return { flag_db: false };
    }

    const result = await this.naive_delete();
    switch (result.tag) {
      case "ok": {
        return { flag_db: false };
      }
      case "gone": {
        // gone 에러처리하면서 연결을 지웠다
        return { flag_db: true };
      }
      case "error": {
        return { flag_db: false };
      }
    }
  }

  public listener_close: ListenerFunction = emptyListener;
  public listener_message: ListenerFunction = emptyListener;

  public on(type: "close" | "message", fn: ListenerFunction) {
    switch (type) {
      case "close": {
        this.listener_close = fn.bind(this);
        break;
      }
      case "message": {
        this.listener_message = fn.bind(this);
        break;
      }
    }
  }

  public async eio_connect(ts: number) {
    const model: ConnectionModel = {
      connectionId: this.connectionId,
      endpoint: this.endpoint,
      ts_connect: ts,
      ts_touch: ts,
    };
    await this.store.set(model.connectionId, model);
  }

  public async eio_handshake() {
    const sid = this.connectionId;
    const handshake: Handshake = {
      ...defaultHandshake,
      sid,
    };

    return await this.naive_post({
      type: "open",
      data: JSON.stringify(handshake),
    });
  }

  public async eio_ping(data?: string) {
    return await this.naive_post({ type: "ping", data });
  }

  public async eio_pong(data?: string) {
    return await this.naive_post({ type: "pong", data });
  }

  public async eio_close(reason: string) {
    // 연결이 지워졌다면 db에 없을것이다
    const found = await this.store.get(this.id);
    if (!found) {
      return false;
    }

    await this.store.del(this.id);
    await this.naive_delete();
    
    await this.listener_close(reason);
  }

  public async naive_delete(): Promise<
    WebSocketCommandResult<DeleteConnectionCommandOutput>
  > {
    const connectionId = this.connectionId;
    const command = new DeleteConnectionCommand({
      ConnectionId: connectionId,
    });

    try {
      const output = await this.client.send(command);
      return { tag: "ok", output };
    } catch (e) {
      if (e instanceof GoneException) {
        await this.store.del(connectionId);
        return { tag: "gone" };
      } else {
        return { tag: "error", error: e };
      }
    }
  }

  public async naive_post(
    packet: Packet
  ): Promise<WebSocketCommandResult<PostToConnectionCommandOutput>> {
    const connectionId = this.connectionId;
    const encodedPacket = await encodePacketAsync(packet);
    const command = new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: new TextEncoder().encode(encodedPacket),
    });

    try {
      const output = await this.client.send(command);
      return { tag: "ok", output };
    } catch (e) {
      if (e instanceof GoneException) {
        await this.store.del(connectionId);
        return { tag: "gone" };
      } else {
        return { tag: "error", error: e };
      }
    }
  }

  public async naive_get(): Promise<
    WebSocketCommandResult<GetConnectionCommandOutput>
  > {
    const connectionId = this.connectionId;
    const command = new GetConnectionCommand({
      ConnectionId: connectionId,
    });

    try {
      const output = await this.client.send(command);
      return { tag: "ok", output };
    } catch (e) {
      if (e instanceof GoneException) {
        await this.store.del(connectionId);
        return { tag: "gone" };
      } else {
        return { tag: "error", error: e };
      }
    }
  }

  public async schedule(
    model: ConnectionModel,
    ts_now: number
  ): Promise<"dead" | "timeout" | "ping"> {
    // aws websocket api 연결은 영원히 지속될수 없다.
    // 제한 시간을 넘은 연결은 죽은거로 판단하고 지운다
    // AWS에서 웹소켓 연결을 무효화했을테니 store만 갱신해도 문제 없다
    const ts_deadline =
      model.ts_connect + WS_CONNECTION_DURATION_SECONDS * 1000;
    if (ts_now > ts_deadline) {
      await this.store.del(this.id);
      await this.listener_close("connection dead");
      return "dead";
    }

    const ts_keepalive = model.ts_touch + defaultHandshake.pingTimeout;
    if (ts_now > ts_keepalive) {
      await this.eio_close("ping timeout");
      return "timeout";
    }

    // engine.io v4는 server에서 ping이 시작된다
    await this.eio_ping(undefined);
    return "ping";
  }
}
