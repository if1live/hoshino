import {
  ApiGatewayManagementApiClient,
  DeleteConnectionCommand,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { Packet } from "engine.io-parser";
import { encodePacketAsync } from "./helpers.js";

export interface Connection {
  connectionId: string;
  endpoint: string;
}

export interface Handshake {
  sid: string;
  upgrades: string[];
  pingTimeout: number;
  pingInterval: number;
  maxPayload: number;
}

const defaultHandshake: Omit<Handshake, "sid"> = {
  upgrades: [""],
  pingTimeout: 20000,
  pingInterval: 25000,
  maxPayload: 1e6,
};

export const post = async (connection: Connection, packet: Packet) => {
  const { connectionId, endpoint } = connection;
  const encodedPacket = await encodePacketAsync(packet);
  const client = new ApiGatewayManagementApiClient({ endpoint });
  await client.send(
    new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: new TextEncoder().encode(encodedPacket),
    })
  );
};

export const handshake = async (connection: Connection) => {
  const sid = connection.connectionId;
  const handshake: Handshake = {
    ...defaultHandshake,
    sid,
  };

  return await post(connection, {
    type: "open",
    data: JSON.stringify(handshake),
  });
};

export const ping = async (connection: Connection, packet: Packet) => {
  return await post(connection, { type: "pong", data: packet.data });
};

export const send = async (connection: Connection, data: string) => {
  return await post(connection, { type: "message", data });
};

export const close = async (connection: Connection) => {
  const { connectionId, endpoint } = connection;
  const client = new ApiGatewayManagementApiClient({ endpoint });
  return await client.send(
    new DeleteConnectionCommand({
      ConnectionId: connectionId,
    })
  );
};
