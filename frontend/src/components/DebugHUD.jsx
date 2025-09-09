import { useEffect, useState } from 'react';

export default function DebugHUD() {
  const [state, setState] = useState({ status: 'boot', payload: null, time: '' });

  useEffect(() => {
    const t = new Date().toLocaleTimeString();
    setState(s => ({ ...s, time: t }));

    fetch('/api/me', { credentials: 'include' })
      .then(async r => {
        const data = await r.json().catch(() => ({}));
        setState({ status: r.status, payload: data, time: t });
      })
      .catch(e => setState({ status: 'error', payload: String(e), time: t }));
  }, []);

  return (
    <div style={{
      position:'fixed', right:8, bottom:8, background:'#111', color:'#0f0',
      padding:'8px 10px', borderRadius:8, fontFamily:'monospace', fontSize:12, zIndex:999999
    }}>
      <div>DebugHUD @ {state.time}</div>
      <div>/api/me → <strong>{String(state.status)}</strong></div>
      <pre style={{maxWidth:360, maxHeight:180, overflow:'auto', margin:0}}>
        {JSON.stringify(state.payload, null, 2)}
      </pre>
    </div>
  );
}
