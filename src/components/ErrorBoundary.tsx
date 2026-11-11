import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Keeps a render crash from blanking the whole app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    /* Surfaced to the console for diagnostics; a backend sink can be added later. */
    console.error("Evolve ERP crashed:", error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash-screen" role="alert">
        <div className="crash-card">
          <AlertTriangle size={28} />
          <h1>Something went wrong</h1>
          <p>
            An unexpected error interrupted this view. Your data is safe — changes already
            saved to the database are unaffected.
          </p>
          <pre className="crash-detail">{error.message}</pre>
          <div className="crash-actions">
            <button type="button" className="btn btn-primary" onClick={this.reset}>
              <RotateCcw size={14} /> Try again
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => window.location.reload()}
            >
              Reload the app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
