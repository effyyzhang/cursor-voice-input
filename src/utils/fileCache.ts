interface FileCache {
  paths: Set<string>;
  lastUpdate: number;
}

let cache: FileCache = {
  paths: new Set<string>(),
  lastUpdate: 0,
};

const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export function updateCache(files: string[]): void {
  cache.paths = new Set(files);
  cache.lastUpdate = Date.now();
}

export function getCachedFiles(): Set<string> {
  return cache.paths;
}

export function isCacheValid(): boolean {
  return Date.now() - cache.lastUpdate < CACHE_EXPIRY_MS;
}

export function clearCache(): void {
  cache.paths.clear();
  cache.lastUpdate = 0;
}
