import { useEffect, useMemo, useState } from "react";
import { auth, database } from "../firebase";
import { ref, set, onValue, push, remove } from "firebase/database";
import GuardianForm from "./GuardianForm";
import GuardianCard from "./GuardianCard";
import "./guardians.css";

const MAX_GUARDIANS = 5;

export default function GuardiansPage() {
  const [guardians, setGuardians] = useState([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const contactsRef = ref(database, `users/${user.uid}/contacts`);
    const unsub = onValue(contactsRef, (snap) => {
      const data = snap.val();
      setGuardians(data
        ? Object.keys(data).map((k) => ({ id: k, ...data[k] }))
        : []
      );
    });
    return () => unsub();
  }, [user]);

  const atLimit = guardians.length >= MAX_GUARDIANS;
  const verifiedCount = useMemo(
    () => guardians.filter((g) => g.verified).length,
    [guardians]
  );

  function toast(text, type = "success") {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(""), 3500);
  }

  function handleAdd(guardian) {
    if (!user) return;
    const newRef = push(ref(database, `users/${user.uid}/contacts`));
    set(newRef, {
      ...guardian,
      addedAt: new Date().toLocaleDateString("en-IN"),
    })
      .then(() => toast("Guardian added to your protection circle! 🛡️", "success"))
      .catch(() => toast("Failed to add guardian. Try again.", "error"));
  }

  function handleRemove(id) {
    if (!user) return;
    remove(ref(database, `users/${user.uid}/contacts/${id}`))
      .then(() => toast("Guardian removed.", "info"))
      .catch(() => toast("Failed to remove. Try again.", "error"));
  }

  function handleVerify(id) {
    if (!user) return;
    const g = guardians.find((x) => x.id === id);
    if (!g) return;
    set(ref(database, `users/${user.uid}/contacts/${id}`), { ...g, verified: true })
      .then(() => toast(`${g.name} marked as verified ✓`, "success"));
  }

  return (
    <div className="gp-root">
      {/* ── Toast Alert ── */}
      {msg && (
        <div className={`gp-toast ${msgType}`} role="alert">
          {msgType === "success" ? "✓" : msgType === "error" ? "✕" : "ℹ"}&ensp;{msg}
        </div>
      )}

      {/* ── Top Grid: Left Sidebar Info Box + Right Add Form ── */}
      <div className="gp-top-grid">

        {/* Left Side: Protection Network Info Box + High-Tech Defense Status Widget */}
        <div className="gp-sidebar-box">
          <div className="gp-sidebar-header">
            <div className="gp-header-left">
              <div className="gp-header-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div>
                <div className="gp-eyebrow">Protection Network</div>
                <h1 className="gp-title">Guardians</h1>
              </div>
            </div>
            <p className="gp-subtitle">
              Trusted contacts who receive instant SOS alerts with your live GPS location and emergency audio.
            </p>
          </div>

          {/* High-Tech Security Mesh Status Widget (Redesigned in place of Orbit) */}
          <SecurityMeshWidget guardians={guardians} verifiedCount={verifiedCount} max={MAX_GUARDIANS} />
        </div>

        {/* Right Side: Add Guardian Form Card */}
        <section className="gp-panel gp-add-panel" aria-labelledby="gp-add-heading">
          <h2 className="gp-panel-heading" id="gp-add-heading">
            <span className="gp-panel-heading-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </span>
            Add a Guardian
          </h2>
          <GuardianForm
            onAdd={handleAdd}
            disabled={atLimit}
            disabledReason={
              atLimit
                ? `Limit of ${MAX_GUARDIANS} guardians reached. Remove one to add another.`
                : null
            }
          />
        </section>

      </div>

      {/* ── Bottom Section: Your Guardians Table List ── */}
      <section className="gp-panel gp-bottom-guardians-panel" aria-labelledby="gp-list-heading">
        <div className="gp-list-header">
          <h2 className="gp-panel-heading" id="gp-list-heading" style={{ margin: 0, padding: 0, border: 0 }}>
            <span className="gp-panel-heading-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </span>
            Your Guardians
          </h2>
          <span className="gp-count-badge">{guardians.length} / {MAX_GUARDIANS} Active</span>
        </div>

        {guardians.length === 0 ? (
          <div className="gp-empty">
            <div className="gp-empty-icon">
              <span className="gp-empty-pulse" />
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <p className="gp-empty-title">No guardians configured</p>
            <p className="gp-empty-sub">
              Add trusted contacts above so they're alerted instantly in an emergency.
            </p>
          </div>
        ) : (
          <div className="gp-table-container">
            {/* Table Column Headers */}
            <div className="gp-table-head">
              <span className="gp-th gp-col-name">NAME</span>
              <span className="gp-th gp-col-relation">RELATION</span>
              <span className="gp-th gp-col-phone">CONTACT</span>
              <span className="gp-th gp-col-email">EMAIL</span>
              <span className="gp-th gp-col-status">STATUS</span>
              <span className="gp-th gp-col-actions">ACTION</span>
            </div>

            {/* Table Rows */}
            <ul className="gp-table-list">
              {guardians.map((g) => (
                <GuardianCard
                  key={g.id}
                  guardian={g}
                  onRemove={handleRemove}
                  onVerify={handleVerify}
                />
              ))}
            </ul>
          </div>
        )}
      </section>

    </div>
  );
}

