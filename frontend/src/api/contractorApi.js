// frontend/src/api/contractorApi.js
const API_BASE = '/api/contractor';

// Helper function to handle API responses
async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// Helper function to create headers with credentials
function createHeaders(contentType = 'application/json') {
  const headers = {
    'Content-Type': contentType,
  };
  return headers;
}

/**
 * Get contractor's assigned jobs with pagination and filtering
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number (default: 1)
 * @param {number} params.pageSize - Items per page (default: 20)
 * @param {string} params.status - Filter by job status (optional)
 * @returns {Promise<Object>} API response with jobs data
 */
export async function getJobs({ page = 1, pageSize = 20, status } = {}) {
  try {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (status && status !== 'all') {
      params.append('status', status);
    }

    const response = await fetch(`${API_BASE}/jobs?${params}`, {
      method: 'GET',
      credentials: 'include', // Important for cookie-based auth
      headers: createHeaders()
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching contractor jobs:', error);
    throw error;
  }
}

/**
 * Submit a job progress update with notes and photos
 * @param {number} ticketId - Ticket ID to update
 * @param {Object} updateData - Update information
 * @param {string} updateData.notes - Progress notes
 * @param {FileList|Array} updateData.photos - Photo files to upload
 * @returns {Promise<Object>} API response
 */
export async function postJobUpdate(ticketId, { notes, photos }) {
  try {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    const formData = new FormData();
    
    // Add notes if provided
    if (notes) {
      formData.append('notes', notes);
    }

    // Add photos if provided
    if (photos && photos.length > 0) {
      // Handle both FileList and Array
      const photoArray = Array.from(photos);
      photoArray.forEach((photo) => {
        if (photo instanceof File) {
          // Validate file type on client side
          if (!photo.type.startsWith('image/')) {
            throw new Error(`File ${photo.name} is not an image`);
          }
          
          // Validate file size (10MB limit)
          if (photo.size > 10 * 1024 * 1024) {
            throw new Error(`File ${photo.name} exceeds 10MB limit`);
          }
          
          formData.append('photos', photo);
        }
      });
    }

    const response = await fetch(`${API_BASE}/jobs/${ticketId}/update`, {
      method: 'POST',
      credentials: 'include',
      body: formData // Don't set Content-Type header for FormData
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Error submitting job update:', error);
    throw error;
  }
}

/**
 * Propose an appointment schedule for a job
 * @param {number} ticketId - Ticket ID to schedule
 * @param {Object} scheduleData - Schedule information
 * @param {string} scheduleData.proposedStart - Proposed start time (ISO string)
 * @param {string} scheduleData.proposedEnd - Proposed end time (ISO string, optional)
 * @param {string} scheduleData.notes - Schedule notes (optional)
 * @returns {Promise<Object>} API response
 */
export async function postJobSchedule(ticketId, { proposedStart, proposedEnd, notes }) {
  try {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    if (!proposedStart) {
      throw new Error('Proposed start time is required');
    }

    // Validate that start time is in the future
    const startTime = new Date(proposedStart);
    const now = new Date();
    
    if (startTime <= now) {
      throw new Error('Proposed start time must be in the future');
    }

    // Validate end time if provided
    if (proposedEnd) {
      const endTime = new Date(proposedEnd);
      if (endTime < startTime) {
        throw new Error('End time must be after start time');
      }
    }

    const requestBody = {
      proposedStart: startTime.toISOString(),
      ...(proposedEnd && { proposedEnd: new Date(proposedEnd).toISOString() }),
      ...(notes && { notes })
    };

    const response = await fetch(`${API_BASE}/jobs/${ticketId}/schedule`, {
      method: 'POST',
      credentials: 'include',
      headers: createHeaders(),
      body: JSON.stringify(requestBody)
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Error scheduling appointment:', error);
    throw error;
  }
}

/**
 * Get job details by ticket ID
 * @param {number} ticketId - Ticket ID
 * @returns {Promise<Object>} Job details
 */
export async function getJobDetails(ticketId) {
  try {
    if (!ticketId) {
      throw new Error('Ticket ID is required');
    }

    const response = await fetch(`${API_BASE}/jobs/${ticketId}`, {
      method: 'GET',
      credentials: 'include',
      headers: createHeaders()
    });

    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching job details:', error);
    throw error;
  }
}

/**
 * Utility function to format job status for display
 * @param {string} status - Job status
 * @returns {Object} Formatted status with display properties
 */
export function formatJobStatus(status) {
  const statusMap = {
    'New': { display: 'New', class: 'status-new', color: '#007bff' },
    'In Review': { display: 'In Review', class: 'status-review', color: '#ffc107' },
    'Quoting': { display: 'Quoting', class: 'status-quoting', color: '#fd7e14' },
    'Awaiting Landlord Approval': { display: 'Awaiting Approval', class: 'status-pending', color: '#6f42c1' },
    'Approved': { display: 'Approved', class: 'status-approved', color: '#198754' },
    'Awaiting Appointment': { display: 'Awaiting Appointment', class: 'status-awaiting', color: '#0dcaf0' },
    'Scheduled': { display: 'Scheduled', class: 'status-scheduled', color: '#20c997' },
    'In Progress': { display: 'In Progress', class: 'status-progress', color: '#fd7e14' },
    'Completed': { display: 'Completed', class: 'status-completed', color: '#198754' },
    'Cancelled': { display: 'Cancelled', class: 'status-cancelled', color: '#6c757d' }
  };

  return statusMap[status] || { display: status, class: 'status-unknown', color: '#6c757d' };
}

/**
 * Utility function to format urgency level for display
 * @param {string} urgency - Urgency level
 * @returns {Object} Formatted urgency with display properties
 */
export function formatUrgency(urgency) {
  const urgencyMap = {
    'Critical': { display: 'Critical', class: 'urgency-critical', color: '#dc3545' },
    'High': { display: 'High', class: 'urgency-high', color: '#fd7e14' },
    'Medium': { display: 'Medium', class: 'urgency-medium', color: '#ffc107' },
    'Low': { display: 'Low', class: 'urgency-low', color: '#198754' }
  };

  return urgencyMap[urgency] || { display: urgency, class: 'urgency-unknown', color: '#6c757d' };
}

// Export error handling helper
export class ContractorAPIError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'ContractorAPIError';
    this.code = code;
    this.details = details;
  }
}