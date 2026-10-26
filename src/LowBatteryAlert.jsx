import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, set, update, get } from 'firebase/database';
import { auth, database } from './firebase';
import emailjs from '@emailjs/browser';
import './LowBatteryAlert.css';

const EMAILJS_SERVICE_ID = "service_s22wwzj";
const EMAILJS_TEMPLATE_ID = "template_ii0hc0q";
const EMAILJS_PUBLIC_KEY = "2VOJuC3m7OdmMfKHs";
const LOW_BATTERY_THRESHOLD = 20; // 20%

/**
 * LowBatteryAlert Component
 * Monitors device battery level and automatically dispatches an emergency
 * alert to Firebase Realtime Database and EmailJS when battery <= 20%.
 *
 * @param {string} userEmail - Email address of current user
 * @param {Array|Object} guardiansList - List of guardian contacts with email
 */
export default function LowBatteryAlert({ userEmail, guardiansList = [] }) {
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [isCharging, setIsCharging] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isDispatching, setIsDispatching] = useState(false);
  const [alertDispatched, setAlertDispatched] = useState(false);
  const [lastDispatchedTime, setLastDispatchedTime] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSimulated, setIsSimulated] = useState(false);

  // Ref to prevent spamming duplicate alert emails within the same low cycle
  const hasAlertedRef = useRef(false);

  // Normalize guardians list into an array of contacts
  const normalizedGuardians = Array.isArray(guardiansList)
    ? guardiansList
    : guardiansList && typeof guardiansList === 'object'
    ? Object.keys(guardiansList).map(k => ({ id: k, ...guardiansList[k] }))
    : [];

  const guardiansWithEmail = normalizedGuardians.filter(g => g && g.email);

  // Send the low battery alert to Firebase & EmailJS
  const triggerLowBatteryAlert = useCallback(async (currentLvl, forceManual = false) => {
    // If already alerted and not manual trigger, prevent duplicate sends
    if (hasAlertedRef.current && !forceManual) {
      return;
    }

    setIsDispatching(true);
    setStatusMessage('🚨 Battery ≤ 20%! Gathering GPS & dispatching guardian alerts...');

    const currentUser = auth.currentUser;
    const resolvedEmail = userEmail || currentUser?.email || 'Unknown User';
    const currentTime = new Date().toLocaleString();
    const alertId = Date.now();

    // Helper to log alert to Firebase RTDB and send emails
    const executeAlertBroadcast = async (latitude = null, longitude = null) => {
      try {
        // 1. Write to Firebase active_alerts so it displays in Realtime Tactical Dashboard
        await set(ref(database, 'active_alerts/' + alertId), {
          id: alertId,
          userId: currentUser ? currentUser.uid : 'Unknown',
          email: resolvedEmail,
          latitude: latitude,
          longitude: longitude,
          timestamp: currentTime,
          status: 'DANGER',
          alertType: 'LOW_BATTERY',
          batteryLevel: Math.round(currentLvl),
          note: `⚡ AUTOMATIC LOW BATTERY EMERGENCY: Device is at ${Math.round(currentLvl)}% battery.`
        });

        // 2. Also log to user's personal battery status node
        if (currentUser?.uid) {
          await update(ref(database, `users/${currentUser.uid}/battery_status`), {
            level: Math.round(currentLvl),
            lastAlertAt: currentTime,
            status: 'CRITICAL_LOW'
          });
        }

        // 3. Send EmailJS alert emails to each registered guardian
        let recipients = [...guardiansWithEmail];

        // If no guardians registered in props, attempt fallback fetch from Realtime DB
        if (recipients.length === 0 && currentUser?.uid) {
          try {
            const snap = await get(ref(database, `users/${currentUser.uid}/contacts`));
            if (snap.exists()) {
              const contacts = snap.val();
              recipients = Object.values(contacts).filter(c => c && c.email);
            }
          } catch (e) {
            console.error('Error fetching fallback contacts:', e);
          }
        }

        if (recipients.length > 0) {
          const emailPromises = recipients.map(guardian => {
            const templateParams = {
              to_email: guardian.email,
              user_name: resolvedEmail,
              latitude: latitude || 'GPS Acquiring / Unavailable',
              longitude: longitude || 'GPS Acquiring / Unavailable',
              timestamp: currentTime,
              message: `⚠️ CRITICAL LOW BATTERY ALERT: ${resolvedEmail}'s device battery has dropped to ${Math.round(currentLvl)}%. Device may power off soon. Last reported GPS: [${latitude || 'N/A'}, ${longitude || 'N/A'}]`
            };

            return emailjs.send(
              EMAILJS_SERVICE_ID,
              EMAILJS_TEMPLATE_ID,
              templateParams,
              EMAILJS_PUBLIC_KEY
            );
          });

          await Promise.allSettled(emailPromises);
          setStatusMessage(`✅ Alert sent to ${recipients.length} guardian(s) via EmailJS & synced to Firebase!`);
        } else {
          setStatusMessage('⚠️ Alert recorded in Firebase. (No guardian emails configured yet)');
        }

        hasAlertedRef.current = true;
        setAlertDispatched(true);
        setLastDispatchedTime(currentTime);
      } catch (err) {
        console.error('Error broadcasting low battery alert:', err);
        setStatusMessage(`⚠️ Broadcast Error: ${err.message || 'Check EmailJS / Firebase'}`);
      } finally {
        setIsDispatching(false);
      }
    };

    // Attempt to capture GPS location before broadcasting
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          executeAlertBroadcast(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // Geolocation failed or denied; still broadcast alert without coordinates
          executeAlertBroadcast(null, null);
        },
        { timeout: 6000 }
      );
    } else {
      executeAlertBroadcast(null, null);
    }
  }, [userEmail, guardiansWithEmail]);

  // Battery Status API listener
  useEffect(() => {
    let batteryInstance = null;

    const handleBatteryUpdate = (battery) => {
      const level = Math.round(battery.level * 100);
      setBatteryLevel(level);
      setIsCharging(battery.charging);

      // Reset alert flag if user connects charger or battery rises above threshold
      if (battery.charging || level > LOW_BATTERY_THRESHOLD) {
        hasAlertedRef.current = false;
        setAlertDispatched(false);
      }

      // Check if automatic low battery alert condition is met
      if (level <= LOW_BATTERY_THRESHOLD && !hasAlertedRef.current) {
        triggerLowBatteryAlert(level);
      }
    };

    if (navigator && 'getBattery' in navigator) {
      navigator.getBattery().then((battery) => {
        batteryInstance = battery;
        handleBatteryUpdate(battery);

        const onLevelChange = () => handleBatteryUpdate(battery);
        const onChargingChange = () => handleBatteryUpdate(battery);

        battery.addEventListener('levelchange', onLevelChange);
        battery.addEventListener('chargingchange', onChargingChange);

        return () => {
          battery.removeEventListener('levelchange', onLevelChange);
          battery.removeEventListener('chargingchange', onChargingChange);
        };
      }).catch((err) => {
        console.warn('Battery API error, using simulation fallback:', err);
        setIsSupported(false);
      });
    } else {
      setIsSupported(false);
    }
  }, [triggerLowBatteryAlert]);

  // Handle simulation slider change for live testing on any device
  const handleSimulateSlider = (e) => {
    const val = Number(e.target.value);
    setIsSimulated(true);
    setBatteryLevel(val);

    if (val > LOW_BATTERY_THRESHOLD) {
      hasAlertedRef.current = false;
      setAlertDispatched(false);
    } else if (val <= LOW_BATTERY_THRESHOLD && !hasAlertedRef.current) {
      triggerLowBatteryAlert(val);
    }
  };

  // Determine color status
  const isDanger = batteryLevel <= LOW_BATTERY_THRESHOLD;
  const isWarning = batteryLevel > LOW_BATTERY_THRESHOLD && batteryLevel <= 50;
  const statusTheme = isDanger ? 'danger' : isWarning ? 'warning' : 'safe';

  return (
    <div className={`lba-card ${isDanger ? 'critical-alert' : ''}`}>
      {/* Background ambient lighting */}
      <div className={`lba-ambient-glow ${statusTheme}`} />

      {/* 1. Header Row */}
      <div className="lba-header">
        <div className="lba-header-left">
          <div className={`lba-icon-container ${statusTheme}`}>
            {isCharging ? '⚡' : isDanger ? '🪫' : '🔋'}
          </div>
          <div className="lba-title-group">
            <span className="lba-tag">
              <span className={`lba-tag-dot ${statusTheme}`}></span>
              Hardware Telemetry & Auto-Dispatch
            </span>
            <h3 className="lba-title">
              Device Power Monitor
              {isSimulated && <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '500' }}>[SIMULATION MODE]</span>}
            </h3>
          </div>
        </div>

        <div className="lba-header-right">
          {isCharging && (
            <span className="lba-status-pill charging">
              ⚡ Plugged In / Charging
            </span>
          )}

          <span className={`lba-status-pill ${statusTheme}`}>
            {isDanger
              ? 'CRITICAL DEFICIT (≤ 20%)'
              : isWarning
              ? 'MODERATE DISCHARGE'
              : 'BATTERY HEALTH NOMINAL'}
          </span>
        </div>
      </div>

      {/* 2. Battery Percentage & Gauge Row */}
      <div className="lba-body">
        {/* Physical Battery Shell Icon */}
        <div className="lba-battery-shell-wrapper">
          <div className="lba-battery-shell">
            <div
              className={`lba-battery-fill-inner ${statusTheme}`}
              style={{ width: `${Math.max(8, batteryLevel)}%` }}
            />
          </div>
        </div>

        {/* Progress & Numbers */}
        <div className="lba-meter-col">
          <div className="lba-meter-label-row">
            <span className={`lba-level-text ${statusTheme}`}>
              {batteryLevel}%
            </span>
            <span className="lba-meter-desc">
              {isCharging ? 'Charging actively' : 'Operating on battery'}
            </span>
          </div>

          <div className="lba-progress-track">
            {/* 20% Threshold Marker */}
            <div
              className="lba-threshold-marker"
              title="20% Automated Guardian Dispatch Threshold"
            />
            <div
              className={`lba-progress-bar ${statusTheme}`}
              style={{
                width: `${batteryLevel}%`,
                background: isDanger
                  ? 'linear-gradient(90deg, #ff1e4b, #ff4d6d)'
                  : isWarning
                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                  : 'linear-gradient(90deg, #10b981, #34d399)'
              }}
            />
          </div>
        </div>

        {/* Threshold Info */}
        <div className="lba-threshold-badge">
          <span className="lba-threshold-val">TRIGGER: ≤ 20%</span>
          <span className="lba-threshold-sub">Auto-Email & RTDB Broadcast</span>
        </div>
      </div>

      {/* 3. Guardian Protection Circle Status */}
      <div className="lba-guardians-row">
        <div className="lba-guardians-info">
          <span>🛡️ Guardian Circle:</span>
          <strong>{guardiansWithEmail.length} Recipient(s)</strong>
        </div>

        <div className="lba-guardian-chips">
          {guardiansWithEmail.length > 0 ? (
            guardiansWithEmail.slice(0, 3).map((g, idx) => (
              <span key={g.id || idx} className="lba-chip highlight" title={g.email}>
                ✉️ {g.name ? `${g.name} (${g.email})` : g.email}
              </span>
            ))
          ) : (
            <span className="lba-chip" style={{ color: '#f59e0b' }}>
              ⚠️ No guardian emails found in protection circle
            </span>
          )}
          {guardiansWithEmail.length > 3 && (
            <span className="lba-chip">+{guardiansWithEmail.length - 3} more</span>
          )}
        </div>
      </div>

      {/* 4. Action & Drill Controls */}
      <div className="lba-actions-row">
        {/* Simulator controls */}
        <div className="lba-sim-control">
          <span>Test Slider:</span>
          <input
            id="low-battery-sim-slider"
            type="range"
            min="5"
            max="100"
            value={batteryLevel}
            onChange={handleSimulateSlider}
            className="lba-sim-slider"
            title="Slide to test automatic trigger at <= 20%"
          />
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{batteryLevel}%</span>
        </div>

        <div className="lba-btn-group">
          {/* Quick 15% Test simulation */}
          <button
            id="btn-simulate-15-percent"
            className="lba-btn lba-btn-ghost"
            onClick={() => handleSimulateSlider({ target: { value: 15 } })}
            title="Simulate 15% Low Battery state"
          >
            📉 Simulate 15%
          </button>

          {/* Manual immediate test drill */}
          <button
            id="btn-trigger-low-battery-drill"
            className="lba-btn lba-btn-trigger"
            onClick={() => triggerLowBatteryAlert(batteryLevel, true)}
            disabled={isDispatching}
            title="Simulate emergency dispatch drill via EmailJS and Firebase"
          >
            {isDispatching ? (
              <>
                <span className="lba-spinner"></span>
                <span>Dispatching...</span>
              </>
            ) : (
              <>
                <span>⚡ Test Auto-Alert Drill</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 5. Dispatch Status & Audit Feedback */}
      {(statusMessage || alertDispatched) && (
        <div className={`lba-dispatch-banner ${alertDispatched && !isDanger ? 'success' : ''}`}>
          <span>
            {statusMessage || (alertDispatched ? `🚨 Low battery alert dispatched at ${lastDispatchedTime}` : '')}
          </span>
          {alertDispatched && (
            <button
              onClick={() => {
                setAlertDispatched(false);
                setStatusMessage('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontWeight: 'bold',
                padding: '0 4px'
              }}
              title="Dismiss message"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}
