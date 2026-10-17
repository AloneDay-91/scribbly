import { parseTabs, type Tab } from "@/lib/tabs";

export type Account = {
  id: string;
  name: string;
  avatar: string;
};

export type Prefs = {
  fontSize: number;
  wordGoal: number;
  lastNote: string | null;
  recent: string[];
  tabs: Tab[];
  activeTab: string;
  activeWorkspace: string | null;
  accounts: Account[];
  activeAccountId: string | null;
};

const KEY = "scribbly:prefs";

const initialSession = parseTabs(undefined, null);

export const defaultPrefs: Prefs = {
  fontSize: 15,
  wordGoal: 400,
  lastNote: null,
  recent: [],
  tabs: initialSession.tabs,
  activeTab: initialSession.activeId,
  activeWorkspace: null,
  accounts: [],
  activeAccountId: null,
};

function parseAccount(value: unknown): Account | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Partial<Account>;
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 80) : "";
  if (!name) {
    return null;
  }
  const id = typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID();
  const avatar =
    typeof raw.avatar === "string" && raw.avatar.startsWith("data:image/") ? raw.avatar : "";
  return { id, name, avatar };
}

function parseAccounts(raw: Partial<Prefs> & { account?: Partial<Account> }) {
  const source = Array.isArray(raw.accounts) ? raw.accounts : raw.account ? [raw.account] : [];
  const accounts = source
    .map((item) => parseAccount(item))
    .filter((item): item is Account => item !== null);
  const unique = accounts.filter(
    (account, index) => accounts.findIndex((item) => item.id === account.id) === index,
  );
  const activeAccountId =
    typeof raw.activeAccountId === "string" && unique.some((account) => account.id === raw.activeAccountId)
      ? raw.activeAccountId
      : Array.isArray(raw.accounts)
        ? null
        : (unique[0]?.id ?? null);
  return { accounts: unique, activeAccountId };
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs> & {
      account?: Partial<Account>;
    };
    const accounts = parseAccounts(raw);
    const lastNote = typeof raw.lastNote === "string" ? raw.lastNote : null;
    const session = parseTabs(raw.tabs, lastNote);
    const activeTab = session.tabs.some((tab) => tab.id === raw.activeTab)
      ? (raw.activeTab as string)
      : session.activeId;
    return {
      fontSize: clamp(raw.fontSize, 13, 22, defaultPrefs.fontSize),
      wordGoal: clamp(raw.wordGoal, 50, 5000, defaultPrefs.wordGoal),
      lastNote,
      recent: Array.isArray(raw.recent)
        ? raw.recent.filter((item): item is string => typeof item === "string").slice(0, 12)
        : [],
      tabs: session.tabs,
      activeTab,
      activeWorkspace: typeof raw.activeWorkspace === "string" ? raw.activeWorkspace : null,
      accounts: accounts.accounts,
      activeAccountId: accounts.activeAccountId,
    };
  } catch {
    return defaultPrefs;
  }
}

export function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage may be unavailable; preferences are a convenience only.
  }
}
