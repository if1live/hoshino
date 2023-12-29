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
