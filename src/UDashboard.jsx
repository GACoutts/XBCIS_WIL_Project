import gearIcon from './assets/setting.png';


function UDashboard(){
    // Temp tickets 
    const tickets = [
        {
            id: 1,
            title: "Leaky Tap in Bathroom",
            ticketId: "00001",
            logged: "2025-07-30",
            urgency: "Low",
            status: "Pending"
        },
        {
            id: 2,
            title: "Leaky Tap in Bathroom",
            ticketId: "00001",
            logged: "2025-07-30",
            urgency: "Low",
            status: "Rejected"
        },
        {
            id: 3,
            title: "Leaky Tap in Bathroom",
            ticketId: "00001",
            logged: "2025-07-30",
            urgency: "Medium",
            status: "Scheduled"
        },
        {
            id: 4,
            title: "Leaky Tap in Bathroom",
            ticketId: "00001",
            logged: "2025-07-30",
            urgency: "High",
            status: "Pending"
        }
       
        
    ];
    
    const ticketHistory = [
    { title: "Roof Damage", ticketId: "192345", logged: "2025-04-13", status: "Finished" },
    { title: "Broken Railing (Outside Patio)", ticketId: "348940", logged: "2025-03-11", status: "Rejected" },
    { title: "Geyser Not Heating", ticketId: "194506", logged: "2024-08-14", status: "Finished" },
  ];
  
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
    
    <div className = "dashboard-title">
        <h1>Dashboard</h1>
    </div>
    <div className = "sub-title">
        <h2>My Tickets</h2>
    </div>
    <div className = "submit-container">
                <div className = "submit">
                Log a New Ticket
                </div>
            </div>

        <div className="tickets-container">
            <div className="tickets-grid">
                {tickets.map(ticket => (
                    <div key={ticket.id} className="ticket-card">
                        <div className="ticket-info">
                            <h3>{ticket.title}</h3>
                            <p>Ticket ID: {ticket.ticketId}</p>
                            <p>Logged: {ticket.logged}</p>
                            <p>
                                Urgency: <span className={`urgency urgency-${ticket.urgency.toLowerCase()}`}>
                                    {ticket.urgency}
                                </span>
                            </p>
                            <div className="ticket-actions">
                                <button className="view-details">View Details</button>
                                <span className={`status-badge status-${ticket.status.toLowerCase()}`}>
                                    {ticket.status}
                                </span>
                                <img src={gearIcon} alt="settings" className="settings-icon" />
                            </div>
                        </div>
                        <div className="ticket-image">View Image</div>
                    </div>
                ))}
            </div>
        </div>
  <div className="ticket-history-container">
  <h2>Ticket History</h2>
  <div className="ticket-history-list">
    {ticketHistory.map((item, index) => (
      <div key={index} className="ticket-history-item">
        <span className="ticket-history-title">{item.title}</span>
        <span>Ticket ID: {item.ticketId}</span>
        <span>Logged: {item.logged}</span>
        <span className={`ticket-history-status status-badge status-${item.status.toLowerCase()}`}>
  {item.status}
</span>
        <img src={gearIcon} alt="settings" className="settings-icon" />
      </div>
    ))}
  </div>
</div>
    
        
        </>
    );
}

export default UDashboard;