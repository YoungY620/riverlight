import { describe, expect, it } from "vitest";
import {
  MAX_SIGNAL_CODE_LENGTH,
  createRoomPasswordProof,
  decodeAnswerCode,
  decodeInviteCode,
  encodeAnswerCode,
  encodeInviteCode,
  verifyRoomPasswordProof,
} from "./index";
import type { AnswerSignal, InviteSignal } from "./index";

const sdp = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\na=candidate:1 1 UDP 1 192.168.1.2 5000 typ host\r\n";

function encodeJson(value: unknown): string {
  return btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeJson(code: string): unknown {
  const base64 = code.replaceAll("-", "+").replaceAll("_", "/");
  return JSON.parse(atob(base64));
}

describe("signaling codec", () => {
  it("roundtrips compact invite and answer codes", async () => {
    const invite: InviteSignal = {
      v: 1,
      kind: "invite",
      id: "peer-id-123456",
      protected: true,
      sdp,
    };
    const inviteCode = encodeInviteCode(invite);
    expect(inviteCode).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(decodeInviteCode(inviteCode)).toEqual(invite);

    const proof = await createRoomPasswordProof(invite.id, "correct horse");
    const answer: AnswerSignal = {
      v: 1,
      kind: "answer",
      id: invite.id,
      proof,
      sdp: sdp.replace("offer", "answer"),
    };
    const answerCode = encodeAnswerCode(answer);
    expect(answerCode).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(decodeAnswerCode(answerCode)).toEqual(answer);
    expect(JSON.stringify(decodeJson(answerCode))).not.toContain("correct horse");
  });

  it("rejects the wrong signal kind", () => {
    const code = encodeInviteCode({
      v: 1,
      kind: "invite",
      id: "peer-id-123456",
      protected: false,
      sdp,
    });
    expect(() => decodeAnswerCode(code)).toThrowError(expect.objectContaining({ code: "WRONG_SIGNAL_KIND" }));
  });

  it("rejects bad base64url and malformed JSON", () => {
    expect(() => decodeInviteCode("%%%bad-base64%%%")).toThrowError(
      expect.objectContaining({ code: "INVALID_CODE" }),
    );
    expect(() => decodeInviteCode(encodeJson(["not", "an", "object"]))).toThrowError(
      expect.objectContaining({ code: "INVALID_CODE" }),
    );
  });

  it("rejects invalid field types and unsupported versions", () => {
    expect(() => decodeInviteCode(encodeJson({
      v: 1,
      kind: "invite",
      id: 42,
      protected: false,
      sdp,
    }))).toThrowError(expect.objectContaining({ code: "INVALID_CODE" }));
    expect(() => decodeInviteCode(encodeJson({
      v: 2,
      kind: "invite",
      id: "peer-id-123456",
      protected: false,
      sdp,
    }))).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_VERSION" }));
  });

  it("rejects oversized input before decoding", () => {
    expect(() => decodeInviteCode("A".repeat(MAX_SIGNAL_CODE_LENGTH + 1))).toThrowError(
      expect.objectContaining({ code: "CODE_TOO_LARGE" }),
    );
  });

  it("verifies only the matching room password proof", async () => {
    const proof = await createRoomPasswordProof("peer-id-123456", "secret");
    await expect(verifyRoomPasswordProof("peer-id-123456", "secret", proof)).resolves.toBe(true);
    await expect(verifyRoomPasswordProof("peer-id-123456", "wrong", proof)).resolves.toBe(false);
    await expect(verifyRoomPasswordProof("another-peer-id", "secret", proof)).resolves.toBe(false);
  });
});
