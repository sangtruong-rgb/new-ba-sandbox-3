// Slot regions: each renders the features of one slot, each in its own error boundary.
import { Component, createContext, createElement, useContext, type ErrorInfo, type ReactNode } from 'react';
import { createLogger } from './log';
import { createRegistry, type Registry, type SlotEntry } from './registry';

const RegistryContext = createContext<Registry>(createRegistry([]));

export function RegistryProvider({ registry, children }: { registry: Registry; children: ReactNode }) {
  return <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>;
}

function prefixOf(entry: SlotEntry, page: string): string {
  if (entry.page === null) return `[${entry.featureId}]`;
  if (entry.featureId.includes('/')) return `[${entry.featureId}]`;
  return `[${entry.page ?? page}/${entry.featureId}]`;
}

class Boundary extends Component<{ prefix: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    createLogger(this.props.prefix).error(error, info.componentStack ?? '');
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type SlotProps = {
  name: string;
  page: string;
  as?: 'div' | 'span';
  className?: string;
  props?: Record<string, unknown>;
};

/** The element with data-slot="<name>", holding the slot's features ordered by order then id. */
export function Slot({ name, page, as = 'div', className, props = {} }: SlotProps) {
  const registry = useContext(RegistryContext);
  const entries = registry.slot(name);
  return createElement(
    as,
    { 'data-slot': name, className },
    entries.map((entry, i) => (
      <Boundary key={`${entry.featureId}:${i}`} prefix={prefixOf(entry, page)}>
        <entry.Component {...props} />
      </Boundary>
    )),
  );
}
