import { describe, expect, it } from 'vitest';
import {
  cardToString,
  createDeck,
  createDeckCommitment,
  createShuffledDeck,
  DECK_COMMITMENT_SECURITY,
  deckFingerprint,
  revealDeck,
  verifyDeckCommitment,
} from './index';

describe('deterministic shuffling', () => {
  it('repeats a seed without mutating the source deck and changes with the seed', () => {
    const source = createDeck();
    const original = source.map(cardToString);
    const first = createShuffledDeck('table-42');
    const second = createShuffledDeck('table-42');
    const different = createShuffledDeck('table-43');
    expect(first.map(cardToString)).toEqual(second.map(cardToString));
    expect(first.map(cardToString)).not.toEqual(different.map(cardToString));
    expect(source.map(cardToString)).toEqual(original);
    expect(deckFingerprint(first)).toBe(deckFingerprint(second));
  });
});

describe('deck commitments', () => {
  it('round-trips reveal material and verifies the SHA-256 commitment', () => {
    const material = createDeckCommitment(createDeck(), 'private-secret');
    expect(material.commitment).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyDeckCommitment(material.commitment, material.reveal)).toBe(true);
    expect(revealDeck(material.reveal)).toEqual(createDeck());
  });

  it('detects deck, secret, and commitment tampering', () => {
    const material = createDeckCommitment(createDeck(), 'private-secret');
    const changedDeck = { secret: material.reveal.secret, deck: [...material.reveal.deck] };
    const first = changedDeck.deck[0];
    changedDeck.deck[0] = changedDeck.deck[1] ?? '';
    changedDeck.deck[1] = first ?? '';
    expect(verifyDeckCommitment(material.commitment, changedDeck)).toBe(false);
    expect(verifyDeckCommitment(material.commitment, { ...material.reveal, secret: 'other' })).toBe(false);
    expect(verifyDeckCommitment('0'.repeat(64), material.reveal)).toBe(false);
  });

  it('rejects malformed reveal material and states the security boundary', () => {
    const material = createDeckCommitment(createDeck(), 'private-secret');
    expect(verifyDeckCommitment(material.commitment, { ...material.reveal, deck: ['As'] })).toBe(false);
    expect(verifyDeckCommitment('not-a-hash', material.reveal)).toBe(false);
    expect(DECK_COMMITMENT_SECURITY).toContain('after the fact');
    expect(DECK_COMMITMENT_SECURITY).toContain('do not stop a host');
  });
});
