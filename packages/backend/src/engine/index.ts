import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { APIGatewayProxyEvent } from "aws-lambda";
import { encodePacket, Packet, RawData } from "engine.io-parser";

const encodePacketAsync = (packet: Packet) => {
  return new Promise<string>((resolve) => {
    // aws websocket api는 바이너리를 지원하지 않음
    const supportsBinary = false;
    encodePacket(packet, supportsBinary, (encodePacket) => {
      resolve(encodePacket);
    });
  });
};

function deriveEndpoint(event: APIGatewayProxyEvent): string {
  // lambda: f3w1jmmhb3.execute-api.ap-northeast-2.amazonaws.com/dev
  // offline: private.execute-api.ap-northeast-2.amazonaws.com/local
  const region = process.env.AWS_REGION;
  const apiId = event.requestContext.apiId;
  const stage = event.requestContext.stage;
  if (apiId === "private") {
    const port = (event.headers ?? {})["X-Forwarded-Port"] ?? 3001;
    if (port) {
      return `http://${event.requestContext.identity.sourceIp}:${port}`;
    } else {
      return `http://${event.requestContext.identity.sourceIp}`;
    }
  } else {
    return `https://${apiId}.execute-api.${region}.amazonaws.com/${stage}`;
  }
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

export const handshake = async (event: APIGatewayProxyEvent) => {
  const sid = event.requestContext.connectionId!;
  const handshake: Handshake = {
    ...defaultHandshake,
    sid,
  };

  const packet = await encodePacketAsync({
    type: "open",
    data: JSON.stringify(handshake),
  });
  const data = new TextEncoder().encode(packet);

  const connectionId = event.requestContext.connectionId!;
  const endpoint = deriveEndpoint(event);
  const client = new ApiGatewayManagementApiClient({ endpoint });
  await client.send(
    new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: data,
    })
  );
};

export const ping = async (event: APIGatewayProxyEvent, packet: Packet) => {
  const pong = await encodePacketAsync({
    type: "pong",
    data: packet.data,
  });
  const data = new TextEncoder().encode(pong);

  const connectionId = event.requestContext.connectionId!;
  const endpoint = deriveEndpoint(event);
  const client = new ApiGatewayManagementApiClient({ endpoint });
  await client.send(
    new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: data,
    })
  );
};

export const send = async (event: APIGatewayProxyEvent, data: string) => {
  const packet = await encodePacketAsync({
    type: "message",
    data: data,
  });

  const connectionId = event.requestContext.connectionId!;
  const endpoint = deriveEndpoint(event);
  const client = new ApiGatewayManagementApiClient({ endpoint });
  await client.send(
    new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: new TextEncoder().encode(packet),
    })
  );
};
