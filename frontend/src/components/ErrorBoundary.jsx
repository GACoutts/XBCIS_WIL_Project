import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Optionally: log to server
    console.error('ErrorBoundary caught', error, info); // will appear in terminal/Vite, too
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position:'fixed', inset:0, background:'#fee', color:'#900',
          padding:24, fontFamily:'monospace', whiteSpace:'pre-wrap', overflow:'auto'
        }}>
          <h2>⚠️ Render error</h2>
          <div>{String(this.state.error?.message || this.state.error)}</div>
          <hr/>
          <div>{String(this.state.error?.stack || '')}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
