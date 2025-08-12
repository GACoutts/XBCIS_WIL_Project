import React, { useState } from "react";
import './index.css';

function Ticket(){

const [urgency, setUrgency] = useState("Low");

  const handleUrgencyChange = (event) => {
    setUrgency(event.target.value);
  };

    return(
        <>
        <nav className="navbar">
        <div className="navbar-logo">
            <img src="https://placehold.co/120x40" alt="logo" />
        </div>
        <div className="navbar-right">
            <ul className="navbar-menu">
                <li>
                    <a href="">Dashboard</a>
                </li>
                <li>
                    <a href="">Tickets</a>
                </li>
                <li>
                    <a href="">Reports</a>
                </li>
                <li>
                    <a href="">Settings</a>
                </li>
            </ul>
        </div>
      <div className="navbar-profile">
        <img src="https://placehold.co/40" alt="profile" />
      </div>
    </nav>
    
    <div className = "container">
            <div className = "header">
                <div className = "text">
                <h2>Log a New Ticket</h2>
                </div>
                <hr className = "underline">
                </hr>
            </div>
            <div className = "inputs">
                <div className = "input">
                    <label className = "input-head">
                        Title
                    </label>
                    <input type = "title" placeholder = "Broken Tap (Kitchen)"></input>
                </div>
                <div className = "input">
                    <label className = "input-head">
                        Description of Issue
                    </label>
                    <textarea placeholder = "Tap in the kitchen does not work at all. The issue started 2 days ago."></textarea>
                </div>
            </div>
            <div className = "submit-container">
                <div className = "submit">
                Upload a Photo / Video
                </div>
            </div>
            
  <div className="urgency-container">
    <label>Urgency Selection</label>
    <div className="urgency-options">
      <label>
        <input
          type="radio"
          value="Low"
          checked={urgency === "Low"}
          onChange={handleUrgencyChange}
        />
        Low
      </label>
      <label>
        <input
          type="radio"
          value="Medium"
          checked={urgency === "Medium"}
          onChange={handleUrgencyChange}
        />
        Medium
      </label>
      <label>
        <input
          type="radio"
          value="High"
          checked={urgency === "High"}
          onChange={handleUrgencyChange}
        />
        High
      </label>
    </div>
  </div>

  <div className="final-submit">
    <button type="submit">Submit Ticket</button>
  </div>

</div>
    </>
    );
}

export default Ticket;