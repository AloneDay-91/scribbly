import { Component, type ReactNode, useEffect } from "react";
import { errorText, installErrorToasts, reportError } from "@/lib/errors";

type BoundaryProps = {
  children: ReactNode;
};

type BoundaryState = {
  error: unknown;
};

export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown) {
    reportError("L'interface a rencontré une erreur", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-8 text-center text-foreground">
          <p className="text-sm font-medium">L'interface a rencontré une erreur</p>
          <p className="max-w-md text-xs text-muted-foreground">{errorText(this.state.error)}</p>
          <button
            type="button"
            className="rounded-4xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ErrorWatch() {
  useEffect(() => installErrorToasts(), []);
  return null;
}