/* ── High-Tech Security Mesh & Defense Status Widget (Fresh Design) ── */
function SecurityMeshWidget({ guardians, verifiedCount, max }) {
  const percentage = Math.round((guardians.length / max) * 100);
  const slots = Array.from({ length: max });

  return (
    <div className="gp-defense-widget">
      
      {/* 1. Header with live status pill */}
      <div className="gp-defense-header">
        <div className="gp-defense-title-row">
          <div className="gp-defense-pulse-dot"></div>
          <span className="gp-defense-title">DEFENSE NETWORK STATUS</span>
        </div>
        <span className={`gp-defense-status-badge ${guardians.length > 0 ? "active" : "standby"}`}>
          {guardians.length > 0 ? (verifiedCount === guardians.length ? "● 100% ARMED" : "● ACTIVE") : "○ STANDBY"}
        </span>
      </div>

      {/* 2. Protection Strength Segmented Meter */}
      <div className="gp-defense-meter-section">
        <div className="gp-defense-meter-labels">
          <span className="gp-defense-meter-text">Protection Strength</span>
          <span className="gp-defense-meter-val">{percentage}% ({guardians.length}/{max} Nodes)</span>
        </div>
        <div className="gp-defense-segments-bar">
          {slots.map((_, i) => {
            const isFilled = i < guardians.length;
            const isVer = isFilled && guardians[i]?.verified;
            return (
              <div
                key={i}
                className={`gp-defense-segment ${isFilled ? (isVer ? "verified" : "filled") : "empty"}`}
                title={`Node Slot ${i + 1}: ${isFilled ? guardians[i].name : "Open"}`}
              />
            );
          })}
        </div>
      </div>

      {/* 3. Node Slots Interactive Grid */}
      <div className="gp-defense-slots-grid">
        {slots.map((_, i) => {
          const g = guardians[i];
          if (g) {
            return (
              <div key={g.id || i} className={`gp-defense-slot-chip filled ${g.verified ? "verified" : "pending"}`}>
                <span className="gp-slot-avatar">{g.name.trim()[0]?.toUpperCase()}</span>
                <span className="gp-slot-name">{g.name}</span>
                <span className="gp-slot-badge">{g.verified ? "✓" : "⏳"}</span>
              </div>
            );
          }
          return (
            <div key={i} className="gp-defense-slot-chip empty">
              <span className="gp-slot-empty-plus">+</span>
              <span className="gp-slot-empty-text">Slot {i + 1} Open</span>
            </div>
          );
        })}
      </div>

      {/* 4. Live Dispatch Capabilities Strip */}
      <div className="gp-defense-footer-strip">
        <div className="gp-defense-capability">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline>
          </svg>
          <span>Auto-GPS Dispatch &lt;2s</span>
        </div>
        <div className="gp-defense-capability">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          </svg>
          <span>7s Mic Loop Ready</span>
        </div>
      </div>

    </div>
  );
}
