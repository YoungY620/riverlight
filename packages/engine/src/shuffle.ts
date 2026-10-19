import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { assertValidDeck, createDeck, type Card } from './cards';

function randomUint32(seed: string, counter: number): number {
  const digest = sha256(utf8ToBytes(`riverlight-shuffle-v1:${seed}:${counter}`));
  const view = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
  return view.getUint32(0, false);
}

export function shuffleDeck(deck: readonly Card[], seed: string): Card[] {
  assertValidDeck(deck);
  const shuffled = deck.map((card) => ({ ...card }));
  let counter = 0;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const range = index + 1;
    const limit = Math.floor(0x1_0000_0000 / range) * range;
    let value = randomUint32(seed, counter);
    counter += 1;
    while (value >= limit) {
      value = randomUint32(seed, counter);
      counter += 1;
    }
    const other = value % range;
    const current = shuffled[index];
    const replacement = shuffled[other];
    if (current !== undefined && replacement !== undefined) {
      shuffled[index] = replacement;
      shuffled[other] = current;
    }
  }
  return shuffled;
}

export function createShuffledDeck(seed: string): Card[] {
  return shuffleDeck(createDeck(), seed);
}

export function deckFingerprint(deck: readonly Card[]): string {
  assertValidDeck(deck);
  return bytesToHex(sha256(utf8ToBytes(deck.map((card) => `${card.rank}:${card.suit}`).join('|'))));
}
