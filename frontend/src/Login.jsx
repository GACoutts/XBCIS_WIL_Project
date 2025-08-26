import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import "./styles/login.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onChange = (e) => {
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page-container">
      <form className="container" onSubmit={onSubmit} noValidate>
        <div className="header">
          <div className="logo-placeholder">Logo Will Go Here</div>
          <h2>Sign in</h2>
        </div>

        <hr className="underline" />

        {error ? <div className="alert-error">{error}</div> : null}

        <div className="inputs">
          <div className="input">
            <label className="input-head" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="E.G. example@mail.com"
              autoComplete="username"
              value={form.email}
              onChange={onChange}
              required
            />
          </div>

          <div className="input">
            <label className="input-head" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="E.G. Password123"
              autoComplete="current-password"
              value={form.password}
              onChange={onChange}
              required
            />
          </div>
        </div>

        <div className="submit-container">
          <button type="submit" className="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </div>

        <div className="no-account">
          <div>
          <span>No account? </span>
          <Link to="/signup">Create one</Link>
          </div>
          <div>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
        </div>
      </form>
    </div>
  );
}
