import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, set, get } from 'firebase/database';
import { auth, database } from './firebase';
import emailjs from '@emailjs/browser';
import './VoiceEmergencyService.css';

const EMAILJS_SERVICE_ID = "service_s22wwzj";
const EMAILJS_TEMPLATE_ID = "template_ii0hc0q";
const EMAILJS_PUBLIC_KEY = "2VOJuC3m7OdmMfKHs";

/**
 * VoiceEmergencyService Component
 * Mounted directly in the header navbar.
 * Renders an ultra-clean, elegant Mic button where 'READY' used to be.
 * Continuously listens in background for 3 continuous 'help' keywords via Web Speech API.
 * Triggers silent SOS with vibration [200, 100, 200], GPS capture, Firebase sync, and EmailJS alert.
 * Clicking the mic button opens an elegant mini popover to test, toggle, or view detection status.
 */
export default function VoiceEmergencyService({
  user,
  guardiansList = [],
  onTriggerSilentSos,
  sosActive = false
}) {
  const [isSupported, setIsSupported] = useState(true);
  const [isServiceActive, setIsServiceActive] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [detectedTranscript, setDetectedTranscript] = useState('');
  const [helpCount, setHelpCount] = useState(0);
  const [isTriggered, setIsTriggered] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const recognitionRef = useRef(null);
  const isServiceActiveRef = useRef(isServiceActive);
  const isTriggeringRef = useRef(false);
  const recentHelpsRef = useRef([]);
  const containerRef = useRef(null);

  useEffect(() => {
    isServiceActiveRef.current = isServiceActive;
  }, [isServiceActive]);

  // Click outside listener to dismiss the popover
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsPopoverOpen(false);
      }
    };
    if (isPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isPopoverOpen]);

  // Silent SOS Dispatch Execution
  const executeSilentSos = useCallback(async (forced = false) => {
    if (isTriggeringRef.current && !forced) return;
    isTriggeringRef.current = true;
    setIsDispatching(true);
    setIsTriggered(true);
    setShowToast(true);

    const currentUser = user || auth.currentUser;
    const resolvedEmail = currentUser?.email || 'Anonymous Unit';
    const currentTime = new Date().toLocaleString();
    const alertId = Date.now();

    // 1. Silent Vibration: phone vibrates without any speaker audio
    if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (err) {
        console.warn('Vibration API not supported or blocked:', err);
      }
    }

    setStatusMessage('🚨 "help x3" detected! Silently alerting guardians...');

    const broadcastAlert = async (lat = null, lng = null) => {
      try {
        // 2. Broadcast to Firebase Realtime Database
        await set(ref(database, 'active_alerts/' + alertId), {
          id: alertId,
          userId: currentUser ? currentUser.uid : 'Unknown',
          email: resolvedEmail,
          latitude: lat,
          longitude: lng,
          timestamp: currentTime,
          status: 'DANGER',
          alertType: 'VOICE_TRIGGER',
          triggerPhrase: 'help help help',
          note: '🚨 SILENT VOICE SOS: Keyword "help" detected 3 times continuously.',
          audio: null
        });

        // 3. Dispatch EmailJS alert emails to registered guardians
        let recipients = Array.isArray(guardiansList) ? [...guardiansList] : [];
        if (recipients.length === 0 && currentUser?.uid) {
          try {
            const snap = await get(ref(database, `users/${currentUser.uid}/contacts`));
            if (snap.exists()) {
              recipients = Object.values(snap.val());
            }
          } catch (e) {
            console.error('Error fetching guardians:', e);
          }
        }

        const validEmails = recipients.filter(r => r && r.email);
        if (validEmails.length > 0) {
          const emailPromises = validEmails.map(contact => {
            const templateParams = {
              to_email: contact.email,
              user_name: resolvedEmail,
              latitude: lat || 'GPS Acquiring / Unavailable',
              longitude: lng || 'GPS Acquiring / Unavailable',
              timestamp: currentTime,
              message: `🚨 SILENT VOICE SOS ALERT: Voice distress keywords ('help help help') were continuously detected on ${resolvedEmail}'s device. Device is in silent emergency mode.`
            };

            return emailjs.send(
              EMAILJS_SERVICE_ID,
              EMAILJS_TEMPLATE_ID,
              templateParams,
              EMAILJS_PUBLIC_KEY
            );
          });

          await Promise.allSettled(emailPromises);
        }

        setStatusMessage(`🚨 SILENT SOS SENT! Guardians alerted with GPS location.`);

        // Notify parent App component
        if (typeof onTriggerSilentSos === 'function') {
          onTriggerSilentSos({
            alertId,
            latitude: lat,
            longitude: lng,
            timestamp: currentTime
          });
        }
      } catch (err) {
        console.error('Silent SOS broadcast error:', err);
        setStatusMessage(`⚠️ Alert error: ${err.message || 'Check connection'}`);
      } finally {
        setIsDispatching(false);
        setTimeout(() => {
          isTriggeringRef.current = false;
        }, 15000);
      }
    };

    // Silently capture geolocation
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => broadcastAlert(pos.coords.latitude, pos.coords.longitude),
        () => broadcastAlert(null, null),
        { timeout: 6000, enableHighAccuracy: true }
      );
    } else {
      broadcastAlert(null, null);
    }
  }, [user, guardiansList, onTriggerSilentSos]);

  // SpeechRecognition Lifecycle
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let combinedTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        combinedTranscript += event.results[i][0].transcript + ' ';
      }

      const cleanText = combinedTranscript.toLowerCase().trim();
      setDetectedTranscript(cleanText);

      // 1. Regex check for 3 continuous "help" words
      const threeHelpsRegex = /(?:\bhelp\b[\s,!\.-]*){3,}/i;

      // 2. Word token count check
      const words = cleanText.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
      let consecutiveHelps = 0;
      for (let w of words) {
        if (w === 'help') {
          consecutiveHelps++;
          if (consecutiveHelps >= 3) break;
        } else {
          consecutiveHelps = 0;
        }
      }

      // 3. Rolling time-window buffer
      const now = Date.now();
      if (cleanText.includes('help')) {
        const occurrences = (cleanText.match(/\bhelp\b/gi) || []).length;
        setHelpCount(Math.min(3, Math.max(occurrences, consecutiveHelps)));

        if (occurrences > 0) {
          recentHelpsRef.current.push(now);
          recentHelpsRef.current = recentHelpsRef.current.filter(t => now - t < 7000);
        }
      } else {
        setHelpCount(0);
      }

      const isContinuousThree =
        threeHelpsRegex.test(cleanText) ||
        consecutiveHelps >= 3 ||
        recentHelpsRef.current.length >= 3;

      if (isContinuousThree) {
        setHelpCount(3);
        recentHelpsRef.current = [];
        executeSilentSos(false);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setStatusMessage('⚠️ Microphone access needed for Voice Guard.');
        setIsListening(false);
      } else if (event.error === 'no-speech') {
        // Normal ambient silence
      } else {
        console.warn('SpeechRecognition notice:', event.error);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (isServiceActiveRef.current) {
        try {
          recognition.start();
        } catch (e) {}
      }
    };

    if (isServiceActive) {
      try {
        recognition.start();
      } catch (err) {
        console.warn('Speech recognition notice:', err);
      }
    }

    return () => {
      recognition.onend = null;
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [isServiceActive, executeSilentSos]);

  // Toggle Service
  const handleToggleService = () => {
    if (isServiceActive) {
      setIsServiceActive(false);
      isServiceActiveRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      setHelpCount(0);
      setStatusMessage('Voice Guard paused.');
    } else {
      setIsServiceActive(true);
      isServiceActiveRef.current = true;
      setStatusMessage('');
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (e) {}
      }
    }
  };

  const isAlarmed = isTriggered || sosActive;

  return (
    <div className="ves-header-wrapper" ref={containerRef}>
      {/* Top Navbar Mic Action Pill / Button */}
      <button
        id="btn-voice-guard-nav"
        className={`nav-voice-btn ${isAlarmed ? 'danger' : isServiceActive ? 'safe' : 'paused'}`}
        onClick={() => setIsPopoverOpen(prev => !prev)}
        title={
          isAlarmed
            ? 'Emergency Alert Active'
            : isServiceActive
            ? 'Voice Guard SOS: Active (Tap to configure or test)'
            : 'Voice Guard SOS: Paused (Tap to activate)'
        }
        aria-label="Voice Guard SOS settings"
        type="button"
      >
        {isAlarmed ? (
          <span className="nav-voice-icon-alarm">🚨</span>
        ) : (
          <svg
            className={`nav-mic-icon ${isListening ? 'listening' : ''}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        )}

        <span className={`nav-voice-dot ${isAlarmed ? 'danger' : isServiceActive ? 'safe' : 'paused'}`} />

        <span className="nav-voice-label">
          {isAlarmed ? 'EMERGENCY' : isServiceActive ? 'READY' : 'OFF'}
        </span>
      </button>

      {/* Floating Dropdown / Popover Sheet */}
      {isPopoverOpen && (
        <div className="ves-popover-dropdown">
          <div className="ves-popover-header">
            <div className="ves-popover-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              <span>Voice Guard SOS</span>
            </div>
            <button
              className="ves-popover-close"
              onClick={() => setIsPopoverOpen(false)}
              aria-label="Close"
              type="button"
            >
              ✕
            </button>
          </div>

          <p className="ves-popover-desc">
            Say <strong>'help' 3 times</strong> continuously to silently trigger emergency SOS without opening your phone.
          </p>

          {/* Status Row: Listening wave + Toggle switch */}
          <div className="ves-popover-row">
            <div className="ves-popover-listening-info">
              <div className={`ves-popover-wave ${isListening ? 'active' : ''}`}>
                <span /><span /><span />
              </div>
              <span className="ves-popover-listen-text">
                {!isSupported
                  ? 'Mic not supported'
                  : isServiceActive
                  ? (isListening ? 'Listening active' : 'Connecting mic...')
                  : 'Guard paused'}
              </span>
            </div>

            <button
              id="btn-toggle-voice-guard"
              className={`ves-popover-toggle ${isServiceActive ? 'active' : 'paused'}`}
              onClick={handleToggleService}
              type="button"
            >
              {isServiceActive ? '🟢 ON' : '⚪ OFF'}
            </button>
          </div>

          {/* Live detection chips */}
          <div className="ves-popover-chips-row">
            <span className="ves-popover-chips-label">Keyword trigger:</span>
            <div className="ves-chips">
              <span className={`ves-chip ${helpCount >= 1 ? (isAlarmed ? 'danger-lit' : 'lit') : ''}`}>HELP</span>
              <span className={`ves-chip ${helpCount >= 2 ? (isAlarmed ? 'danger-lit' : 'lit') : ''}`}>HELP</span>
              <span className={`ves-chip ${helpCount >= 3 ? (isAlarmed ? 'danger-lit' : 'lit') : ''}`}>HELP</span>
            </div>
          </div>

          {/* Test Silent SOS button */}
          <div className="ves-popover-actions">
            <button
              id="btn-test-voice-sos"
              className="ves-popover-test-btn"
              onClick={() => executeSilentSos(true)}
              disabled={isDispatching}
              type="button"
            >
              {isDispatching ? '⚡ Sending Alert...' : '⚡ Test Silent Voice SOS'}
            </button>
          </div>

          {/* Alert status if triggered */}
          {(isTriggered || statusMessage) && (
            <div className="ves-popover-status-strip">
              <span>{statusMessage || '🚨 Silent SOS sent to guardians!'}</span>
              <span className="ves-vib-badge">📳 VIBRATED</span>
            </div>
          )}
        </div>
      )}

      {/* Floating Toast Notification when Triggered */}
      {showToast && (
        <div className="ves-floating-toast">
          <div className="ves-toast-content">
            <span className="ves-toast-icon">🚨</span>
            <div className="ves-toast-text">
              <strong>Silent Voice SOS Alert Triggered!</strong>
              <span>GPS coords & emergency dispatch sent to guardians.</span>
            </div>
          </div>
          <button
            className="ves-toast-dismiss"
            onClick={() => setShowToast(false)}
            type="button"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
