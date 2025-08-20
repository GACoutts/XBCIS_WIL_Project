import React, { useState } from "react";
import { useAuth } from "./context/AuthContext";
import "./styles/logticket.css";

function Ticket() {
  const { user } = useAuth(); // get logged-in user
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("Low");
  const [file, setFile] = useState(null); // file state
  const [message, setMessage] = useState("");

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
          userId: user.userId,
          title,
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

      setMessage("Ticket logged successfully!");
      setTitle("");
      setDescription("");
      setUrgency("Low");
      setFile(null);
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div className="logticket">
      <nav className="navbar">
        <div className="navbar-logo">
          <img src="https://placehold.co/120x40" alt="logo" />
        </div>
        <div className="navbar-right">
          <ul className="navbar-menu">
            <li><a href="/">Dashboard</a></li>
            <li><a href="/ticket">Tickets</a></li>
            <li><a href="">Reports</a></li>
            <li><a href="">Settings</a></li>
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

          {/* Optional file upload */}
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
