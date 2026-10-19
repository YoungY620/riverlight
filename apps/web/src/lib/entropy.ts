const encoder = new TextEncoder();

function randomBytes(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function joinBytes(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export interface EntropySource {
  readonly name: string;
  read(): Promise<Uint8Array>;
}

export class SystemEntropySource implements EntropySource {
  readonly name = "system-crypto";

  async read() {
    return randomBytes();
  }
}

export class EventEntropySource implements EntropySource {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  async read() {
    return encoder.encode(JSON.stringify({
      source: this.name,
      wallTime: Date.now(),
      monotonicTime: typeof performance === "undefined" ? 0 : performance.now(),
    }));
  }
}

export class EntropyPool {
  private state = randomBytes();
  private sequence = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly sources: EntropySource[];

  constructor(sources: EntropySource[] = []) {
    this.sources = [new SystemEntropySource(), ...sources];
  }

  mix(source: string | EntropySource) {
    const eventSource = typeof source === "string" ? new EventEntropySource(source) : source;
    return this.enqueue(() => this.mixNow(eventSource));
  }

  nextSecret(purpose: string) {
    return this.enqueue(async () => {
      for (const source of this.sources) await this.mixNow(source);
      await this.mixNow(new EventEntropySource(purpose));
      return Array.from(this.state, (value) => value.toString(16).padStart(2, "0")).join("");
    });
  }

  private enqueue<T>(operation: () => Promise<T>) {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async mixNow(source: EntropySource) {
    this.sequence += 1;
    const sequence = encoder.encode(String(this.sequence));
    const event = await source.read();
    this.state = new Uint8Array(await crypto.subtle.digest("SHA-256", joinBytes(this.state, sequence, event, randomBytes())));
  }
}
