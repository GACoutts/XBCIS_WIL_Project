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
  const res = await fetch(`/api/quotes/${quoteId}/approve`, { method: 'POST', credentials: 'include' });
  return res.json();
}

export async function rejectQuote(quoteId) {
  const res = await fetch(`/api/quotes/${quoteId}/reject`, { method: 'POST', credentials: 'include' });
  return res.json();
}

/**
 * Fetch tickets with optional filters.  Accepts an object of query parameters
 * such as { status, dateFrom, dateTo, limit, offset, propertyId }.  The
 * returned object matches the backend format: { success, data: { tickets, pagination } }.
 *
 * @param {Object} params
 */
export async function getTicketsFiltered(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, value);
    }
  });
  const qs = query.toString();
  const res = await fetch(`${API_BASE}/tickets${qs ? `?${qs}` : ''}`, { credentials: 'include' });
  return res.json();
}

/**
  * Approve a newly logged ticket. Moves the ticket to staff review by updating its
 * CurrentStatus to 'Awaiting Staff Assignment'.
 * @param {number} ticketId
 */
export async function approveTicket(ticketId) {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/approve`, {
    method: 'POST',
    credentials: 'include'
  });
  return res.json();
}

/**
 * Reject a newly logged ticket.  Landlords may optionally provide a
 * reason for the rejection.  This sets the ticket's status to
 * 'Rejected' and records the reason.
 * @param {number} ticketId
 * @param {string} reason
 */
export async function rejectTicket(ticketId, reason) {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/reject`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });
  return res.json();
}

/**
 * Retrieve all properties belonging to the authenticated landlord.  Each
 * property includes its address fields and the currently active tenant
 * (if any).
 */
export async function getProperties() {
  const res = await fetch(`${API_BASE}/properties`, { credentials: 'include' });
  return res.json();
}

/**
 * Add a new property for the landlord.  Accepts a FormData object
 * containing addressLine1, addressLine2, city, province and postalCode
 * along with a file field named 'proof'.  Returns { success, data: { propertyId } } on
 * success.
 *
 * @param {FormData} formData
 */
export async function addProperty(formData) {
  const res = await fetch(`${API_BASE}/properties`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });
  return res.json();
}
