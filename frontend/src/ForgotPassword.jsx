import { useState } from 'react';
import './styles/forgotpassword.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      // Always shows a generic message
      await res.json();
      setDone(true);
    } catch (e) {
      setDone(true); // still show generic message
    }
  };

  if (done) {
    return (
      <div className="auth-page">
        <form className="auth-card">
          <div className="header"><h2>Check your email</h2></div>
          <hr className="underline" />
          <p className="text">If your email is registered, we’ve sent a reset link to your inbox.</p>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="header"><h2>Forgot password</h2></div>
        <hr className="underline" />
        {err && <div className="alert-error">{err}</div>}
        <div className="inputs">
          <div className="input">
            <label className="input-head" htmlFor="email">Email</label>
            <input id="email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </div>
        <div className="submit-container">
          <button className="submit" type="submit">Send reset link</button>
        </div>
      </form>
    </div>
  );
}
