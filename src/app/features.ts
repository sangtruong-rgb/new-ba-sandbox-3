// The features found on disk: every index.ts, evaluated once at app start.
import type { Feature } from './registry';

export function featuresOnDisk(): Feature[] {
  const pageFeatures = import.meta.glob<Feature>('../pages/*/features/*/index.ts', { eager: true });
  const globalFeatures = import.meta.glob<Feature>('../features/*/index.ts', { eager: true });
  const out: Feature[] = [];
  for (const [path, mod] of Object.entries(pageFeatures)) {
    const page = /\/pages\/([^/]+)\/features\//.exec(path)?.[1] ?? null;
    out.push(normalise(path, mod, page));
  }
  for (const [path, mod] of Object.entries(globalFeatures)) out.push(normalise(path, mod, null));
  return out;
}

function normalise(path: string, mod: Feature, page: string | null): Feature {
  if (!mod || typeof mod.id !== 'string') throw new Error(`${path} does not export an id`);
  return {
    id: mod.id,
    slots: mod.slots ?? [],
    routes: mod.routes ?? [],
    storageKeys: mod.storageKeys ?? [],
    shortcuts: mod.shortcuts ?? [],
    page,
  };
}
