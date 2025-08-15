import React, { useState } from "react";
import { Link } from "react-router-dom";
import './styles/signup.css';

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "tenant",
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleRoleChange = (role) => {
    setFormData({ ...formData, role });
  };

  const validate = () => {
    let newErrors = {};

    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!formData.email.includes("@")) newErrors.email = "Valid email required";
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    if (formData.password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    console.log("Signup successful:", formData);
    alert("Account created successfully!");
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      role: "tenant",
    });
  };

  return (
    <div className="signup-page-container">
      <div className="signup-container">
        <div className="logo-placeholder">Logo Will Go Here</div>

        <div className="header">
          <h2>Create An Account:</h2>
        </div>
        <hr className="underline" />

        <form className="inputs" onSubmit={handleSubmit}>
          <div className="input">
            <div className="input-head">Full Name:</div>
            <input
              type="text"
              name="fullName"
              placeholder="E.G. John Doe"
              value={formData.fullName}
              onChange={handleChange}
            />
            {errors.fullName && <p className="error">{errors.fullName}</p>}
          </div>

          <div className="input">
            <div className="input-head">Email Address:</div>
            <input
              type="email"
              name="email"
              placeholder="E.G. example@mail.com"
              value={formData.email}
              onChange={handleChange}
            />
            {errors.email && <p className="error">{errors.email}</p>}
          </div>

          <div className="input">
            <div className="input-head">Phone Number:</div>
            <input
              type="tel"
              name="phone"
              placeholder="E.G. +12 34 567 8901"
              value={formData.phone}
              onChange={handleChange}
            />
            {errors.phone && <p className="error">{errors.phone}</p>}
          </div>

          <div className="input">
            <div className="input-head">Password:</div>
            <input
              type="password"
              name="password"
              placeholder="E.G. Password123@"
              value={formData.password}
              onChange={handleChange}
            />
            {errors.password && <p className="error">{errors.password}</p>}
          </div>

          <div className="input">
            <div className="input-head">Confirm Password:</div>
            <input
              type="password"
              name="confirmPassword"
              placeholder="E.G. Password123@"
              value={formData.confirmPassword}
              onChange={handleChange}
            />
            {errors.confirmPassword && (
              <p className="error">{errors.confirmPassword}</p>
            )}
          </div>

          <div className="role-selection">
            <div
              className={`role-circle ${formData.role === "tenant" ? "active" : ""}`}
              onClick={() => handleRoleChange("tenant")}
            ></div>
            <span>Tenant</span>

            <div
              className={`role-circle ${formData.role === "landlord" ? "active" : ""}`}
              onClick={() => handleRoleChange("landlord")}
            ></div>
            <span>Landlord</span>

            <div
              className={`role-circle ${formData.role === "contractor" ? "active" : ""}`}
              onClick={() => handleRoleChange("contractor")}
            ></div>
            <span>Contractor</span>

            <div
              className={`role-circle ${formData.role === "rawson" ? "active" : ""}`}
              onClick={() => handleRoleChange("rawson")}
            ></div>
            <span>Rawson</span>
          </div>

          <div className="submit-container">
            <button type="submit" className="submit">Sign Up</button>
          </div>
        </form>

        <div className="got-account">
          Got an account? <Link to="/login" className="link">Sign In</Link>
        </div>
        <div className="forgot-password">
          Forgot Password? <Link to="/login" className="link"><b>Reset Here</b></Link>
        </div>
      </div>
    </div>
  );
}
