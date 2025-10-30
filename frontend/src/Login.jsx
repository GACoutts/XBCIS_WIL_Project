import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./styles/login.css";
import { useAuth } from "./context/AuthContext";

export default function Login() {
  const { login } = useAuth(); // Use AuthContext
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
      // Use context login instead of direct fetch
      const user = await login(form.email.trim(), form.password);

      // Redirect based on role (exact capitalization)
      switch (user.role) {
        case "Landlord":
          navigate("/landlord", { replace: true });
          break;
        case "Client":
          navigate("/", { replace: true });
          break;
        case "Contractor":
          navigate("/contractor", { replace: true });
          break;
        case "Staff":
          navigate("/staff", { replace: true });
          break;
        default:
          navigate("/", { replace: true });
      }
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page-container">
      {error && <div className="alert-error">{error}</div>}

      <form className="container" onSubmit={onSubmit} noValidate>
        <div className="header">
          <div className="logo-placeholder">GoodLiving</div>
          <h2>Login</h2>
        </div>

        <hr className="underline" />

        <div className="inputs">
          <div className="input">
            <label className="input-head" htmlFor="email">Email:</label>
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
            <label className="input-head" htmlFor="password">Password:</label>
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
            {submitting ? "Signing in…" : "Login"}
          </button>
        </div>

        <div className="no-account">
          <div>
            <span>No account? </span>
            <Link to="/signup" className="link">Create one</Link>
          </div>
          <div className="forgot-password">
            Forgot password? <Link to="/forgot-password" className="link">Reset here</Link>
          </div>
        </div>

      </form>
    </div>
  );
}
