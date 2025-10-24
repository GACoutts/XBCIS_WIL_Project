import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import RoleNavbar from './components/RoleNavbar.jsx';
import './styles/logticket.css';

/**
 * Ticket
 *
 * Allows a client (tenant) to log a new maintenance ticket.  Only the
 * description and urgency are sent to the backend; a title is collected
 * for user context but not persisted by the API.  An optional image or
 * video can be attached.  After submission, the form resets and a
 * confirmation message is shown briefly before redirecting back to the
 * dashboard.  The component uses RoleNavbar for a consistent header.
 */
function Ticket() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('Low');
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!user?.userId) {
      setMessage('User not logged in.');
      return;
    }

    // inside handleSubmit in Ticket.jsx
    try {
      setSubmitting(true);

      // --- 1) Create ticket with timeout
      const createCtrl = new AbortController();
      const createTimeout = setTimeout(() => createCtrl.abort(), 15000); // 15s
      const resTicket = await fetch('/api/tickets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, urgencyLevel: urgency }),
        signal: createCtrl.signal,
      }).catch(err => {
        if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.');
        throw err;
      });
      clearTimeout(createTimeout);

      const dataTicket = await resTicket.json();
      if (!resTicket.ok) throw new Error(dataTicket?.message || 'Error submitting ticket');

      // --- 2) Optional upload (longer timeout; big files)
      if (file) {
        const formData = new FormData();
        formData.append('file', file);

        const uploadCtrl = new AbortController();
        const uploadTimeout = setTimeout(() => uploadCtrl.abort(), 60000); // 60s for media
        const resFile = await fetch(`/api/tickets/${dataTicket.ticketId}/media`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
          signal: uploadCtrl.signal,
        }).catch(err => {
          if (err.name === 'AbortError') throw new Error('Upload timed out. Please try again.');
          throw err;
        });
        clearTimeout(uploadTimeout);

        const dataFile = await resFile.json();
        if (!resFile.ok) throw new Error(dataFile?.message || 'Error uploading file');
      }

      // Success UI
      setMessage('Ticket submitted successfully! Redirecting...');
      setTitle('');
      setDescription('');
      setUrgency('Low');
      setFile(null);
      setSubmitted(true);
      setSubmitting(false);
      setTimeout(() => navigate('/client'), 3000);
    } catch (err) {
      setMessage(err.message || 'Something went wrong');
      setSubmitting(false);
    }

  };

  // Confirmation state
  if (submitted) {
    return (
      <div className="logticket">
        <RoleNavbar />
        <div className="container-confirmation">
          <div className="header">
            <div className="text"><h2>Ticket Submitted</h2></div>
            <hr className="underline" />
          </div>
          <p className="text">
            Your ticket has been logged successfully. We'll keep you updated on its status.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="logticket">
      <RoleNavbar />
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
              disabled={submitting}
            />
          </div>

          <div className="input">
            <label className="input-head">Description of Issue</label>
            <textarea
              placeholder="Example: Tap in the kitchen does not work at all. The issue started 2 days ago."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="urgency-container">
            <label>Urgency Selection</label>
            <div className="urgency-options">
              {['Low', 'Medium', 'High'].map((level) => (
                <label key={level}>
                  <input
                    type="radio"
                    value={level}
                    checked={urgency === level}
                    onChange={(e) => setUrgency(e.target.value)}
                    disabled={submitting}
                  />
                  {level}
                </label>
              ))}
            </div>
          </div>

          <div className="input">
            <label className="input-head attach-label">Attach Image/Video (optional)</label>
            <div className="submit-container">
              <label className="submit">
                {file ? file.name : '+ Add Photo/Video'}
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setFile(e.target.files[0])}
                  style={{ display: 'none' }}
                  disabled={submitting}
                />
              </label>
            </div>
          </div>

          <div className="final-submit">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Ticket;