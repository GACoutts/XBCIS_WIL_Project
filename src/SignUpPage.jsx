import React, { useState } from "react";
import './styles/signup.css';

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "tenant", // default
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleRoleChange = (role) => {
    setFormData({ ...formData, role });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    console.log("Form submitted:", formData);
    alert("Account created successfully!");
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
              required
            />
          </div>

          <div className="input">
            <div className="input-head">Email Address:</div>
            <input
              type="email"
              name="email"
              placeholder="E.G. example@mail.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input">
            <div className="input-head">Phone Number:</div>
            <input
              type="tel"
              name="phone"
              placeholder="E.G. +12 34 567 8901"
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input">
            <div className="input-head">Password:</div>
            <input
              type="password"
              name="password"
              placeholder="E.G. Password123@"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input">
            <div className="input-head">Confirm Password:</div>
            <input
              type="password"
              name="confirmPassword"
              placeholder="E.G. Password123@"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
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

        <div className="no-account">
          Got an account? <span>Sign In</span>
        </div>
        <div className="no-account">
          Forgot Password? <span>Reset Here</span>
        </div>
      </div>
    </div>
  );
}
