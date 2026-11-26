// ServerRegistry: finds every feature's server.ts and registers them, alphabetical by id.
import type { Hono } from 'hono';
import type { AppEnv, ServerDeps, ServerFeature } from './types';

/** Every feature server.ts on disk, evaluated once. */
export function featuresOnDisk(): ServerFeature[] {
  const modules = import.meta.glob<ServerFeature>(['../src/pages/*/features/*/server.ts', '../src/features/*/server.ts'], {
    eager: true,
  });
  return Object.entries(modules).map(([path, mod]) => {
    if (!mod || typeof mod.id !== 'string' || typeof mod.register !== 'function' || !Array.isArray(mod.routes)) {
      throw new Error(`${path} does not export { id, routes, register }`);
    }
    return { id: mod.id, routes: mod.routes, register: mod.register };
  });
}

/** Throws when two features declare one method and path, naming both. */
export function checkRoutes(features: ServerFeature[]): void {
  const owner = new Map<string, string>();
  for (const f of features) {
    for (const r of f.routes) {
      const key = `${r.method.toUpperCase()} ${r.path}`;
      const first = owner.get(key);
      if (first !== undefined && first !== f.id) {
        throw new Error(`Route ${key} is declared by two features: "${first}" and "${f.id}"`);
      }
      owner.set(key, f.id);
    }
  }
}

export function registerFeatures(app: Hono<AppEnv>, features: ServerFeature[], deps: ServerDeps): void {
  checkRoutes(features);
  const sorted = [...features].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const f of sorted) f.register(app, deps);
}
