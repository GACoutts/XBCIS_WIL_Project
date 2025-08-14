import React, { useState } from "react";
import "./styles/logticket.css";

function Ticket() {
  const [urgency, setUrgency] = useState("Low");

  return (
    <div className="logticket">
      <nav className="navbar">
        <div className="navbar-logo">
          <img src="https://placehold.co/120x40" alt="logo" />
        </div>

        <div className="navbar-right">
          <ul className="navbar-menu">
            <li><a href="">Dashboard</a></li>
            <li><a href="">Tickets</a></li>
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

        <div className="inputs">
          <div className="input">
            <label className="input-head">Title</label>
            <input type="text" placeholder="Broken Tap (Kitchen)" />
          </div>

          <div className="input">
            <label className="input-head">Description of Issue</label>
            <textarea placeholder="Tap in the kitchen does not work at all. The issue started 2 days ago." />
          </div>
        </div>

        <div className="submit-container">
          <div className="submit">Upload a Photo / Video</div>
        </div>

        <div className="urgency-container">
          <label>Urgency Selection</label>
          <div className="urgency-options">
            {["Low", "Medium", "High"].map((level) => (
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

        <div className="final-submit">
          <button type="submit">Submit Ticket</button>
        </div>
      </div>
    </div>
  );
}

export default Ticket;
