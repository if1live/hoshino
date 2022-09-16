import { expect } from "expect";
import { decodePacket } from "engine.io-parser";

describe("demo", () => {
  it("open", () => {
    const text =
      'fsdf'
    const decoded = decodePacket(text);
    console.log(decoded);
  });
});
