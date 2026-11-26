// FeatureRegistry: the features of the app, by slot.
import type { ComponentType } from 'react';

export type FeatureSlot = {
  slot: string;
  order: number;
  // Each slot gives its own props (see the slot contracts of the pages).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<any>;
};

/** What a feature's index.ts exports. */
export type Feature = {
  id: string;
  slots: FeatureSlot[];
  routes: string[];
  storageKeys: string[];
  shortcuts: string[];
  /** Set by the loader from the folder: the page of src/pages/<page>/features, null for src/features. */
  page?: string | null;
};

export type SlotEntry = { featureId: string; page: string | null | undefined; order: number; Component: FeatureSlot['Component'] };

export type Registry = {
  features: readonly Feature[];
  slot(name: string): SlotEntry[];
};

function checkUnique(features: readonly Feature[], key: 'routes' | 'storageKeys' | 'shortcuts', what: string) {
  const owner = new Map<string, string>();
  for (const f of features) {
    for (const value of f[key] ?? []) {
      const first = owner.get(value);
      if (first !== undefined) {
        throw new Error(`The ${what} "${value}" is declared twice: by "${first}" and by "${f.id}"`);
      }
      owner.set(value, f.id);
    }
  }
}

export function createRegistry(features: Feature[]): Registry {
  checkUnique(features, 'routes', 'route');
  checkUnique(features, 'storageKeys', 'storage key');
  checkUnique(features, 'shortcuts', 'shortcut');

  const bySlot = new Map<string, SlotEntry[]>();
  for (const f of features) {
    for (const s of f.slots ?? []) {
      const list = bySlot.get(s.slot) ?? [];
      list.push({ featureId: f.id, page: f.page, order: s.order ?? 0, Component: s.Component });
      bySlot.set(s.slot, list);
    }
  }
  for (const list of bySlot.values()) {
    list.sort((a, b) => a.order - b.order || (a.featureId < b.featureId ? -1 : a.featureId > b.featureId ? 1 : 0));
  }
  return {
    features,
    slot: (name) => bySlot.get(name) ?? [],
  };
}
