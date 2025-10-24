// frontend/src/api/contractorApi.js
const API_BASE = '/api/contractor';

async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

function createHeaders(contentType = 'application/json') {
  return { 'Content-Type': contentType };
}

// List jobs
export async function getJobs({ page = 1, pageSize = 20, status } = {}) {
  const params = new URLSearchParams();
  params.append('page', String(page));
  params.append('pageSize', String(pageSize));
  if (status && status !== 'all') params.append('status', status);

  const res = await fetch(`${API_BASE}/jobs?${params}`, {
    method: 'GET',
    credentials: 'include',
    headers: createHeaders(),
  });
  return handleResponse(res);
}

// Fetch latest schedule snapshot for a job
export async function getJobSchedule(ticketId) {
  if (!ticketId) throw new Error('Ticket ID is required');
  const res = await fetch(`${API_BASE}/jobs/${ticketId}/schedule`, {
    method: 'GET',
    credentials: 'include',
    headers: createHeaders(),
  });
  return handleResponse(res);
}

// Post a progress update (notes + images)
export async function postJobUpdate(ticketId, { notes, photos }) {
  if (!ticketId) throw new Error('Ticket ID is required');

  const formData = new FormData();
  if (notes) formData.append('notes', notes);

  if (photos && photos.length) {
    Array.from(photos).forEach((photo) => {
      if (!(photo instanceof File)) return;
      if (!photo.type.startsWith('image/')) throw new Error(`File ${photo.name} is not an image`);
      if (photo.size > 10 * 1024 * 1024) throw new Error(`File ${photo.name} exceeds 10MB limit`);
      formData.append('photos', photo);
    });
  }

  const res = await fetch(`${API_BASE}/jobs/${ticketId}/update`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  return handleResponse(res);
}

// Propose (or revise) an appointment
export async function postJobSchedule(ticketId, { proposedStart, proposedEnd, notes }) {
  if (!ticketId) throw new Error('Ticket ID is required');
  if (!proposedStart) throw new Error('Proposed start time is required');

  const startTime = new Date(proposedStart);
  if (startTime <= new Date()) throw new Error('Proposed start time must be in the future');

  if (proposedEnd) {
    const end = new Date(proposedEnd);
    if (end < startTime) throw new Error('End time must be after start time');
  }

  const body = {
    scheduledAt: startTime.toISOString(),
    ...(proposedEnd && { proposedEnd: new Date(proposedEnd).toISOString() }),
    ...(notes && { notes }),
  };

  const res = await fetch(`${API_BASE}/jobs/${ticketId}/schedule`, {
    method: 'POST',
    credentials: 'include',
    headers: createHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

// Get job (ticket) details via existing tickets API
export async function getJobDetails(ticketId) {
  if (!ticketId) throw new Error('Ticket ID is required');
  const res = await fetch(`/api/tickets/${ticketId}`, {
    method: 'GET',
    credentials: 'include',
    headers: createHeaders(),
  });
  return handleResponse(res);
}

export function formatJobStatus(status) {
  const m = {
    'New': { display: 'New', class: 'status-new', color: '#007bff' },
    'In Review': { display: 'In Review', class: 'status-review', color: '#ffc107' },
    'Quoting': { display: 'Quoting', class: 'status-quoting', color: '#fd7e14' },
    'Awaiting Landlord Approval': { display: 'Awaiting Approval', class: 'status-pending', color: '#6f42c1' },
    'Approved': { display: 'Approved', class: 'status-approved', color: '#198754' },
    'Awaiting Appointment': { display: 'Awaiting Appointment', class: 'status-awaiting', color: '#0dcaf0' },
    'Scheduled': { display: 'Scheduled', class: 'status-scheduled', color: '#20c997' },
    'In Progress': { display: 'In Progress', class: 'status-progress', color: '#fd7e14' },
    'Completed': { display: 'Completed', class: 'status-completed', color: '#198754' },
    'Cancelled': { display: 'Cancelled', class: 'status-cancelled', color: '#6c757d' },
    'Closed': { display: 'Completed', class: 'status-completed', color: '#198754' },
  };
  return m[status] || { display: status, class: 'status-unknown', color: '#6c757d' };
}

export function formatUrgency(urgency) {
  const m = {
    'Critical': { display: 'Critical', class: 'urgency-critical', color: '#dc3545' },
    'High': { display: 'High', class: 'urgency-high', color: '#fd7e14' },
    'Medium': { display: 'Medium', class: 'urgency-medium', color: '#ffc107' },
    'Low': { display: 'Low', class: 'urgency-low', color: '#198754' },
  };
  return m[urgency] || { display: urgency, class: 'urgency-unknown', color: '#6c757d' };
}

export class ContractorAPIError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'ContractorAPIError';
    this.code = code;
    this.details = details;
  }
}
