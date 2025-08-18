import React, { useState } from "react";
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext';
import './styles/index.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onChange = (e) => {
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <h2>Sign in</h2>

        {error ? <div className="alert-error">{error}</div> : null}

        <label>
          Email
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={form.email}
            onChange={onChange}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={form.password}
            onChange={onChange}
            required
          />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="login-footer">
          <span>No account?</span> <Link to="/signup">Create one</Link>
        </div>
      </form>
    </div>
  );
}