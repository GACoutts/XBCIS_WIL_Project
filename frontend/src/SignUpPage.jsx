import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./styles/signup.css";
import { useAuth } from "./context/AuthContext";

// Map UI role keys to backend roles
const ROLE_MAP = {
  tenant: "Client",
  landlord: "Landlord",
  contractor: "Contractor",
  rawson: "Staff",
};

export default function SignUpPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  // Collect registration fields.  When signing up as a tenant/client or landlord
  // we also capture a property address and a supporting document (lease or
  // ownership proof).  These values will be sent to the backend via a
  // multipart/form-data request when appropriate.  The `proofFile` state is
  // separated because file inputs cannot be directly stored on objects.
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "tenant", // UI key; will be mapped for API
    address: "",      // property address for tenants/landlords
  });
  const [proofFile, setProofFile] = useState(null);

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [registered, setRegistered] = useState(false); // <-- added

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

    // When the user selects the tenant or landlord role, they must provide
    // a property address and upload a supporting proof document.  File
    // selection is tracked in proofFile state rather than on formData.
    const apiRole = ROLE_MAP[formData.role];
    if (apiRole === 'Client' || apiRole === 'Landlord') {
      if (!formData.address.trim()) newErrors.address = 'Address is required';
      if (!proofFile) newErrors.proof = 'Proof document is required';
    }

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
      const apiRole = ROLE_MAP[formData.role];

      // Determine whether we need to send a multipart form.  Tenants (clients)
      // and landlords must provide an address and supporting document.
      const needsProof = apiRole === 'Client' || apiRole === 'Landlord';

      if (needsProof) {
        // Assemble a FormData payload.  Multer on the backend will parse
        // multipart/form-data and populate req.body and req.file accordingly.
        const fd = new FormData();
        fd.append('fullName', formData.fullName.trim());
        fd.append('email', formData.email.trim());
        fd.append('phone', formData.phone.trim() || '');
        fd.append('password', formData.password);
        fd.append('role', apiRole);
        fd.append('address', formData.address.trim());
        if (proofFile) fd.append('proof', proofFile);

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          credentials: 'include',
          body: fd
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Registration failed');

        if (data?.requiresApproval) {
          setSuccessMsg('Your account has been registered successfully. Please await account approval.');
          setRegistered(true); // <-- added
        } else {
          setSuccessMsg('Account created successfully. You\'re in!');
          navigate('/', { replace: true });
        }
      } else {
        // Use the existing register helper for roles that do not require proof
        const response = await register({
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          password: formData.password,
          role: apiRole,
        });
        if (response?.requiresApproval) {
          setSuccessMsg('Your account has been registered successfully. Please await account approval.');
          setRegistered(true); // <-- added
        } else {
          setSuccessMsg('Account created successfully. You\'re in!');
          navigate('/', { replace: true });
        }
      }
    } catch (err) {
      setServerError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="signup-page-container">
      <div className="signup-container">
        <div className="logo-placeholder">GoodLiving</div>

        <div className="header">
          <h2>Create An Account</h2>
        </div>
        <hr className="underline" />

        {/* Success notice (when approval is required) */}
        {registered && successMsg && (
          <div className="success" style={{ marginTop: 8 }}>
            {successMsg}
            <div style={{ marginTop: 8 }}>
              <Link to="/login" className="submit" role="button">Go to login</Link>
            </div>
          </div>
        )}

        {/* Show the form only if not registered yet */}
        {!registered && (
          <form className="inputs" onSubmit={handleSubmit} noValidate>
            <div className="input">
              <div className="input-head">Full name:</div>
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
                {serverError && !errors.fullName && <span className="error">{serverError}</span>}
              </div>
            </div>

            <div className="input">
              <div className="input-head">Email address:</div>
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
              <div className="input-head">Phone number:</div>
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

            {/* Address and proof fields for tenants and landlords */}
            {(formData.role === 'tenant' || formData.role === 'landlord') && (
              <>
                <div className="input">
                  <div className="input-head">Property Address:</div>
                  <div className="input-row">
                    <input
                      type="text"
                      name="address"
                      placeholder="Enter your property address"
                      value={formData.address}
                      onChange={handleChange}
                      required
                    />
                    {errors.address && <span className="error">{errors.address}</span>}
                  </div>
                </div>
                <div className="input">
                  <div className="input-head">Proof of Occupancy/Ownership:</div>
                  <div className="input-row">
                    <input
                      id="proof"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setProofFile(e.target.files[0])}
                      required
                    />
                    <label
                      htmlFor="proof"
                      className={`file-trigger ${proofFile ? 'has-file' : 'placeholder'}`}
                      title={proofFile ? proofFile.name : 'Choose file…'}
                    >
                      {proofFile ? proofFile.name : 'Choose file…'}
                    </label>
                  </div>
                  {errors.proof && <span className="error">{errors.proof}</span>}
                </div>

              </>
            )}

            <div className="input">
              <div className="input-head">Password:</div>
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
              <div className="input-head">Confirm password:</div>
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
        )}

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
          Forgot password? <Link to="/forgot-password" className="link">Reset here</Link>
        </div>
      </div>
    </div>
  );
}
