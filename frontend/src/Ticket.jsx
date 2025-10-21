import React, { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import { Link } from 'react-router-dom';
import "./styles/logticket.css";

function Ticket() {
  const { user } = useAuth(); // get logged-in user
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("Low");
  const [file, setFile] = useState(null); // file state
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.body.style.setProperty("overflow", "hidden", "important");

    return () => {
      document.body.style.setProperty("overflow", "auto", "important");
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!user?.userId) {
      setMessage("User not logged in.");
      return;
    }

    try {
      // Create the ticket first
      const resTicket = await fetch("/api/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          urgencyLevel: urgency
        }),
      });

      const dataTicket = await resTicket.json();
      if (!resTicket.ok) throw new Error(dataTicket?.message || "Error submitting ticket");

      // Upload file if selected
      if (file) {
        const formData = new FormData();
        formData.append("file", file);

        const resFile = await fetch(`/api/tickets/${dataTicket.ticketId}/media`, {
          method: "POST",
          body: formData,
          credentials: "include"
        });

        const dataFile = await resFile.json();
        if (!resFile.ok) throw new Error(dataFile?.message || "Error uploading file");
      }

      setDone(true);
      setTitle("");
      setDescription("");
      setUrgency("Low");
      setFile(null);
    } catch (err) {
      setMessage(err.message);
    }
  };

  if (done) {
    return (
      <div className="logticket">
        <nav className="navbar">
          <div className="navbar-logo">
            <img src="https://placehold.co/120x40" alt="logo" />
          </div>
          <div className="navbar-right">
            <ul className="navbar-menu">
              <li><Link to="/">Dashboard</Link></li>
              <li><Link to="/ticket">Tickets</Link></li>
              <li><Link to="/reports">Reports</Link></li>
              <li><Link to="/notifications">Notifications</Link></li>
              <li><Link to="/settings">Settings</Link></li>
            </ul>
          </div>
          <div className="navbar-profile">
            <img src="https://placehold.co/40" alt="profile" />
          </div>
        </nav>

        <div className="container-confirmation">
          <div className="header">
            <div className="text"><h2>Ticket Submitted</h2></div>
            <hr className="underline" />
          </div>
          <p className="text">Your ticket has been logged successfully. We'll keep you updated on its status.</p>
        </div>
      </div>
    );
  }

  // Original form view
  return (
    <div className="logticket">
      <nav className="navbar">
        <div className="navbar-logo">
          <div className="logo-placeholder">GoodLiving</div>
        </div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li><Link to="/">Dashboard</Link></li>
            <li><Link to="/ticket">Tickets</Link></li>
          {/*  <li><Link to="/reports">Reports</Link></li> */}
            <li><Link to="/notifications">Notifications</Link></li>
            <li><Link to="/settings">Settings</Link></li>
          </ul>
        </div>
        <div className="navbar-profile">
          <img src="https://placehold.co/40" alt="profile" />
        </div>
      </nav>

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
            />
          </div>

          <div className="input">
            <label className="input-head">Description of Issue</label>
            <textarea
              placeholder="Example: Tap in the kitchen does not work at all. The issue started 2 days ago."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
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
                />
              </label>
            </div>
          </div>
          <div className="final-submit">
            <button type="submit">Submit Ticket</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Ticket;