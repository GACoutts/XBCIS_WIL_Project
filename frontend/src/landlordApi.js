// Base URL for the backend API.  When running via Vite, calls to
// `/api/...` are proxied to the backend automatically, so you can omit
// the origin.  If you deploy the frontend separately, update this as
// needed (e.g. using environment variables).
const API_BASE = "/api/landlord";

export async function getTickets() {
  // Landlords should fetch tickets via the landlord API.  Include
  // credentials so cookies are sent.
  const res = await fetch(`${API_BASE}/tickets`, { credentials: 'include' });
  return res.json();
}

export async function getQuotesForTicketLandlord(ticketId) {
  // Retrieve all quotes for a specific ticket owned by the landlord.  The
  // backend will enforce ownership and return an array of quotes.
  const res = await fetch(`${API_BASE}/quotes/${ticketId}`, { credentials: 'include' });
  return res.json().then((data) => data.data || []);
}

export async function approveQuote(quoteId) {
  const res = await fetch(`${API_BASE}/quotes/${quoteId}/approve`, { method: 'POST', credentials: 'include' });
  return res.json();
}

export async function rejectQuote(quoteId) {
  const res = await fetch(`${API_BASE}/quotes/${quoteId}/reject`, { method: 'POST', credentials: 'include' });
  return res.json();
}
