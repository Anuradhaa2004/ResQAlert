import { useState } from "react";

const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY = { name: "", phone: "", email: "", relation: "family" };

export default function GuardianForm({ onAdd, disabled, disabledReason }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const set_ = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }));
  };

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!PHONE_RE.test(form.phone.trim()))
      next.phone = "Enter a valid 10-digit mobile number.";
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim()))
      next.email = "Enter a valid email address.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (disabled || !validate()) return;
    onAdd({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      relation: form.relation,
      verified: false,
    });
    setForm(EMPTY);
  }

  return (
    <form className="gp-form" onSubmit={handleSubmit} noValidate>

      {/* Name */}
      <div className="gp-field">
        <label className="gp-label" htmlFor="gf-name">Full Name</label>
        <div className="gp-input-wrap">
          <span className="gp-input-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </span>
          <input
            id="gf-name"
            className="gp-input"
            type="text"
            placeholder="e.g. Priya Sharma"
            value={form.name}
            onChange={set_("name")}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "gf-name-err" : undefined}
          />
        </div>
        {errors.name && <p className="gp-field-error" id="gf-name-err">⚠ {errors.name}</p>}
      </div>

      {/* Phone + Relation */}
      <div className="gp-field-row">
        <div className="gp-field">
          <label className="gp-label" htmlFor="gf-phone">Mobile Number</label>
          <div className="gp-input-wrap">
            <span className="gp-input-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </span>
            <input
              id="gf-phone"
              className="gp-input"
              type="tel"
              inputMode="numeric"
              placeholder="98765 43210"
              value={form.phone}
              onChange={set_("phone")}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "gf-phone-err" : undefined}
            />
          </div>
          {errors.phone && <p className="gp-field-error" id="gf-phone-err">⚠ {errors.phone}</p>}
        </div>

        <div className="gp-field">
          <label className="gp-label" htmlFor="gf-relation">Relationship</label>
          <select id="gf-relation" className="gp-select" value={form.relation} onChange={set_("relation")}>
            <option value="family">👪 Family</option>
            <option value="friend">🤝 Friend</option>
            <option value="police">🛡️ Police</option>
            <option value="neighbor">🏠 Neighbor</option>
            <option value="other">★ Other</option>
          </select>
        </div>
      </div>

      {/* Email */}
      <div className="gp-field">
        <label className="gp-label" htmlFor="gf-email">
          Email <span>(optional — for SOS email alerts)</span>
        </label>
        <div className="gp-input-wrap">
          <span className="gp-input-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
          </span>
          <input
            id="gf-email"
            className="gp-input"
            type="email"
            placeholder="guardian@example.com"
            value={form.email}
            onChange={set_("email")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "gf-email-err" : undefined}
          />
        </div>
        {errors.email && <p className="gp-field-error" id="gf-email-err">⚠ {errors.email}</p>}
      </div>

      {disabled && disabledReason && (
        <p className="gp-limit-note">{disabledReason}</p>
      )}

      <button type="submit" className="gp-btn-primary" disabled={disabled}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
          <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
        </svg>
        {disabled ? "Guardian limit reached" : "Add to Protection Circle"}
      </button>
    </form>
  );
}
