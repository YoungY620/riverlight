import { describe, expect, it } from "vitest";
import { EntropyPool, type EntropySource } from "./entropy";

describe("EntropyPool", () => {
  it("mixes operations and time into distinct per-hand secrets", async () => {
    const pool = new EntropyPool();
    await pool.mix("player:fold");
    const first = await pool.nextSecret("hand:1");
    await pool.mix("player:raise:120");
    const second = await pool.nextSecret("hand:2");

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toMatch(/^[0-9a-f]{64}$/);
    expect(second).not.toBe(first);
  });

  it("serializes concurrent event mixing", async () => {
    const pool = new EntropyPool();
    await Promise.all([
      pool.mix("player:call"),
      pool.mix("network:message"),
      pool.mix("player:check"),
    ]);
    const [first, second] = await Promise.all([
      pool.nextSecret("hand:3"),
      pool.nextSecret("hand:4"),
    ]);

    expect(first).not.toBe(second);
  });

  it("accepts pluggable random event sources", async () => {
    const source: EntropySource = {
      name: "test-beacon",
      read: async () => new Uint8Array([1, 2, 3, 4]),
    };
    const pool = new EntropyPool([source]);

    expect(await pool.nextSecret("hand:5")).toMatch(/^[0-9a-f]{64}$/);
  });
});
