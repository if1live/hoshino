import { setTimeout } from "node:timers/promises";
import { SQSHandler } from "aws-lambda";
import { MySocket } from "../engine/MySocket.js";
import { encodePacketAsync } from "../engine/helpers.js";
import {
  Command_Handshake,
  Command_Schedule,
  Handshake,
  defaultHandshake,
} from "../engine/types.js";

export const dispatch: SQSHandler = async (event, context) => {
  for (const record of event.Records) {
    const obj = JSON.parse(record.body);

    const parsed_handshake = Command_Handshake.safeParse(obj);
    if (parsed_handshake.success) {
      await dispatch_handshake(parsed_handshake.data);
      continue;
    }

    const parsed_schedule = Command_Schedule.safeParse(obj);
    if (parsed_schedule.success) {
      await dispatch_schedule(parsed_schedule.data);
      continue;
    }

    throw new Error("unknown command", {
      cause: obj,
    });
  }
};

const dispatch_handshake = async (command: Command_Handshake) => {
  // websocket connection이 붙었다고 확신이 생긴 다음에 메세지를 보내고 싶다.
  // SQS 시작 이후 10ms 기다리면 충분하지 않을까?
  await setTimeout(10);

  const handshake: Handshake = {
    sid: command.connectionId,
    ...defaultHandshake,
  };

  const packet = {
    type: "open",
    data: JSON.stringify(handshake),
  } as const;
  const encoded = await encodePacketAsync(packet);

  const sock = new MySocket(command.connectionId, command.endpoint);
  await sock.send(encoded, { wsPreEncoded: encoded });
};

const dispatch_schedule = async (command: Command_Schedule) => {
  console.log("schedule");
};
