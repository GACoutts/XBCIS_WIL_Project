import React, { useState } from "react";
import { Link } from 'react-router-dom'
import './styles/index.css';

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleLogin = async () => {
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Welcome, ${data.username || email}!`);
      } else {
        setError(data.message || "Invalid credentials");
      }
    } catch (err) {
      setError("Server error. Please try again later.");
    }
  };

  return (
    <div className="container">
      <img
        className="logo"
        src="https://placehold.co/100x30"
        alt="Logo"
      />
      <div className="header">
        <hr className="underline" />
        <div className="text">
          <h2>Login</h2>
        </div>
      </div>
      <div className="inputs">
        <div className="input">
          <label className="input-head">Email Address</label>
          <input
            type="email"
            placeholder="example@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="input">
          <label className="input-head">Password</label>
          <input
            type="password"
            placeholder="Password123@"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
      </div>
      {error && <p style={{ color: "red", fontSize: "12px" }}>{error}</p>}
      {success && <p style={{ color: "green", fontSize: "12px" }}>{success}</p>}
      <div className="submit-container">
        <div className="submit" onClick={handleLogin}>
          Login
        </div>
        <div className="no-account">
          No Account? <Link to="/signup" className="link"><b>Sign Up</b></Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
