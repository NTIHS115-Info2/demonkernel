type RelayQueueOptions<T> = {
  handler: (item: T) => Promise<void>;
  onError: (item: T, error: unknown) => void;
};

export class RelayQueue<T> {
  private readonly queue: T[] = [];
  private readonly handler: (item: T) => Promise<void>;
  private readonly onError: (item: T, error: unknown) => void;
  private active = false;
  private stopping = false;
  private idleResolvers: Array<() => void> = [];

  constructor(options: RelayQueueOptions<T>) {
    this.handler = options.handler;
    this.onError = options.onError;
  }

  // 中英註解：此 queue 固定 FIFO，避免多筆 Discord 對話同時處理造成回覆交錯。
  // EN: Keep strict FIFO so Discord replies do not interleave across messages.
  enqueue(item: T): void {
    if (this.stopping) {
      return;
    }

    this.queue.push(item);
    if (!this.active) {
      void this.drain();
    }
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.queue.length = 0;

    if (!this.active) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  private async drain(): Promise<void> {
    if (this.active) {
      return;
    }

    this.active = true;

    while (this.queue.length > 0 && !this.stopping) {
      const item = this.queue.shift() as T;
      try {
        await this.handler(item);
      } catch (error) {
        this.onError(item, error);
      }
    }

    this.active = false;
    const resolvers = [...this.idleResolvers];
    this.idleResolvers = [];
    for (const resolve of resolvers) {
      resolve();
    }
  }
}

