import { createToastManager } from "@/components/ui/Toast";

export const toastManager = createToastManager();

const FALLBACK = "Une erreur inattendue s'est produite.";

export function errorText(error: unknown) {
  if (typeof error === "string") {
    const text = error.trim();
    return text || FALLBACK;
  }
  if (error instanceof Error) {
    const text = error.message.trim();
    return text || FALLBACK;
  }
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    const text = error.message.trim();
    return text || FALLBACK;
  }
  return FALLBACK;
}

let lastKey = "";
let lastAt = 0;

/** Show an error toast. Title and description are always set. */
export function reportError(title: string, error?: unknown) {
  const description = errorText(error);
  const key = `${title}\n${description}`;
  const now = Date.now();
  if (key === lastKey && now - lastAt < 1500) {
    return;
  }
  lastKey = key;
  lastAt = now;
  toastManager.add({
    title,
    description,
    type: "error",
    priority: "high",
    timeout: 8000,
  });
}

export function installErrorToasts() {
  const onError = (event: ErrorEvent) => {
    if (event.message.includes("ResizeObserver loop")) {
      return;
    }
    reportError("Erreur inattendue", event.error ?? event.message);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    reportError("Erreur inattendue", event.reason);
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
