import { Packet, RawData, encodePacket } from "engine.io-parser";

export const encodePacketAsync = (
  packet: Packet,
  supportsBinary?: boolean,
): Promise<RawData> => {
  // aws websocket api는 바이너리를 지원하지 않음
  const opt_supportsBinary = supportsBinary ?? false;

  return new Promise<string>((resolve) => {
    encodePacket(packet, opt_supportsBinary, (encoded) => {
      resolve(encoded);
    });
  });
};
