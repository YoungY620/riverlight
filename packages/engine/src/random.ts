import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

export type RandomSource = () => number;

export function createSeededRandom(seed: string): RandomSource {
  const digest = sha256(utf8ToBytes(`riverlight-random-v1:${seed}`));
  const view = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
  let state = view.getUint32(0, false);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}
