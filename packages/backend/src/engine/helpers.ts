import { APIGatewayProxyEvent } from "aws-lambda";
import { encodePacket, Packet } from "engine.io-parser";

export function deriveEndpoint(event: APIGatewayProxyEvent): string {
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

export const encodePacketAsync = (packet: Packet) => {
  return new Promise<string>((resolve) => {
    // aws websocket api는 바이너리를 지원하지 않음
    const supportsBinary = false;
    encodePacket(packet, supportsBinary, (encodePacket) => {
      resolve(encodePacket);
    });
  });
};
