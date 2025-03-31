import { LRUCache } from 'lru-cache';

export function rateLimit({
  uniqueTokenPerInterval = 500,
  interval = 60000,
}: {
  uniqueTokenPerInterval?: number;
  interval?: number;
}) {
  const tokenCache = new LRUCache({
    max: uniqueTokenPerInterval,
    ttl: interval,
  });

  return {
    check: (limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = (tokenCache.get(token) as number) || 0;

        if (tokenCount >= limit) {
          reject(new Error('Rate limit exceeded'));
          return;
        }

        tokenCache.set(token, tokenCount + 1);
        resolve();
      }),
  };
} 