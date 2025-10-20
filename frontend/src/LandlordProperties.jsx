import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import {
  getProperties,
  addProperty
} from "./landlordApi";

import "./styles/landlorddash.css";

/**
 * LandlordProperties
 *
 * This page allows a landlord to view all of the properties currently
 * associated with their account and to add additional properties.  Each
 * property displays its address and, if applicable, the name and email
 * of the current tenant.  When adding a property the landlord must
 * supply the address fields and upload a proof document.  The proof can
 * be an image or PDF demonstrating ownership or authorization for the
 * property.
 */
export default function LandlordProperties() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [showLogout, setShowLogout] = useState(false);
  const [properties, setProperties] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProperty, setNewProperty] = useState({
    addressLine1: "",
    addressLine2: "",
    city: "",
    province: "",
    postalCode: ""
  });
  const [proofFile, setProofFile] = useState(null);

  // Load properties on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await getProperties();
        if (res.success) setProperties(res.data || []);
        else setProperties([]);
      } catch (err) {
        console.error("Error loading properties", err);
        setProperties([]);
      }
    })();
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  const handleChange = (field, value) => {
    setNewProperty((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddProperty = async () => {
    if (!newProperty.addressLine1 || !newProperty.city || !newProperty.province || !newProperty.postalCode) {
      alert("Please fill out the required address fields (line 1, city, province, postal code).");
      return;
    }
    if (!proofFile) {
      alert("Please upload a proof document for this property.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("addressLine1", newProperty.addressLine1);
      fd.append("addressLine2", newProperty.addressLine2);
      fd.append("city", newProperty.city);
      fd.append("province", newProperty.province);
      fd.append("postalCode", newProperty.postalCode);
      fd.append("proof", proofFile);
      const res = await addProperty(fd);
      if (res.success) {
        // Reload property list
        const listRes = await getProperties();
        setProperties(listRes.success ? listRes.data || [] : []);
        // Reset modal
        setShowAddModal(false);
        setNewProperty({ addressLine1: "", addressLine2: "", city: "", province: "", postalCode: "" });
        setProofFile(null);
        alert("Property added successfully.");
      } else {
        alert(res.message || "Failed to add property.");
      }
    } catch (err) {
      console.error("Error adding property", err);
      alert("An error occurred while adding the property. Please try again.");
    }
  };

  return (
    <>
      {/* Navbar replicating Landlord layout */}
      <nav className="navbar">
        <div className="navbar-logo">
          <div className="logo-placeholder">GoodLiving</div>
        </div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li>
              <Link to="/landlord">Dashboard</Link>
            </li>
            <li>
              <Link to="/landlord/tickets">Tickets</Link>
            </li>
            <li>
              <Link to="/landlord/properties" className="active">
                Properties
              </Link>
            </li>
            <li>
              <Link to="/landlord/settings">Settings</Link>
            </li>
          </ul>
        </div>
        <div className="navbar-profile">
          <button
            className="profile-btn"
            onClick={() => setShowLogout(!showLogout)}
          >
            <img src="https://placehold.co/40" alt="profile" />
          </button>
          {showLogout && (
            <div className="logout-popup">
              <button onClick={handleLogout}>Log Out</button>
            </div>
          )}
        </div>
      </nav>

      <div style={{ padding: "80px 90px 40px" }}>
        <h1 style={{ marginBottom: "20px" }}>My Properties</h1>
        <button
          style={{ backgroundColor: "#FBD402", color: "black", border: "none", borderRadius: "5px", padding: "8px 16px", fontWeight: 600, cursor: "pointer", marginBottom: "20px" }}
          onClick={() => setShowAddModal(true)}
        >
          Add Property
        </button>
        {properties.length ? (
          <div style={{ display: "grid", gap: "15px" }}>
            {properties.map((p) => (
              <div
                key={p.PropertyID}
                style={{ border: "1px solid #FBD402", borderRadius: 6, padding: 16, background: "white" }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Property ID: {p.PropertyID}
                </div>
                <div style={{ marginBottom: 4 }}>
                  <strong>Address:</strong> {[
                    p.AddressLine1,
                    p.AddressLine2,
                    p.City,
                    p.Province,
                    p.PostalCode
                  ]
                    .filter((x) => x && x.toString().trim())
                    .join(", ") || "—"}
                </div>
                <div style={{ marginBottom: 4 }}>
                  <strong>Tenant:</strong> {p.TenantName ? `${p.TenantName} (${p.TenantEmail})` : "—"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "#666" }}>No properties found.</p>
        )}
      </div>

      {/* Add Property Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 500 }}>
            <h2>Add Property</h2>
            <div className="modal-content">
              <label>Address Line 1*</label>
              <input
                type="text"
                value={newProperty.addressLine1}
                onChange={(e) => handleChange("addressLine1", e.target.value)}
              />
              <label>Address Line 2</label>
              <input
                type="text"
                value={newProperty.addressLine2}
                onChange={(e) => handleChange("addressLine2", e.target.value)}
              />
              <label>City*</label>
              <input
                type="text"
                value={newProperty.city}
                onChange={(e) => handleChange("city", e.target.value)}
              />
              <label>Province*</label>
              <input
                type="text"
                value={newProperty.province}
                onChange={(e) => handleChange("province", e.target.value)}
              />
              <label>Postal Code*</label>
              <input
                type="text"
                value={newProperty.postalCode}
                onChange={(e) => handleChange("postalCode", e.target.value)}
              />
              <label>Proof (PDF/Image)*</label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="modal-buttons" style={{ marginTop: 20 }}>
              <button onClick={handleAddProperty}>Add</button>
              <button onClick={() => setShowAddModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}