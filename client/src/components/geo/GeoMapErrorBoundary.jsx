import { Component } from "react";

export class GeoMapErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("[GeoMap]", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300/90 bg-neutral-50/80 px-4 py-6 text-center dark:border-slate-600 dark:bg-slate-900/50">
          <p className="text-sm text-text-primary dark:text-slate-200">Map could not load.</p>
          <p className="text-xs text-text-secondary dark:text-slate-400">
            You can still save your profile. Use the address fields and buttons above, or try again later.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
