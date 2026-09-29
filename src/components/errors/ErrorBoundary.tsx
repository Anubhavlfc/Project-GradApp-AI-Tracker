import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logError } from '@/lib/log';

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Names the place in the log, e.g. "app" or "page". */
  scope: string;
  /** What to show instead of the children once one of them has failed to render. */
  fallback: (details: { error: unknown; reset: () => void }) => ReactNode;
  /** When this changes after a failure, the failure is cleared: moving to another page recovers. */
  resetKey?: unknown;
};

type ErrorBoundaryState = { failed: boolean; error: unknown };

/**
 * Catches errors thrown while rendering the components below it, so one broken screen shows a
 * message with a way forward instead of a blank page. It cannot catch errors in event handlers or
 * in requests; those are handled where they happen (failed saves and loads show their own messages).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { failed: true, error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    logError(this.props.scope, error);
    if (import.meta.env.DEV && info.componentStack) logError(this.props.scope, info.componentStack);
  }

  componentDidUpdate(previousProps: ErrorBoundaryProps, previousState: ErrorBoundaryState) {
    // Only when the failure was already on screen before this update: if the very change of key
    // caused the failure, clearing it would render the same broken page a second time.
    if (
      this.state.failed &&
      previousState.failed &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ failed: false, error: null });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return this.props.fallback({ error: this.state.error, reset: this.reset });
  }
}
