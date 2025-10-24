import { useState } from 'react';
import './styles/forgotpassword.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

  const handleSubmit = async () => {
  setErr('');

  // Custom validation
  const trimmedEmail = email.trim();
  
  if (!trimmedEmail) {
    setErr('Please enter your email address');
    return;
  }
  
  if (!validateEmail(trimmedEmail)) {
    setErr('Please enter a valid email address');
    return;
  }

  try {
    const res = await fetch('/api/password/forgot-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail })
    });
    
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    
    if (!res.ok) {
      setErr(data.message || 'An error occurred. Please try again.');
      return;
    }
    
    setDone(true);
  } catch (error) {
    setErr('Network error. Please check your connection and try again.');
  }
};

const handleKeyPress = (e) => {
  if (e.key === 'Enter') {
    handleSubmit();
  }
};

  if (done) {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="header"><h2>Check your email</h2></div>
          <hr className="underline" />
          <p className="text">If your email is registered, we've sent a reset link to your inbox.</p>
        </div>
      </div>
    </div>
  );
}

  return (
  <div className="auth-page">
    <div className="auth-container">
      {err && <div className="alert-error">{err}</div>}
      <div className="auth-card">
        <div className="header"><h2>Forgot password</h2></div>
        <hr className="underline" />
        <div className="inputs">
          <div className="input">
            <label className="input-head" htmlFor="email">Email</label>
            <input 
              id="email" 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyPress}
              autoComplete="email"
            />
          </div>
        </div>
        <div className="submit-container">
          <button className="submit" type="button" onClick={handleSubmit}>
            Send reset link
          </button>
        </div>
      </div>
    </div>
  </div>
);
}
