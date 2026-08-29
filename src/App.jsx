import { useState } from 'react';
import { auth, database } from './firebase';
import { ref, set, update, get } from 'firebase/database';
import { signOut } from 'firebase/auth';
import emailjs from '@emailjs/browser';
import './App.css';
import Auth from './Auth';
import Dashboard from './Dashboard';
import GuardiansPage from './EmergencyContact/GuardiansPage';

const EMAILJS_SERVICE_ID = "service_s22wwzj";
const EMAILJS_TEMPLATE_ID = "template_ii0hc0q";
const EMAILJS_PUBLIC_KEY = "2VOJuC3m7OdmMfKHs";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [currentAlertId, setCurrentAlertId] = useState(null);
  const [recordingStatus, setRecordingStatus] = useState('');
  const [currentView, setCurrentView] = useState('sos');

  // 7-Second Emergency Audio Recorder (Silent background recording for victim)
  const recordEmergencyAudio = (alertId) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setRecordingStatus('⚠️ Mic not supported on this device.');
      return;
    }

    setRecordingStatus('🎙️ Recording 7s emergency audio silently...');

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        let options = {};
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        }

        const mediaRecorder = new MediaRecorder(stream, options);
        const audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          const reader = new FileReader();

          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            const base64Audio = reader.result;

            update(ref(database, 'active_alerts/' + alertId), {
              audio: base64Audio
            });
            setRecordingStatus('✅ Emergency audio recorded & sent to Dashboard!');
          };

          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start(1000);

        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, 7000);
      })
      .catch((err) => {
        console.error("Mic error:", err);
        setRecordingStatus('⚠️ Mic permission denied.');
      });
  };

  const sendAlertEmails = async (lat, lng, alertTime) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const snapshot = await get(ref(database, `users/${user.uid}/contacts`));
      if (snapshot.exists()) {
        const contacts = snapshot.val();

        Object.values(contacts).forEach((contact) => {
          if (contact.email) {
            const templateParams = {
              to_email: contact.email,
              user_name: user.email,
              latitude: lat,
              longitude: lng,
              timestamp: alertTime
            };

            emailjs.send(
              EMAILJS_SERVICE_ID,
              EMAILJS_TEMPLATE_ID,
              templateParams,
              EMAILJS_PUBLIC_KEY
            ).catch((err) => console.error("EmailJS Error:", err));
          }
        });
      }
    } catch (err) {
      console.error("Error fetching contacts:", err);
    }
  };

  const handleSosClick = () => {
    if (!sosActive) {
      setSosActive(true);
      setLocationError(null);

      // Victim's phone remains completely silent and safe.
      // Siren & Voice alerts will only trigger on the Guardian/Admin Dashboard.

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const currentTime = new Date().toLocaleString();
            setLocation({ latitude: lat, longitude: lng });

            const user = auth.currentUser;
            const alertId = Date.now();
            setCurrentAlertId(alertId);

            set(ref(database, 'active_alerts/' + alertId), {
              userId: user ? user.uid : "Unknown",
              email: user ? user.email : "Unknown",
              latitude: lat,
              longitude: lng,
              timestamp: currentTime,
              status: "DANGER",
              audio: null
            });

            recordEmergencyAudio(alertId);
            sendAlertEmails(lat, lng, currentTime);
          },
          (error) => {
            setLocationError("Location access denied or not available.");
          }
        );
      } else {
        setLocationError("Geolocation is not supported.");
      }
    } else {
      setSosActive(false);
      setLocation(null);
      setLocationError(null);
      setRecordingStatus('');

      if (currentAlertId) {
        update(ref(database, 'active_alerts/' + currentAlertId), {
          status: "SAFE",
          resolvedAt: new Date().toLocaleString()
        });
        setCurrentAlertId(null);
      }
    }
  };

  const handleLogout = () => {
    signOut(auth).then(() => {
      setIsLoggedIn(false);
    });
  };

  if (!isLoggedIn) {
    return <Auth setIsLoggedIn={setIsLoggedIn} />;
  }

  const user = auth.currentUser;
  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  return (
    <div className="app-shell">
      {/* Full-width Top Professional Navbar */}
      <header className="navbar-wrapper">
        <div className="navbar-container">
          
          {/* Left: Brand Identity */}
          <div className="navbar-brand" onClick={() => setCurrentView('sos')}>
            <div className="navbar-brand-logo">
              <div className="navbar-logo-glow"></div>
              <span className="navbar-logo-icon">🚨</span>
            </div>
            <div className="navbar-brand-info">
              <div className="navbar-brand-title">
                ResQ<span>Alert</span>
              </div>
              <span className="navbar-brand-tag">PROACTIVE SAFETY</span>
            </div>
          </div>

          {/* Center: Desktop Navigation Tabs */}
          <nav className="navbar-nav desktop-nav" role="tablist" aria-label="Main navigation">
            <button
              id="nav-sos"
              role="tab"
              aria-selected={currentView === 'sos'}
              className={`navbar-nav-item ${currentView === 'sos' ? 'active' : ''}`}
              onClick={() => setCurrentView('sos')}
            >
              SOS
            </button>
            <button
              id="nav-contacts"
              role="tab"
              aria-selected={currentView === 'contacts'}
              className={`navbar-nav-item ${currentView === 'contacts' ? 'active' : ''}`}
              onClick={() => setCurrentView('contacts')}
            >
              Guardians
            </button>
            <button
              id="nav-dashboard"
              role="tab"
              aria-selected={currentView === 'dashboard'}
              className={`navbar-nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentView('dashboard')}
            >
              Dashboard
            </button>
          </nav>

          {/* Right: Status Pill, User, Logout */}
          <div className="navbar-actions">
            <div className={`nav-status-badge ${sosActive ? 'danger' : 'safe'}`}>
              <span className="nav-status-dot"></span>
              <span className="nav-status-text">{sosActive ? 'EMERGENCY' : 'READY'}</span>
            </div>

            {user?.email && (
              <div className="nav-user-pill" title={user.email}>
                <span className="nav-user-avatar">{userInitial}</span>
                <span className="nav-user-email">{user.email}</span>
              </div>
            )}

            <button 
              className="navbar-btn-logout" 
              onClick={handleLogout} 
              title="Log out from account"
              aria-label="Log out"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>

        </div>
      </header>

      {/* Mobile-Only Segmented Tabs (Rendered outside/below the top navbar) */}
      <div className="mobile-tabs-container">
        <nav className="mobile-segmented-nav" role="tablist" aria-label="Mobile navigation">
          <button
            id="mobile-nav-sos"
            role="tab"
            aria-selected={currentView === 'sos'}
            className={`mobile-nav-btn ${currentView === 'sos' ? 'active' : ''}`}
            onClick={() => setCurrentView('sos')}
          >
            SOS
          </button>
          <button
            id="mobile-nav-contacts"
            role="tab"
            aria-selected={currentView === 'contacts'}
            className={`mobile-nav-btn ${currentView === 'contacts' ? 'active' : ''}`}
            onClick={() => setCurrentView('contacts')}
          >
            Guardians
          </button>
          <button
            id="mobile-nav-dashboard"
            role="tab"
            aria-selected={currentView === 'dashboard'}
            className={`mobile-nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            Dashboard
          </button>
        </nav>
      </div>

      {/* Main App Page Content */}
      <main className="app-main-content">
        {currentView === 'sos' && (
          <div className="sos-view-container">
            {/* SOS Button with pulsing ambient rings */}
            <div className="sos-wrapper">
              {!sosActive && (
                <>
                  <div className="sos-ring"></div>
                  <div className="sos-ring"></div>
                  <div className="sos-ring"></div>
                </>
              )}
              <button
                id="sos-trigger-btn"
                className={`sos-button ${sosActive ? 'active' : ''}`}
                onClick={handleSosClick}
                aria-label={sosActive ? 'Deactivate SOS alert' : 'Activate SOS emergency alert'}
              >
                {sosActive ? 'STOP' : 'SOS'}
              </button>
            </div>

            {/* Status Information */}
            <div className="status-container">
              <p className={`status-text ${sosActive ? 'alert-active' : ''}`}>
                {sosActive
                  ? '🚨 Emergency Alert Sent Silently!'
                  : 'Tap the SOS button in an emergency'}
              </p>

              {sosActive && recordingStatus && (
                <p className="recording-status">{recordingStatus}</p>
              )}

              {sosActive && location && (
                <div className="location-box">
                  <div className="location-box-header">
                    <span>📍</span> Live Location Captured
                  </div>
                  <div className="location-coord">
                    <span className="label">Latitude</span>
                    <span className="value">{location.latitude.toFixed(6)}°</span>
                  </div>
                  <div className="location-coord">
                    <span className="label">Longitude</span>
                    <span className="value">{location.longitude.toFixed(6)}°</span>
                  </div>
                  <div className="sync-indicator">
                    <span className="sync-dot"></span>
                    Syncing live to Guardian Dashboard...
                  </div>
                </div>
              )}

              {locationError && (
                <p className="error-text">⚠️ {locationError}</p>
              )}
            </div>

            {!sosActive && (
              <p className="sos-hint">
                One tap instantly alerts guardians with live GPS & audio silently
              </p>
            )}
          </div>
        )}

        {currentView === 'contacts' && <GuardiansPage />}
        {currentView === 'dashboard' && <Dashboard />}
      </main>
    </div>
  );
}

export default App;