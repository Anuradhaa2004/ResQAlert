import { useState } from 'react';
import { auth, database } from './firebase';
import { ref, set, update, get } from 'firebase/database';
import emailjs from '@emailjs/browser';
import './App.css';
import Auth from './Auth';
import Dashboard from './Dashboard';
import EmergencyContacts from './EmergencyContacts';

// 🔑 Tumhari EmailJS Keys (Public Key yahan paste kar dena)
const EMAILJS_SERVICE_ID = "service_s22wwzj";
const EMAILJS_TEMPLATE_ID = "template_ii0hc0q";
const EMAILJS_PUBLIC_KEY = "2VOJuC3m7OdmMfKHs";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [currentAlertId, setCurrentAlertId] = useState(null);
  const [currentView, setCurrentView] = useState('sos');

  // Emergency Emails Bhejne Ka Function
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
            ).then(() => {
              console.log(`Alert email sent to ${contact.email}`);
            }).catch((err) => {
              console.error("EmailJS Error:", err);
            });
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

            // 1. Firebase mein Data Save karo
            set(ref(database, 'active_alerts/' + alertId), {
              userId: user ? user.uid : "Unknown",
              email: user ? user.email : "Unknown",
              latitude: lat,
              longitude: lng,
              timestamp: currentTime,
              status: "DANGER"
            });

            // 2. Guardians ko Email Alert bhejo
            sendAlertEmails(lat, lng, currentTime);
          },
          (error) => {
            setLocationError("Location access denied or not available.");
          }
        );
      } else {
        setLocationError("Geolocation is not supported by your browser.");
      }
    } else {
      setSosActive(false);
      setLocation(null);
      setLocationError(null);
      if (currentAlertId) {
        update(ref(database, 'active_alerts/' + currentAlertId), {
          status: "SAFE",
          resolvedAt: new Date().toLocaleString()
        });
        setCurrentAlertId(null);
      }
    }
  };

  if (!isLoggedIn) {
    return <Auth setIsLoggedIn={setIsLoggedIn} />;
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>ResQAlert</h1>
        <p>Proactive Safety Application</p>
      </header>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '15px 0', flexWrap: 'wrap' }}>
        <button
          onClick={() => setCurrentView('sos')}
          style={{
            padding: '8px 14px', borderRadius: '5px',
            backgroundColor: currentView === 'sos' ? '#ff4757' : '#e0e0e0',
            color: currentView === 'sos' ? '#fff' : '#333', border: 'none', cursor: 'pointer'
          }}
        >
          SOS App
        </button>
        <button
          onClick={() => setCurrentView('contacts')}
          style={{
            padding: '8px 14px', borderRadius: '5px',
            backgroundColor: currentView === 'contacts' ? '#ff4757' : '#e0e0e0',
            color: currentView === 'contacts' ? '#fff' : '#333', border: 'none', cursor: 'pointer'
          }}
        >
          Guardians
        </button>
        <button
          onClick={() => setCurrentView('dashboard')}
          style={{
            padding: '8px 14px', borderRadius: '5px',
            backgroundColor: currentView === 'dashboard' ? '#ff4757' : '#e0e0e0',
            color: currentView === 'dashboard' ? 'rgba(68, 89, 119, 0.47)' : '#333', border: 'none', cursor: 'pointer'
          }}
        >
          Admin Dashboard
        </button>
      </div>

      {currentView === 'sos' && (
        <main className="main-content">
          <button
            className={`sos-button ${sosActive ? 'active' : ''}`}
            onClick={handleSosClick}
          >
            {sosActive ? 'STOP' : 'SOS'}
          </button>
          <div className="status-container">
            <p className="status-text">
              {sosActive
                ? 'Emergency Alert Active! Sending Emails to Guardians...'
                : 'Tap the SOS button in an emergency'}
            </p>
            {sosActive && location && (
              <div className="location-box">
                <p>Latitude: {location.latitude.toFixed(5)}</p>
                <p>Longitude: {location.longitude.toFixed(5)}</p>
                <p style={{ color: '#2ed573', marginTop: '10px', fontSize: '0.9rem' }}>
                  ✓ Alert sent to registered Guardians!
                </p>
              </div>
            )}
            {locationError && (
              <p className="error-text">{locationError}</p>
            )}
          </div>
        </main>
      )}

      {currentView === 'contacts' && <EmergencyContacts />}
      {currentView === 'dashboard' && <Dashboard />}
    </div>
  );
}

export default App;