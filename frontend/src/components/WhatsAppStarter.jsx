import React, { useMemo, useState } from 'react';

/**
 * WhatsAppStarter
 * - Best-effort: opens wa.me link to Contractor / Landlord / Staff with a prefilled message.
 * - Usage:
 *   <WhatsAppStarter
 *     context={{ ticketRef, tenantName }}
 *     contacts={{
 *       contractor: { name, phone }, // E.164 preferred, e.g. +27...
 *       landlord:   { name, phone },
 *       staff:      { name: 'Support', phone: '+27...' }
 *     }}
 *     className="btn btn-wa"
 *   />
 */
export default function WhatsAppStarter({ contacts = {}, context = {}, className = '' }) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => ([
    { key: 'contractor', label: 'Contractor', target: contacts.contractor },
    { key: 'landlord',   label: 'Landlord',   target: contacts.landlord },
    { key: 'staff',      label: 'Staff',      target: contacts.staff }
  ].filter(o => o.target && o.target.phone)), [contacts]);

  const buildText = (who) => {
    const parts = [
      `Hello ${who?.name || ''}`.trim(),
      context.ticketRef ? `Regarding ticket ${context.ticketRef}` : '',
      context.tenantName ? `From ${context.tenantName}` : ''
    ].filter(Boolean);
    return encodeURIComponent(parts.join(' - '));
  };

  const toWaLink = (phone, who) => {
    // Strip non-digits except leading +
    const normalized = String(phone).trim().replace(/(?!^\+)[^\d]/g, '');
    return `https://wa.me/${normalized.replace(/^\+/, '')}?text=${buildText(who)}`;
  };

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        WhatsApp
      </button>

      {open && (
        <div className="wa-modal-overlay" onClick={() => setOpen(false)}>
          <div className="wa-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Start a WhatsApp chat</h3>
            <p>Who would you like to chat with?</p>
            <div className="wa-list">
              {options.length ? options.map(opt => (
                <a
                  key={opt.key}
                  className="wa-target"
                  href={toWaLink(opt.target.phone, opt.target)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  title={`Chat with ${opt.target.name || opt.label}`}
                >
                  {opt.label}{opt.target?.name ? `: ${opt.target.name}` : ''}
                </a>
              )) : <em>No WhatsApp contacts available</em>}
            </div>
            <button className="wa-close" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Minimal styles; add to your global CSS or component stylesheet */}
      <style>{`
        .wa-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.35);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .wa-modal {
          width: 92%; max-width: 420px; background: #fff; border-radius: 12px;
          padding: 16px; box-shadow: 0 8px 24px rgba(0,0,0,.2);
        }
        .wa-list { display: grid; gap: 8px; margin: 12px 0; }
        .wa-target {
          display: block; padding: 10px 12px; border-radius: 10px;
          background: #e9f6ef; text-decoration: none; font-weight: 600;
        }
        .wa-close { width: 100%; padding: 10px 12px; border-radius: 10px; }
        @media (max-width: 640px) {
          .wa-modal { width: 96%; padding: 14px; }
        }
      `}</style>
    </>
  );
}
