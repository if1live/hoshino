import * as z from "zod";

export interface Handshake {
  sid: string;
  upgrades: string[];
  pingTimeout: number;
  pingInterval: number;
  maxPayload: number;
}

export const defaultHandshake: Omit<Handshake, "sid"> = {
  upgrades: [],
  pingInterval: 25000,
  pingTimeout: 20000,
  maxPayload: 1e6,
};

export const Command_Handshake = z.object({
  tag: z.literal("handshake"),
  connectionId: z.string(),
  endpoint: z.string(),
  ts_connect: z.number(),
});
export type Command_Handshake = z.infer<typeof Command_Handshake>;

export const Command_Schedule = z.object({
  tag: z.literal("schedule"),
  connectionId: z.string(),
  endpoint: z.string(),
});
export type Command_Schedule = z.infer<typeof Command_Schedule>;
