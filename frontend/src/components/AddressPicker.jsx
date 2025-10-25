import React, { useEffect, useMemo, useRef, useState } from "react";

/** Places API (New) v1 endpoints */
const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const BASE_URL = "https://places.googleapis.com/v1";

function uuid() {
  return (crypto?.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2);
}

/** Normalize any possible value to a short, DB-safe Place ID */
function normalizePlaceId(value) {
  return (value || "").replace(/^places\//, "").slice(0, 64);
}

/**
 * AddressPicker (REST)
 *
 * Props:
 * - onSelect({ address, latitude, longitude, placeId })
 * - placeholder
 * - restrictToZA (default true)
 * - className (default "address-picker-input")
 * - inputProps – forwarded to the <input />
 */
export default function AddressPicker({
  onSelect,
  placeholder = "Start typing an address",
  restrictToZA = true,
  className = "address-picker-input",
  inputProps = {},
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]); // [{placeId,text,secondaryText}]
  const [hi, setHi] = useState(-1); // highlighted index for keyboard nav

  const tokenRef = useRef(uuid());
  const abortRef = useRef(null);
  const wrapperRef = useRef(null);

  /** Debounce typing */
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 180);
    return () => clearTimeout(t);
  }, [q]);

  /** Close list when clicking outside / ESC */
  useEffect(() => {
    function onDocClick(e) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") {
        setOpen(false);
        setHi(-1);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  /** Fetch suggestions (Places API v1) */
  useEffect(() => {
    if (!apiKey) {
      // Don’t render a visible error here - keep UI quiet like the other inputs
      console.warn("[AddressPicker] Missing VITE_GOOGLE_MAPS_API_KEY");
      return;
    }
    if (!debouncedQ) {
      setSuggestions([]);
      setOpen(false);
      setHi(-1);
      return;
    }

    setLoading(true);

    // cancel previous request if any
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const body = {
      input: debouncedQ,
      sessionToken: tokenRef.current,
      languageCode: "en",
      includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
      ...(restrictToZA
        ? {
            regionCode: "ZA",
            locationBias: {
              rectangle: {
                low: { latitude: -35.0, longitude: 15.0 },
                high: { latitude: -20.0, longitude: 35.0 },
              },
            },
          }
        : {}),
    };

    fetch(AUTOCOMPLETE_URL, {
      method: "POST",
      signal: abortRef.current.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // Ask only for fields we need in suggestions:
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Autocomplete error ${r.status}`);
        const data = await r.json();
        const items = (data.suggestions || []).map((s) => {
          const pf = s.placePrediction;
          const text = pf?.text?.text || "";
          const main = pf?.structuredFormat?.mainText?.text || text;
          const secondary = pf?.structuredFormat?.secondaryText?.text || "";
          // Classic short Place ID (defensive normalize)
          const shortId = normalizePlaceId(pf?.placeId);
          return { placeId: shortId, text: main, secondaryText: secondary };
        });
        setSuggestions(items);
        setOpen(true);
        setHi(items.length ? 0 : -1);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") {
          console.warn("[AddressPicker] suggestions failed:", e);
          setSuggestions([]);
          setOpen(false);
          setHi(-1);
        }
      })
      .finally(() => setLoading(false));

    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [debouncedQ, apiKey, restrictToZA]);

  /** Pick a suggestion -> fetch details -> bubble up */
  const handlePick = async (item) => {
    const composed = `${item.text}${item.secondaryText ? ", " + item.secondaryText : ""}`;
    try {
      setOpen(false);
      setHi(-1);
      setQ(composed);
      setLoading(true);

      // Details request
      const fields = encodeURIComponent("id,formattedAddress,location");
      const url = `${BASE_URL}/places/${encodeURIComponent(item.placeId)}?fields=${fields}&key=${encodeURIComponent(
        apiKey
      )}`;

      const r = await fetch(url);
      if (!r.ok) throw new Error(`Place details error ${r.status}`);
      const place = await r.json();

      const lat = place?.location?.latitude ?? null;
      const lng = place?.location?.longitude ?? null;

      onSelect?.({
        address: place?.formattedAddress || composed,
        latitude: Number.isFinite(lat) ? lat : null,
        longitude: Number.isFinite(lng) ? lng : null,
        placeId: item.placeId, // short, normalized ID
      });

      // Refresh session token after a successful selection
      tokenRef.current = uuid();
    } catch (e) {
      // So: quietly fallback to minimal payload WITHOUT surfacing an error to the user.
      console.warn("[AddressPicker] details failed, falling back:", e?.message || e);
      onSelect?.({
        address: composed,
        latitude: null,
        longitude: null,
        placeId: item.placeId,
      });
    } finally {
      setLoading(false);
    }
  };

  /** Keyboard navigation on the input */
  const onKeyDown = (e) => {
    if (!open || !suggestions.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (hi >= 0 && hi < suggestions.length) {
        e.preventDefault();
        handlePick(suggestions[hi]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHi(-1);
    }
  };

  const list = useMemo(() => suggestions.slice(0, 8), [suggestions]);

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        type="text"
        className={className}
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => q && suggestions.length && setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        {...inputProps}
      />

      {loading && (
        <div style={{ position: "absolute", right: 8, top: 6, fontSize: 12, opacity: 0.7 }}>
          …
        </div>
      )}

      {open && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0,
            right: 0,
            top: "100%",
            marginTop: 4,
            listStyle: "none",
            padding: 0,
            border: "1px solid #ddd",
            background: "#fff",
            maxHeight: 240,
            overflowY: "auto",
            borderRadius: 6,
            boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
          }}
          onMouseDown={(e) => e.preventDefault()} // keep input focused
        >
          {list.length === 0 && !loading ? (
            <li style={{ padding: "10px 12px", color: "#666" }}>No results</li>
          ) : (
            list.map((s, i) => (
              <li
                key={s.placeId}
                role="option"
                aria-selected={i === hi}
                onClick={() => handlePick(s)}
                onMouseEnter={() => setHi(i)}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  background: i === hi ? "#f6f6f6" : "transparent",
                }}
              >
                <div style={{ fontWeight: 600 }}>{s.text}</div>
                {s.secondaryText && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{s.secondaryText}</div>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
