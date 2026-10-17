export const MAX_TABS = 16;

export type Tab = {
  id: string;
  /** Visited locations. `null` is the library. */
  history: (string | null)[];
  index: number;
};

export type TabSession = {
  tabs: Tab[];
  activeId: string;
};

export type OpenMode = "push" | "tab";

export function tabPath(tab: Tab): string | null {
  return tab.history[tab.index] ?? null;
}

export function blankSession(path: string | null = null): TabSession {
  const id = crypto.randomUUID();
  return { tabs: [{ id, history: [path], index: 0 }], activeId: id };
}

/** Drop entries the wiki no longer has, and collapse duplicates left behind. */
export function pruneMissing(tabs: Tab[], known: ReadonlySet<string>): Tab[] {
  return tabs.map((tab) =>
    rewriteHistory(tab, (entry) => (entry === null || known.has(entry) ? entry : undefined)),
  );
}

export function replacePath(tabs: Tab[], from: string, to: string): Tab[] {
  return tabs.map((tab) => rewriteHistory(tab, (entry) => (entry === from ? to : entry)));
}

export function replacePrefix(tabs: Tab[], from: string, to: string): Tab[] {
  return tabs.map((tab) =>
    rewriteHistory(tab, (entry) => {
      if (entry === from) {
        return to;
      }
      if (entry?.startsWith(`${from}/`)) {
        return `${to}${entry.slice(from.length)}`;
      }
      return entry;
    }),
  );
}

export function forgetPath(tabs: Tab[], path: string): Tab[] {
  return tabs.map((tab) => rewriteHistory(tab, (entry) => (entry === path ? undefined : entry)));
}

export function forgetUnder(tabs: Tab[], folder: string): Tab[] {
  return tabs.map((tab) =>
    rewriteHistory(tab, (entry) =>
      entry === folder || entry?.startsWith(`${folder}/`) ? undefined : entry,
    ),
  );
}

export function applyOpen(tabs: Tab[], activeId: string, path: string | null, mode: OpenMode): TabSession {
  switch (mode) {
    case "push": {
      const existing = tabShowing(tabs, path, activeId);
      if (existing) {
        return { tabs, activeId: existing.id };
      }
      return {
        tabs: tabs.map((tab) => (tab.id === activeId ? navigate(tab, path) : tab)),
        activeId,
      };
    }
    case "tab": {
      const existing = tabShowing(tabs, path);
      if (existing) {
        return { tabs, activeId: existing.id };
      }
      if (tabs.length >= MAX_TABS) {
        return {
          tabs: tabs.map((tab) => (tab.id === activeId ? navigate(tab, path) : tab)),
          activeId,
        };
      }
      const id = crypto.randomUUID();
      return { tabs: [...tabs, { id, history: [path], index: 0 }], activeId: id };
    }
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

export function createTab(tabs: Tab[]): TabSession | null {
  if (tabs.length >= MAX_TABS) {
    return null;
  }
  const id = crypto.randomUUID();
  return { tabs: [...tabs, { id, history: [null], index: 0 }], activeId: id };
}

export function withoutTab(tabs: Tab[], activeId: string, id: string): TabSession {
  if (tabs.length === 1) {
    const only = tabs[0];
    return { tabs: [{ ...only, history: [null], index: 0 }], activeId: only.id };
  }
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === id));
  const next = tabs.filter((tab) => tab.id !== id);
  if (id !== activeId) {
    return { tabs: next, activeId };
  }
  const neighbor = next[Math.min(index, next.length - 1)];
  return { tabs: next, activeId: neighbor.id };
}

export function moveTab(tab: Tab, direction: "back" | "forward"): Tab {
  switch (direction) {
    case "back":
      return tab.index > 0 ? { ...tab, index: tab.index - 1 } : tab;
    case "forward":
      return tab.index < tab.history.length - 1 ? { ...tab, index: tab.index + 1 } : tab;
    default: {
      const exhaustive: never = direction;
      return exhaustive;
    }
  }
}

export function parseTabs(value: unknown, fallbackPath: string | null): TabSession {
  if (!Array.isArray(value)) {
    return blankSession(fallbackPath);
  }
  const tabs: Tab[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const raw = item as Partial<Tab>;
    if (typeof raw.id !== "string" || raw.id.length === 0) {
      continue;
    }
    const history = Array.isArray(raw.history)
      ? raw.history
          .filter((entry): entry is string | null => entry === null || typeof entry === "string")
          .slice(-50)
      : [];
    if (history.length === 0) {
      continue;
    }
    const index =
      typeof raw.index === "number" && raw.index >= 0 && raw.index < history.length
        ? Math.floor(raw.index)
        : history.length - 1;
    tabs.push({ id: raw.id, history, index });
  }
  if (tabs.length === 0) {
    return blankSession(fallbackPath);
  }
  return { tabs: tabs.slice(0, MAX_TABS), activeId: tabs[0].id };
}

function tabShowing(tabs: Tab[], path: string | null, exceptId?: string) {
  if (path === null) {
    return undefined;
  }
  return tabs.find((tab) => tab.id !== exceptId && tabPath(tab) === path);
}

function navigate(tab: Tab, path: string | null): Tab {
  if (tabPath(tab) === path) {
    return tab;
  }
  const history = [...tab.history.slice(0, tab.index + 1), path].slice(-50);
  return { ...tab, history, index: history.length - 1 };
}

/** `undefined` drops the entry. Adjacent duplicates collapse, and the index follows the current entry. */
function rewriteHistory(tab: Tab, mapEntry: (entry: string | null) => string | null | undefined): Tab {
  const history: (string | null)[] = [];
  let index = 0;
  tab.history.forEach((entry, position) => {
    const next = mapEntry(entry);
    if (next === undefined) {
      if (position === tab.index) {
        index = Math.max(0, history.length - 1);
      }
      return;
    }
    if (history.length > 0 && history[history.length - 1] === next) {
      if (position === tab.index) {
        index = history.length - 1;
      }
      return;
    }
    if (position === tab.index) {
      index = history.length;
    }
    history.push(next);
  });
  if (history.length === 0) {
    return { ...tab, history: [null], index: 0 };
  }
  return { ...tab, history, index: Math.min(index, history.length - 1) };
}
