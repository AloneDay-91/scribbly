export const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

export const modKey = isMac ? "⌘" : "Ctrl+";

export function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
