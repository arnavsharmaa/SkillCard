import React from 'react';

// Last line of defense: if any component throws while rendering, show a calm
// branded fallback with a reload button instead of a white screen — the demo
// should never surface a raw error.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[SkillCard] render error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full grid place-items-center p-8 text-center">
          <div>
            <div className="mx-auto mb-3 h-10 w-10 rounded-xl bg-accent text-ink grid place-items-center font-black text-xl">
              S
            </div>
            <div className="text-xl font-bold text-accent mb-1">SkillCard hit a snag</div>
            <p className="text-sm text-muted mb-4">A reload picks up right where the demo left off.</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-accent px-4 py-2 font-semibold text-ink hover:brightness-110 transition"
            >
              ↻ Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
