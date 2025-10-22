import React, { useState, useMemo } from 'react';

/**
 * WhatsAppStarter
 *
 * A small modal component that presents the user with WhatsApp chat options.
 * It accepts a context (e.g. ticket reference, tenant name) and a set of
 * contacts (contractor, landlord, staff).  Each contact should include a
 * name and an E.164 phone number.  Only contacts with a phone defined
 * appear as options.  When a user picks an option the component opens a
 * `wa.me` link in a new tab with a pre-filled message.  After sending,
 * the modal closes.
 *
 * Example usage:
 *
 * <WhatsAppStarter
 *   context={{ ticketRef: 'TCKT-12345', tenantName: 'Alice' }}
 *   contacts={{ contractor: { name: 'Bob', phone: '+27712345678' } }}
 * />
 */
export default function WhatsAppStarter({ context = {}, contacts = {}, className = '' }) {
    const [open, setOpen] = useState(false);

    // Build the list of available chat targets
    const options = useMemo(() => {
        const items = [];
        if (contacts.contractor?.phone) items.push({ key: 'contractor', label: 'Contractor', target: contacts.contractor });
        if (contacts.landlord?.phone) items.push({ key: 'landlord', label: 'Landlord', target: contacts.landlord });
        if (contacts.staff?.phone) items.push({ key: 'staff', label: 'Staff', target: contacts.staff });
        return items;
    }, [contacts]);

    // Compose a simple message to prefill the WhatsApp chat.  Use the ticket
    // reference and tenant name if supplied.  Feel free to customize the
    // wording or add more variables.
    const buildText = (who) => {
        const parts = [];
        if (who?.name) parts.push(`Hello ${who.name}`);
        if (context.ticketRef) parts.push(`regarding ticket ${context.ticketRef}`);
        const sender = context.senderName || context.tenantName;
        if (sender) parts.push(`from ${sender}`);
        return encodeURIComponent(parts.join(' — '));
    };

    // Normalize phone numbers to remove spaces and punctuation.  WhatsApp
    // requires numbers without a leading plus sign in the URL.
    const toWaLink = (phone, who) => {
        const normalized = String(phone).replace(/[^+\d]/g, '');
        return `https://wa.me/${normalized.replace(/^\+/, '')}?text=${buildText(who)}`;
    };

    return (
        <>
            {/* Trigger button.  You can style or position this however you like. */}
            <button type="button" className={className || 'whatsapp-btn'} onClick={() => setOpen(true)}>
                WhatsApp
            </button>

            {open && (
                <div className="wa-modal-overlay" onClick={() => setOpen(false)}>
                    <div className="wa-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Start a WhatsApp chat</h3>
                        <p>Who would you like to chat with?</p>
                        <div className="wa-options">
                            {options.length ? (
                                options.map((opt) => (
                                    <a
                                        key={opt.key}
                                        className="wa-option"
                                        href={toWaLink(opt.target.phone, opt.target)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setOpen(false)}
                                    >
                                        {opt.label}{opt.target.name ? `: ${opt.target.name}` : ''}
                                    </a>
                                ))
                            ) : (
                                <em>No WhatsApp contacts available</em>
                            )}
                        </div>
                        <button className="wa-close" onClick={() => setOpen(false)}>Close</button>
                    </div>
                </div>
            )}

            {/* Inline styles for the WhatsApp modal.  These are minimal and can be
          moved to a CSS file if you prefer. */}
            <style>{`
        .wa-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .wa-modal {
          background: #fff;
          border-radius: 12px;
          padding: 16px;
          width: 92%;
          max-width: 420px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }
        .wa-options {
          display: grid;
          gap: 8px;
          margin: 12px 0;
        }
        .wa-option {
          display: block;
          padding: 10px 12px;
          border-radius: 10px;
          background: #e9f6ef;
          text-decoration: none;
          font-weight: 600;
          color: #222;
        }
        .wa-option:hover {
          background: #d8f0e4;
        }
        .wa-close {
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          background: #f5f5f5;
        }
      `}</style>
        </>
    );
}