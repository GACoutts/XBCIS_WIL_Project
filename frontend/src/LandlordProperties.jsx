import React, { useEffect, useState } from "react";
import RoleNavbar from "./components/RoleNavbar.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { getProperties, addProperty } from "./landlordApi";
import "./styles/userdash.css";
import "./styles/landlorddash.css";
import AddressPicker from "./components/AddressPicker.jsx";

export default function LandlordProperties() {
  const { logout } = useAuth();

  const [showAddModal, setShowAddModal] = useState(false);
  const [properties, setProperties] = useState([]);
  const [proofFile, setProofFile] = useState(null);
  const [loc, setLoc] = useState(null);

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
      fd.append("address", loc.address || "");
      fd.append("placeId", String(loc.placeId));
      if (typeof loc.latitude === "number") fd.append("latitude", String(loc.latitude));
      if (typeof loc.longitude === "number") fd.append("longitude", String(loc.longitude));
      fd.append("proof", proofFile);

      const res = await addProperty(fd);
      if (res.success) {
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

  const rows = properties.map((p) => ({
    id: p.PropertyID || p.propertyId || "-",
    address:
      p.Address ||
      [p.AddressLine1, p.AddressLine2, p.City, p.Province, p.PostalCode]
        .filter((x) => x && x.toString().trim())
        .join(", ") ||
      "-",
    tenant: p.TenantName ? `${p.TenantName} (${p.TenantEmail})` : "-",
  }));

  return (
    <div className="dashboard-page">
      <RoleNavbar />

      <div className="content" style={{ padding: "20px 24px 40px" }}>
        <div className="dashboard-title">
          <h1 style={{ margin: 0 }}>My Properties</h1>
          <button className="action-btn" onClick={() => setShowAddModal(true)}>Add Property</button>
        </div>

        <div className="jobs-section">
          {rows.length === 0 ? (
            <div className="empty-tickets">No properties found.</div>
          ) : (
            <div className="jobs-table-container">
              <div className="jobs-table-scroll">
                <table className="jobs-table">
                  <thead>
                    <tr>
                      <th>Property ID</th>
                      <th>Address</th>
                      <th>Tenant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td className="issue-cell">
                          <div className="issue-inner">
                            <div className="issue-desc">{r.address}</div>
                          </div>
                        </td>
                        <td>{r.tenant}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
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
    </div>
  );
}
