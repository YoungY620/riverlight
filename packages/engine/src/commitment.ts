import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { assertValidDeck, cardToString, parseCard, type Card } from './cards';

export interface DeckReveal {
  secret: string;
  deck: string[];
}

export interface DeckCommitmentMaterial {
  commitment: string;
  reveal: DeckReveal;
}

export const DECK_COMMITMENT_SECURITY =
  'SHA-256 commitments prevent altering the committed deck after the fact; they do not stop a host holding the secret from reading cards early.';

function payload(reveal: DeckReveal): string {
  return JSON.stringify({ protocol: 'riverlight-deck-v1', secret: reveal.secret, deck: reveal.deck });
}

export function createDeckCommitment(deck: readonly Card[], secret: string): DeckCommitmentMaterial {
  assertValidDeck(deck);
  if (!secret) throw new Error('Commitment secret cannot be empty');
  const reveal = { secret, deck: deck.map(cardToString) };
  return {
    commitment: bytesToHex(sha256(utf8ToBytes(payload(reveal)))),
    reveal,
  };
}

export function revealDeck(reveal: DeckReveal): Card[] {
  const deck = reveal.deck.map(parseCard);
  assertValidDeck(deck);
  return deck;
}

function equalHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function verifyDeckCommitment(commitment: string, reveal: DeckReveal): boolean {
  try {
    revealDeck(reveal);
    if (!reveal.secret || !/^[0-9a-f]{64}$/i.test(commitment)) return false;
    const actual = bytesToHex(sha256(utf8ToBytes(payload(reveal))));
    return equalHex(commitment.toLowerCase(), actual);
  } catch {
    return false;
  }
}
