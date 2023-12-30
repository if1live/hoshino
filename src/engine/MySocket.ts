import { ApiGatewayManagementApiClient } from "@aws-sdk/client-apigatewaymanagementapi";
import { Packet } from "engine.io-parser";
import * as R from "remeda";
import { ConnectionAction } from "../repositories.js";
import * as settings from "../settings.js";
import { encodePacketAsync } from "./helpers.js";

export class MySocket {
  constructor(
    private readonly connectionId: string,
    readonly endpoint: string,
  ) {}

  public get id() {
    return this.connectionId;
  }

  public get client() {
    return new ApiGatewayManagementApiClient({
      endpoint: this.endpoint,
      region: settings.AWS_REGION,
      credentials: settings.AWS_CREDENTIALS,
    });
  }

  public async send(data: string, options?: { wsPreEncoded?: string }) {
    const wsPreEncoded = options?.wsPreEncoded;
    if (typeof wsPreEncoded === "string") {
      return await ConnectionAction.post(this.client, this.id, wsPreEncoded);
    }

    // else...
    const packet: Packet = { type: "message", data };
    const encoded = await encodePacketAsync(packet);
    return await ConnectionAction.post(this.client, this.id, encoded);
  }
}

// TODO: buffer는 나중에 신경쓰다. aws websocket api가 binary를 편법으로만 지원해서.
type Fn_Message = (sock: MySocket, data: string) => Promise<void> | void;

type Fn_Close = (sock: MySocket, reason: string) => Promise<void> | void;

type Fn_Error = (sock: MySocket, error: Error) => Promise<void> | void;

type Fn_NoArgs = (sock: MySocket) => Promise<void> | void;

export class MySocketPolicy {
  private readonly list_close: Fn_Close[] = [];
  private readonly list_message: Fn_Message[] = [];
  private readonly list_error: Fn_Error[] = [];
  private readonly list_heartbeat: Fn_NoArgs[] = [];

  public on(tag: "close", fn: Fn_Close): void;
  public on(tag: "message", fn: Fn_Message): void;
  public on(tag: "error", fn: Fn_Error): void;
  public on(tag: "heartbeat", fn: Fn_NoArgs): void;

  public on(tag: string, fn: (...args: any[]) => Promise<void> | void): void {
    switch (tag) {
      case "close":
        this.on_close(fn as any);
        break;
      case "message":
        this.on_message(fn as any);
        break;
      case "error":
        this.on_error(fn as any);
        break;
      case "heartbeat":
        this.on_heartbeat(fn as any);
        break;
    }
  }

  private on_message(fn: Fn_Message) {
    this.list_message.push(fn);
  }

  private on_close(fn: Fn_Close) {
    this.list_close.push(fn);
  }

  private on_error(fn: Fn_Error) {
    this.list_error.push(fn);
  }

  private on_heartbeat(fn: Fn_NoArgs) {
    this.list_heartbeat.push(fn);
  }

  async dispatch_message(sock: MySocket, data: string) {
    for (const fn of this.list_message) {
      const result = fn(sock, data);
      if (R.isPromise(result)) await result;
    }
  }

  async dispatch_close(sock: MySocket, reason: string) {
    for (const fn of this.list_close) {
      const result = fn(sock, reason);
      if (R.isPromise(result)) await result;
    }
  }

  async dispatch_error(sock: MySocket, error: Error) {
    for (const fn of this.list_error) {
      const result = fn(sock, error);
      if (R.isPromise(result)) await result;
    }
  }

  async dispatch_heartbeat(sock: MySocket) {
    for (const fn of this.list_heartbeat) {
      const result = fn(sock);
      if (R.isPromise(result)) await result;
    }
  }
}
