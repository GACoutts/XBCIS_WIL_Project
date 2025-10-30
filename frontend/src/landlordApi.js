import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

const API_BASE = "/api/landlord";

export async function getTickets() {
  const res = await fetch(`${API_BASE}/tickets`, { credentials: 'include' });
  return res.json();
}

export async function getQuotesForTicketLandlord(ticketId) {
  const res = await fetch(`${API_BASE}/quotes/${ticketId}`, { credentials: 'include' });
  return res.json().then((data) => data.data || []);
}

export async function getQuoteMedia(quoteId) {
  const { data } = await api.get(`/quotes/${quoteId}/media`);
  return Array.isArray(data) ? data : (data?.data ?? []);
}

export async function approveQuote(quoteId) {
  const res = await fetch(`/api/quotes/${quoteId}/approve`, { method: 'POST', credentials: 'include' });
  return res.json();
}

export async function rejectQuote(quoteId) {
  const res = await fetch(`/api/quotes/${quoteId}/reject`, { method: 'POST', credentials: 'include' });
  return res.json();
}

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

/** Advance a newly logged ticket to staff review */
export async function approveTicket(ticketId) {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/approve`, {
    method: 'POST',
    credentials: 'include'
  });
  return res.json();
}

export async function rejectTicket(ticketId, reason) {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/reject`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });
  return res.json();
}

export async function getProperties() {
  const res = await fetch(`${API_BASE}/properties`, { credentials: 'include' });
  return res.json();
}

export async function addProperty(formData) {
  const res = await fetch(`${API_BASE}/properties`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });
  return res.json();
}
