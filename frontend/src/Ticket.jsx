import React, { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import { Link, useNavigate } from "react-router-dom";
import "./styles/logticket.css";

function Ticket() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("Low");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.body.style.setProperty("overflow", "important");
    return () => document.body.style.setProperty("overflow", "auto", "important");
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!user?.userId) {
      setMessage("User not logged in.");
      return;
    }

    try {
      setSubmitting(true);

      // Create ticket
      const resTicket = await fetch("/api/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, urgencyLevel: urgency }),
      });
      const dataTicket = await resTicket.json();
      if (!resTicket.ok) throw new Error(dataTicket?.message || "Error submitting ticket");

      // Upload file if exists
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const resFile = await fetch(`/api/tickets/${dataTicket.ticketId}/media`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const dataFile = await resFile.json();
        if (!resFile.ok) throw new Error(dataFile?.message || "Error uploading file");
      }

      // Show confirmation message and redirect after 5 seconds
      setMessage("Ticket submitted successfully! Redirecting...");
      setTitle("");
      setDescription("");
      setUrgency("Low");
      setFile(null);

      setTimeout(() => navigate("/"), 5000); // redirect after 5s
    } catch (err) {
      setMessage(err.message);
      setSubmitting(false);
    }
  };

  // Navbar component for reuse
  const Navbar = () => (
    <nav className="navbar">
      <div className="navbar-logo">GoodLiving</div>
      <div className="navbar-right">
        <ul className="navbar-menu">
          <li><Link to="/">Dashboard</Link></li>
          <li><Link to="/ticket">Tickets</Link></li>
          <li><Link to="/settings">Settings</Link></li>
        </ul>
      </div>
      <div className="navbar-profile">
        <img src="https://placehold.co/40" alt="profile" />
      </div>
    </nav>
  );

  return (
    <div className="logticket">
      <Navbar />

      <div className="container">
        <div className="header">
          <div className="text"><h2>Log a New Ticket</h2></div>
          <hr className="underline" />
        </div>

        {message && <p className="server-msg">{message}</p>}

        <form className="inputs" onSubmit={handleSubmit}>
          <div className="input">
            <label className="input-head">Title</label>
            <input
              type="text"
              placeholder="Example: Broken Tap (Kitchen)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="input">
            <label className="input-head">Description of Issue</label>
            <textarea
              placeholder="Example: Tap in the kitchen does not work at all. The issue started 2 days ago."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="urgency-container">
            <label>Urgency Selection</label>
            <div className="urgency-options">
              {["Low", "Medium", "High", "Critical"].map((level) => (
                <label key={level}>
                  <input
                    type="radio"
                    value={level}
                    checked={urgency === level}
                    onChange={(e) => setUrgency(e.target.value)}
                    disabled={submitting}
                  />
                  {level}
                </label>
              ))}
            </div>
          </div>

          <div className="input">
            <label className="input-head attach-label">Attach Image/Video (optional)</label>
            <div className="submit-container">
              <label className="submit">
                {file ? file.name : "+ Add Photo/Video"}
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setFile(e.target.files[0])}
                  style={{ display: "none" }}
                  disabled={submitting}
                />
              </label>
            </div>
          </div>

          <div className="final-submit">
            <button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Ticket;
