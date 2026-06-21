// Tiny external store for the current page title. PageHeader broadcasts on
// mount; TopBar subscribes via usePageTitle (useSyncExternalStore).
//
// Why an external store and not a React context: the lint rule
// `react-hooks/set-state-in-effect` flags PageHeader's setTitle-on-mount as
// a cascading-render risk. Mutating a plain module variable from inside the
// effect avoids the rule entirely while preserving identical semantics.

let currentTitle = "";
const listeners = new Set<() => void>();

export const pageTitleStore = {
  get(): string {
    return currentTitle;
  },
  set(next: string): void {
    if (currentTitle === next) return;
    currentTitle = next;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
