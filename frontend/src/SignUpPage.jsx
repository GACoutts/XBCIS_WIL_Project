import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./styles/signup.css";

// Map UI role keys to backend roles
const ROLE_MAP = {
  tenant: "Client",
  landlord: "Landlord",
  contractor: "Contractor",
  rawson: "Staff",
};

export default function SignUpPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "tenant", // UI key; will be mapped for API
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((s) => ({ ...s, [name]: value }));
  };

  const handleRoleChange = (role) => {
    setFormData((s) => ({ ...s, role }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";

    const email = formData.email.trim();
    if (!email) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Enter a valid email";

    // Phone optional — remove this if we want it required (cant remember):
    // if (!formData.phone.trim()) newErrors.phone = "Phone number is required";

    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";

    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    // Ensure role is one of our UI keys
    if (!Object.keys(ROLE_MAP).includes(formData.role))
      newErrors.role = "Please select a valid role";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");
    setSuccessMsg("");

    if (!validate()) return;

    setSubmitting(true);
    try {
      // 1) Register
      const apiRole = ROLE_MAP[formData.role]; // map UI role to backend role enum
      const res = await fetch("/api/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          password: formData.password,
          role: apiRole,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Registration failed");
      }

      setSuccessMsg("Account created successfully. Signing you in…");

      // 2) Auto-login (sets HttpOnly cookie)
      const loginRes = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      // If auto-login fails, just send them to /login
      if (!loginRes.ok) {
        navigate("/login", { replace: true });
        return;
      }

      // 3) Go to app root
      navigate("/", { replace: true });
    } catch (err) {
      setServerError(err.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="signup-page-container">
      <div className="signup-container">
        <div className="logo-placeholder">Logo will go here</div>

        <div className="header">
          <h2>Create An Account</h2>
        </div>
        <hr className="underline" />

        {/* Server messages */}
        {serverError ? <p className="error" style={{ marginTop: 8 }}>{serverError}</p> : null}
        {successMsg ? <p className="success" style={{ marginTop: 8 }}>{successMsg}</p> : null}

        <form className="inputs" onSubmit={handleSubmit} noValidate>
          <div className="input">
            <div className="input-head">Full name</div>
            <div className="input-row">
            <input
              type="text"
              name="fullName"
              placeholder="E.G. John Doe"
              value={formData.fullName}
              onChange={handleChange}
              required
            />
            {errors.fullName && <span className="error">{errors.fullName}</span>}
          </div>
          </div>

          <div className="input">
            <div className="input-head">Email address</div>
            <div className="input-row">
            <input
              type="email"
              name="email"
              placeholder="E.G. example@mail.com"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="username"
            />
            {errors.email && <span className="error">{errors.email}</span>}
          </div>
          </div>

          <div className="input">
            <div className="input-head">Phone number (optional)</div>
            <div className="input-row">
            <input
              type="tel"
              name="phone"
              placeholder="E.G. +27 12 345 6789"
              value={formData.phone}
              onChange={handleChange}
            />
            {errors.phone && <span className="error">{errors.phone}</span>}
          </div>
          </div>

          <div className="input">
            <div className="input-head">Password</div>
            <div className="input-row">
            <input
              type="password"
              name="password"
              placeholder="Minimum 8 characters"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
            {errors.password && <span className="error">{errors.password}</span>}
          </div>
          </div>

          <div className="input">
            <div className="input-head">Confirm password</div>
            <div className="input-row">
            <input
              type="password"
              name="confirmPassword"
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
            {errors.confirmPassword && <span className="error">{errors.confirmPassword}</span>}
          </div>
          </div>

          <div className="submit-container">
            <button type="submit" className="submit" disabled={submitting}>
              {submitting ? "Creating account…" : "Sign up"}
            </button>
          </div>
        </form>

        <div className="role-selection">
            <div
              className={`role-circle ${formData.role === "tenant" ? "active" : ""}`}
              onClick={() => handleRoleChange("tenant")}
              title="Tenant (Client)"
            ></div>
            <span>Tenant</span>

            <div
              className={`role-circle ${formData.role === "landlord" ? "active" : ""}`}
              onClick={() => handleRoleChange("landlord")}
              title="Landlord"
            ></div>
            <span>Landlord</span>

            <div
              className={`role-circle ${formData.role === "contractor" ? "active" : ""}`}
              onClick={() => handleRoleChange("contractor")}
              title="Contractor"
            ></div>
            <span>Contractor</span>

            <div
              className={`role-circle ${formData.role === "rawson" ? "active" : ""}`}
              onClick={() => handleRoleChange("rawson")}
              title="Rawson Staff"
            ></div>
            <span>Rawson</span>
          </div>
          {errors.role && <p className="error">{errors.role}</p>}

        <div className="got-account">
          Got an account? <Link to="/login" className="link">Sign in</Link>
        </div>
        <div className="forgot-password">
          Forgot password? <Link to="/login" className="link">Reset here</Link>
        </div>
      </div>
    </div>
  );
}
