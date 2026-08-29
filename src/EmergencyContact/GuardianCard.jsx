import { useState } from "react";

const RELATION_META = {
  family:   { label: "Family",   icon: "👪" },
  friend:   { label: "Friend",   icon: "🤝" },
  police:   { label: "Police",   icon: "🛡️" },
  neighbor: { label: "Neighbor", icon: "🏠" },
  other:    { label: "Other",    icon: "★"  },
};

export default function GuardianCard({ guardian, onRemove, onVerify }) {
  const [confirming, setConfirming] = useState(false);
  const meta = RELATION_META[guardian.relation] || RELATION_META.other;
  const isVerified = guardian.verified;

  return (
    <li className={`gp-table-row ${isVerified ? "gp-row--verified" : ""}`}>
      
      {/* 1. Name & Avatar */}
      <div className="gp-col gp-col-name">
        <div className="gp-row-avatar">
          {meta.icon}
        </div>
        <div className="gp-row-name-box">
          <span className="gp-row-name-text">{guardian.name}</span>
          <span className="gp-row-mobile-tag">{meta.label}</span>
        </div>
      </div>

      {/* 2. Relation */}
      <div className="gp-col gp-col-relation">
        <span className="gp-relation-badge">
          {meta.label}
        </span>
      </div>

      {/* 3. Contact (Phone) */}
      <div className="gp-col gp-col-phone">
        {guardian.phone ? (
          <a href={`tel:${guardian.phone}`} className="gp-row-link phone" title="Click to call">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <span>{guardian.phone}</span>
          </a>
        ) : (
          <span className="gp-text-muted">—</span>
        )}
      </div>

      {/* 4. Email */}
      <div className="gp-col gp-col-email">
        {guardian.email ? (
          <a href={`mailto:${guardian.email}`} className="gp-row-link email" title="Click to email">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <span className="gp-email-text">{guardian.email}</span>
          </a>
        ) : (
          <span className="gp-text-muted">No email set</span>
        )}
      </div>

      {/* 5. Status */}
      <div className="gp-col gp-col-status">
        <span className={`gp-status-pill ${isVerified ? "verified" : "pending"}`}>
          {isVerified ? "✓ Verified" : "Pending"}
        </span>
      </div>

      {/* 6. Action */}
      <div className="gp-col gp-col-actions">
        {confirming ? (
          <div className="gp-row-confirm">
            <button
              type="button"
              className="gp-btn-danger gp-btn-xs"
              onClick={() => onRemove(guardian.id)}
            >
              Delete
            </button>
            <button
              type="button"
              className="gp-btn-ghost gp-btn-xs"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="gp-row-action-btns">
            {!isVerified && (
              <button
                type="button"
                className="gp-btn-ghost gp-btn-xs"
                onClick={() => onVerify(guardian.id)}
                title="Verify contact"
              >
                Verify
              </button>
            )}
            <button
              type="button"
              className="gp-btn-delete-icon"
              onClick={() => setConfirming(true)}
              aria-label={`Remove ${guardian.name}`}
              title="Remove guardian"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        )}
      </div>

    </li>
  );
}
