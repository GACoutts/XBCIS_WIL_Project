import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { getProperties, addProperty } from "./landlordApi";
import "./styles/landlorddash.css";
import AddressPicker from "./components/AddressPicker.jsx";

/**
 * LandlordProperties
 *
 * View landlord properties + add new properties.
 * Old manual address fields removed — we now rely solely on Google address.
 */
export default function LandlordProperties() {
  const { logout } = useAuth();

  const [showLogout, setShowLogout] = useState(false);
  const [properties, setProperties] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const [proofFile, setProofFile] = useState(null);

  // Google-picked location for the property being added
  // { address, placeId, latitude, longitude }
  const [loc, setLoc] = useState(null);

  // Load properties on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await getProperties();
        setProperties(res.success ? (res.data || []) : []);
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

  const resetModal = () => {
    setShowAddModal(false);
    setProofFile(null);
    setLoc(null);
  };

  const handleAddProperty = async () => {
    if (!loc?.placeId) {
      alert("Please select the property from the Google address box.");
      return;
    }
    if (!proofFile) {
      alert("Please upload a proof document for this property.");
      return;
    }

    try {
      const fd = new FormData();

      // New simplified model: send single address + geo from Google
      fd.append("address", loc.address || "");
      fd.append("placeId", String(loc.placeId));
      if (typeof loc.latitude === "number") fd.append("latitude", String(loc.latitude));
      if (typeof loc.longitude === "number") fd.append("longitude", String(loc.longitude));

      fd.append("proof", proofFile);

      const res = await addProperty(fd);
      if (res.success) {
        // Reload list after successful add
        const listRes = await getProperties();
        setProperties(listRes.success ? listRes.data || [] : []);
        resetModal();
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
              <Link to="/notifications">Notifications</Link>
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
          style={{
            backgroundColor: "#FBD402",
            color: "black",
            border: "none",
            borderRadius: "5px",
            padding: "8px 16px",
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: "20px",
          }}
          onClick={() => setShowAddModal(true)}
        >
          Add Property
        </button>

        {properties.length ? (
          <div style={{ display: "grid", gap: "15px" }}>
            {properties.map((p) => (
              <div
                key={p.PropertyID || p.propertyId || `${p.PlaceId || p.placeId || "addr"}-${Math.random()}`}
                style={{
                  border: "1px solid #FBD402",
                  borderRadius: 6,
                  padding: 16,
                  background: "white",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Property ID: {p.PropertyID || p.propertyId || "—"}
                </div>

                {/* Try to display a friendly address from either the old structure
                    (AddressLine1..PostalCode) or a single `Address` field */}
                <div style={{ marginBottom: 4 }}>
                  <strong>Address:</strong>{" "}
                  {p.Address
                    ? p.Address
                    : [
                        p.AddressLine1,
                        p.AddressLine2,
                        p.City,
                        p.Province,
                        p.PostalCode,
                      ]
                        .filter((x) => x && x.toString().trim())
                        .join(", ") || "—"}
                </div>

                <div style={{ marginBottom: 4 }}>
                  <strong>Tenant:</strong>{" "}
                  {p.TenantName ? `${p.TenantName} (${p.TenantEmail})` : "—"}
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
          <div className="modal" style={{ maxWidth: 520 }}>
            <h2>Add Property</h2>
            <div className="modal-content">
              <div className="field" style={{ marginTop: 10 }}>
                <label>Property Address (Google)*</label>
                <AddressPicker onSelect={setLoc} />
                {loc?.address && <small>Selected: {loc.address}</small>}
              </div>

              <label style={{ marginTop: 10 }}>Proof (PDF/Image)*</label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="modal-buttons" style={{ marginTop: 20 }}>
              <button onClick={handleAddProperty}>Add</button>
              <button onClick={resetModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
