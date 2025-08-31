import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import './styles/resetpassword.css';

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const token = sp.get('token') || '';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    if (!token) setMsg('Invalid Reset Link');
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    if (!pw || pw.length < 8) {
      setMsg('Password must be at least 8 characters long.');
      return;
    }
    if (pw !== pw2) {
      setMsg('Passwords do not match.');
      return;
    }
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw })
      });
      const data = await res.json();
      if (!res.ok) return setMsg(data.message || 'Could not reset password.');
      setMsg('Password reset! Redirecting to login…');
      setTimeout(() => nav('/login'), 1200);
    } catch {
      setMsg('Could not reset password.');
    }
  };

  return (
    <div className="auth-page">
      
        {msg && (
        <div className="alert-error">
      {msg}
      </div>
    )}
    <div className="auth-wrapper">
    <form className="auth-card" onSubmit={submit}>
        <div className="header"><h2>Set New Password</h2></div>
        <hr className="underline" />
        <div className="inputs">
          <div className="input">
            <label className="input-head" htmlFor="pw">New Password</label>
            <input id="pw" type="password" value={pw} onChange={(e)=>setPw(e.target.value)} required />
          </div>
          <div className="input">
            <label className="input-head" htmlFor="pw2">Confirm Password</label>
            <input id="pw2" type="password" value={pw2} onChange={(e)=>setPw2(e.target.value)} required />
          </div>
        </div>
        <div className="submit-container">
          <button className="submit" type="submit">Reset Password</button>
        </div>
        <div className="no-account">
          <Link to="/login">Back to login</Link>
        </div>
      </form>
    </div>
    </div>
  );
}
