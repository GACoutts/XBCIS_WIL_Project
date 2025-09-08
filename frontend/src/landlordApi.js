const API_BASE = "http://localhost:5000/api"; // backend URL

export async function getTickets() {
  const res = await fetch(`${API_BASE}/tickets`);
  return res.json();
}

export async function getQuotesForTicketLandlord(ticketId) {
  const res = await fetch(`${API_BASE}/quotes/ticket/${ticketId}`);
  return res.json();
}

export async function approveQuote(quoteId) {
  const res = await fetch(`${API_BASE}/quotes/${quoteId}/approve`, { method: "POST" });
  return res.json();
}

export async function rejectQuote(quoteId) {
  const res = await fetch(`${API_BASE}/quotes/${quoteId}/reject`, { method: "POST" });
  return res.json();
}
