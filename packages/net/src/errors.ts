export type NetErrorCode =
  | "ALREADY_ACTIVE"
  | "CLOSED"
  | "CODE_TOO_LARGE"
  | "INVALID_CODE"
  | "INVALID_MESSAGE"
  | "INVALID_PASSWORD"
  | "INVITE_ALREADY_USED"
  | "NOT_CONNECTED"
  | "PASSWORD_REQUIRED"
  | "ROOM_FULL"
  | "SIGNALING_FAILED"
  | "UNKNOWN_PEER"
  | "UNSUPPORTED_VERSION"
  | "WEBCRYPTO_UNAVAILABLE"
  | "WEBRTC_UNAVAILABLE"
  | "WRONG_SIGNAL_KIND";

export class NetError extends Error {
  readonly code: NetErrorCode;

  constructor(code: NetErrorCode, message: string) {
    super(message);
    this.name = "NetError";
    this.code = code;
  }
}
