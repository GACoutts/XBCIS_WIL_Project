import React, { useEffect, useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./styles/landlorddash.css";
import { getQuotesForTicketLandlord, getQuoteMedia } from "./landlordApi";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function LandlordQuoteView() {
  const navigate = useNavigate();
  const query = useQuery();
  const ticketId = query.get("ticketId");

  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState([]);
  const [error, setError] = useState("");
  const [mediaByQuote, setMediaByQuote] = useState({}); // { [quoteId]: [{MediaURL,...}] }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!ticketId) {
          setError("Missing ticketId in URL.");
          setLoading(false);
          return;
        }
        const list = await getQuotesForTicketLandlord(Number(ticketId));
        if (mounted) {
          const arr = Array.isArray(list) ? list : [];
          setQuotes(arr);

          // fetch media for each quote in parallel (tolerate {success,data} or raw array)
          const results = await Promise.allSettled(
            arr.map(q =>
              getQuoteMedia(q.QuoteID).then(res => {
                const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
                return [q.QuoteID, data];
              })
            )
          );

          const dict = {};
          results.forEach(r => {
            if (r.status === "fulfilled") {
              const [qid, m] = r.value;
              dict[qid] = Array.isArray(m) ? m : [];
            }
          });
          setMediaByQuote(dict);
        }
      } catch (_e) {
        if (mounted) setError("Failed to load quotes.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [ticketId]);

  return (
    <div style={{ padding: "80px 90px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Quotes for Ticket {ticketId || "-"}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-view" onClick={() => navigate(-1)}>Back</button>
          <Link to="/landlord/tickets" className="btn btn-view">All Tickets</Link>
        </div>
      </div>

      <div className="pendingapprovals-wrapper" style={{ margin: 0, maxWidth: 900 }}>
        <div className="pendingapprovals-card">
          <div className="pendingapprovals-header" style={{ gridTemplateColumns: "120px 1fr 140px 200px" }}>
            <div className="column">Quote ID</div>
            <div className="column">Status</div>
            <div className="column">Amount</div>
            <div className="column">Document</div>
          </div>

          <div className="pendingapprovals-body" style={{ maxHeight: "unset" }}>
            {loading && (
              <div className="pendingapprovals-row" style={{ gridTemplateColumns: "1fr" }}>
                Loading…
              </div>
            )}

            {!loading && error && (
              <div className="pendingapprovals-row" style={{ gridTemplateColumns: "1fr", color: "red" }}>
                {error}
              </div>
            )}

            {!loading && !error && quotes.length === 0 && (
              <div className="pendingapprovals-row" style={{ gridTemplateColumns: "1fr" }}>
                No quotes found for this ticket yet.
              </div>
            )}

            {!loading && !error && quotes.map((q) => {
              const amount = Number(q.QuoteAmount ?? q.amount ?? 0);
              const status = q.QuoteStatus ?? q.status ?? "Pending";

              // Prefer media endpoint; if empty, fall back to Documents array returned by landlord list API
              const media = (mediaByQuote[q.QuoteID] && mediaByQuote[q.QuoteID].length)
                ? mediaByQuote[q.QuoteID]
                : (Array.isArray(q.Documents) ? q.Documents.map((url, i) => ({
                    MediaID: `doc-${q.QuoteID}-${i}`,
                    MediaURL: url
                  })) : []);

              return (
                <div key={q.QuoteID || q.id} className="pendingapprovals-row" style={{ gridTemplateColumns: "120px 1fr 140px 200px" }}>
                  <div className="cell">{q.QuoteID || q.id}</div>
                  <div className="cell">
                    <span className={`status-pill ${status === "Approved" ? "approved" : status === "Rejected" ? "rejected" : "pending"}`}>
                      {status}
                    </span>
                  </div>
                  <div className="cell">R {amount.toFixed(0)}</div>
                  <div className="cell">
                    {media.length > 0 ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {media.map(m => {
                          const url = m.MediaURL || m;
                          return (
                            <a key={m.MediaID || url} href={url} target="_blank" rel="noreferrer" className="btn btn-view">
                              View File
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ color: "#666" }}>No document uploaded</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
          Don’t see a document? If quotes were uploaded under older logic, upload a fresh quote document so it appears here.
        </p>
      </div>
    </div>
  );
}
