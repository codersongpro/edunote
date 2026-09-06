export class DownloadSizeLimitError extends Error {}

export class BoundedDownloadBuffer {
  private chunks: Buffer[] = [];
  private totalBytes = 0;
  private exceeded = false;

  constructor(
    readonly maxBytes: number,
    private readonly onExceeded: () => void = () => undefined,
  ) {}

  get retainedBytes(): number { return this.totalBytes; }

  assertContentLength(rawValue: unknown): void {
    const first = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (typeof first !== 'string' && typeof first !== 'number') return;
    const declared = Number(first);
    if (Number.isFinite(declared) && declared >= 0 && declared > this.maxBytes) this.fail();
  }

  append(chunk: Buffer): void {
    if (this.exceeded) this.fail();
    if (this.totalBytes + chunk.byteLength > this.maxBytes) this.fail();
    this.chunks.push(chunk);
    this.totalBytes += chunk.byteLength;
  }

  toBuffer(): Buffer {
    if (this.exceeded) this.fail();
    return Buffer.concat(this.chunks, this.totalBytes);
  }

  private fail(): never {
    if (!this.exceeded) {
      this.exceeded = true;
      this.chunks = [];
      this.totalBytes = 0;
      this.onExceeded();
    }
    throw new DownloadSizeLimitError(`외부 자료가 허용된 최대 크기(${this.maxBytes}바이트)를 초과했습니다.`);
  }
}
