import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./styles/signup.css";
import { useAuth } from "./context/AuthContext";
import AddressPicker from "./components/AddressPicker.jsx";

// Map UI role keys to backend roles
const ROLE_MAP = {
  tenant: "Client",
  landlord: "Landlord",
  contractor: "Contractor",
  rawson: "Staff",
};

// Keep PlaceId short and remove any "places/" prefix (defensive)
function safePlaceId(pid) {
  return (pid || "").replace(/^places\//, "").slice(0, 64);
}

export default function SignUpPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "tenant",
  });
  const [proofFile, setProofFile] = useState(null);

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [registered, setRegistered] = useState(false);

  // Selected Google location: { address, placeId, latitude, longitude }
  const [loc, setLoc] = useState(null);

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

    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";

    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";

    if (!Object.keys(ROLE_MAP).includes(formData.role))
      newErrors.role = "Please select a valid role";

    const apiRole = ROLE_MAP[formData.role];

    // For Client/Landlord: require Google address + proof
    if (apiRole === "Client" || apiRole === "Landlord") {
      if (!loc?.placeId)
        newErrors.google = "Please select your address from Google suggestions";
      if (!proofFile) newErrors.proof = "Proof document is required";
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
      const needsProof = apiRole === "Client" || apiRole === "Landlord";

      const pid = safePlaceId(loc?.placeId);
      const lat = loc?.latitude ?? null;
      const lng = loc?.longitude ?? null;

      if (needsProof) {
        const fd = new FormData();
        fd.append("fullName", formData.fullName.trim());
        fd.append("email", formData.email.trim());
        fd.append("phone", formData.phone.trim() || "");
        fd.append("password", formData.password);
        fd.append("role", apiRole);

        // Address is from Google selection
        fd.append("address", (loc?.address || "").trim());
        fd.append("placeId", pid);
        if (lat != null) fd.append("latitude", String(lat));
        if (lng != null) fd.append("longitude", String(lng));

        if (proofFile) fd.append("proof", proofFile);

        const res = await fetch("/api/auth/register", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Registration failed");

        if (data?.requiresApproval) {
          setSuccessMsg(
            "Your account has been registered successfully. Please await account approval."
          );
          setRegistered(true);
        } else {
          setSuccessMsg("Account created successfully. You're in!");
          navigate("/", { replace: true });
        }
      } else {
        // Non-proof roles, still send Google geo if available
        const response = await register({
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          password: formData.password,
          role: apiRole,
          placeId: pid || null,
          latitude: lat,
          longitude: lng,
        });
        if (response?.requiresApproval) {
          setSuccessMsg(
            "Your account has been registered successfully. Please await account approval."
          );
          setRegistered(true);
        } else {
          setSuccessMsg("Account created successfully. You're in!");
          navigate("/", { replace: true });
        }
      }
    } catch (err) {
      setServerError(err.message || "Registration failed");
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

        {registered && successMsg && (
          <div className="success" style={{ marginTop: 8 }}>
            {successMsg}
            <div style={{ marginTop: 8 }}>
              <Link to="/login" className="submit" role="button">
                Go to login
              </Link>
            </div>
          </div>
        )}

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
              </div>
              {errors.fullName && <span className="error">{errors.fullName}</span>}
              {serverError && !errors.fullName && <span className="error">{serverError}</span>}
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
              </div>
              {errors.email && <span className="error">{errors.email}</span>}
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
              </div>
              {errors.phone && <span className="error">{errors.phone}</span>}
            </div>

            {(formData.role === "tenant" || formData.role === "landlord") && (
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
                    className={`file-trigger ${proofFile ? "has-file" : "placeholder"}`}
                    title={proofFile ? proofFile.name : "Choose file…"}
                  >
                    {proofFile ? proofFile.name : "Choose file…"}
                  </label>
                </div>
                {errors.proof && <span className="error">{errors.proof}</span>}
              </div>
            )}

            {/* Google Address */}
            {(formData.role === "tenant" || formData.role === "landlord") && (
              <div className="input">
                <div className="input-head">Home/Property Address (Google):</div>
                <div className="input-row">
                  <AddressPicker onSelect={setLoc} className="address-picker-input" />
                </div>
                {errors.google && <span className="error">{errors.google}</span>}
                {loc?.address && <small>Selected: {loc.address}</small>}
              </div>
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
              </div>
              {errors.password && <span className="error">{errors.password}</span>}
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
              </div>
              {errors.confirmPassword && (
                <span className="error">{errors.confirmPassword}</span>
              )}
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
