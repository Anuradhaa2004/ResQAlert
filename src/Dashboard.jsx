import { useEffect, useState, useRef } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from './firebase';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function Dashboard() {
    const [alerts, setAlerts] = useState([]);
    const sirenIntervalRef = useRef(null);

    const startContinuousSiren = () => {
        if (sirenIntervalRef.current) return;

        const playSoundLoop = () => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const speechText = "Emergency Alert! SOS button press hua hai. Please accept the emergency immediately.";
                const utterance = new SpeechSynthesisUtterance(speechText);
                utterance.rate = 1.0;
                utterance.pitch = 1.1;
                utterance.volume = 1.0;
                window.speechSynthesis.speak(utterance);
            }

            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(800, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.5);
                gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.5);
            } catch (e) {
                console.log("AudioContext error", e);
            }
        };

        playSoundLoop();
        sirenIntervalRef.current = setInterval(playSoundLoop, 4000);
    };

    const stopContinuousSiren = () => {
        if (sirenIntervalRef.current) {
            clearInterval(sirenIntervalRef.current);
            sirenIntervalRef.current = null;
        }
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    };

    useEffect(() => {
        const alertsRef = ref(database, 'active_alerts');

        const unsubscribe = onValue(alertsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const activeList = Object.keys(data)
                    .map((key) => ({ id: key, ...data[key] }))
                    .filter((item) => item.status === 'DANGER' || item.status === 'ACCEPTED');

                setAlerts(activeList);

                const hasDanger = activeList.some((item) => item.status === 'DANGER');
                if (hasDanger) {
                    startContinuousSiren();
                } else {
                    stopContinuousSiren();
                }
            } else {
                setAlerts([]);
                stopContinuousSiren();
            }
        });

        return () => {
            unsubscribe();
            stopContinuousSiren();
        };
    }, []);

    const handleAcceptEmergency = (alertId) => {
        stopContinuousSiren();
        update(ref(database, 'active_alerts/' + alertId), {
            status: 'ACCEPTED',
            acceptedAt: new Date().toLocaleString()
        });
    };

    const defaultCenter = alerts.length > 0
        ? [alerts[0].latitude, alerts[0].longitude]
        : [20.5937, 78.9629];

    const dangerCount = alerts.filter(a => a.status === 'DANGER').length;
    const acceptedCount = alerts.filter(a => a.status === 'ACCEPTED').length;

    return (
        <div className="dashboard-container">
            {/* Dashboard Header */}
            <div className="section-header">
                <div className="section-header-icon">📡</div>
                <div>
                    <h2 className="section-title">Command Dashboard</h2>
                    <p className="section-subtitle">Live emergency monitoring & response</p>
                </div>
            </div>

            {/* Stats Row */}
            <div className="stats-row">
                <div className={`stat-card ${dangerCount > 0 ? 'stat-danger' : 'stat-neutral'}`}>
                    <span className="stat-value">{dangerCount}</span>
                    <span className="stat-label">ACTIVE SOS</span>
                </div>
                <div className={`stat-card ${acceptedCount > 0 ? 'stat-accepted' : 'stat-neutral'}`}>
                    <span className="stat-value">{acceptedCount}</span>
                    <span className="stat-label">ACCEPTED</span>
                </div>
                <div className="stat-card stat-total">
                    <span className="stat-value">{alerts.length}</span>
                    <span className="stat-label">TOTAL</span>
                </div>
            </div>

            {/* Alert Banner */}
            {dangerCount > 0 && (
                <div className="alert-banner">
                    <span className="alert-banner-dot"></span>
                    ⚠️ {dangerCount} ACTIVE EMERGENCY{dangerCount > 1 ? 'S' : ''} REQUIRING RESPONSE
                </div>
            )}
            {dangerCount === 0 && alerts.length === 0 && (
                <div className="safe-banner">
                    ✅ All clear — No active emergencies
                </div>
            )}
            {dangerCount === 0 && acceptedCount > 0 && (
                <div className="safe-banner">
                    🛡️ All emergencies have been accepted
                </div>
            )}

            {/* Map */}
            <div className="map-wrapper">
                <div className="map-label">
                    <span>🗺️</span> Live Location Map
                    {alerts.length > 0 && <span className="map-ping-dot"></span>}
                </div>
                <MapContainer
                    center={defaultCenter}
                    zoom={alerts.length > 0 ? 13 : 5}
                    style={{ height: '380px', width: '100%' }}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                    />
                    {alerts.map((alert) => (
                        <Marker key={alert.id} position={[alert.latitude, alert.longitude]}>
                            <Popup>
                                <div className="map-popup">
                                    <div className={`popup-status-badge ${alert.status === 'DANGER' ? 'popup-danger' : 'popup-accepted'}`}>
                                        {alert.status === 'DANGER' ? '🔴 DANGER ALERT' : '🟢 ACCEPTED'}
                                    </div>
                                    <div className="popup-row"><b>User:</b> {alert.email}</div>
                                    <div className="popup-row"><b>Time:</b> {alert.timestamp}</div>

                                    {alert.audio && (
                                        <div className="popup-audio-box">
                                            <p className="popup-audio-label">🎙️ Emergency Voice Note</p>
                                            <audio controls src={alert.audio} style={{ width: '100%', height: '34px' }} />
                                        </div>
                                    )}

                                    {alert.status === 'DANGER' ? (
                                        <button
                                            id={`accept-alert-${alert.id}`}
                                            onClick={() => handleAcceptEmergency(alert.id)}
                                            className="popup-accept-btn"
                                        >
                                            🛡️ Accept Emergency
                                        </button>
                                    ) : (
                                        <p className="popup-accepted-text">✅ You've accepted this alert</p>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>

            {/* Alert Cards List */}
            {alerts.length > 0 && (
                <div className="alert-cards-section">
                    <h3 className="card-title" style={{ marginBottom: '14px' }}>Alert Log</h3>
                    {alerts.map((alert, i) => (
                        <div
                            key={alert.id}
                            className={`alert-card ${alert.status === 'DANGER' ? 'alert-card-danger' : 'alert-card-accepted'}`}
                            style={{ animationDelay: `${i * 0.05}s` }}
                        >
                            <div className="alert-card-header">
                                <span className={`alert-badge ${alert.status === 'DANGER' ? 'badge-danger' : 'badge-accepted'}`}>
                                    {alert.status === 'DANGER' ? '⚠ DANGER' : '✓ ACCEPTED'}
                                </span>
                                <span className="alert-time">{alert.timestamp}</span>
                            </div>
                            <div className="alert-card-body">
                                <div className="alert-info-row">
                                    <span className="alert-info-label">User</span>
                                    <span className="alert-info-value">{alert.email}</span>
                                </div>
                                <div className="alert-info-row">
                                    <span className="alert-info-label">Location</span>
                                    <span className="alert-info-value mono">
                                        {alert.latitude?.toFixed(5)}°, {alert.longitude?.toFixed(5)}°
                                    </span>
                                </div>
                                {alert.acceptedAt && (
                                    <div className="alert-info-row">
                                        <span className="alert-info-label">Accepted At</span>
                                        <span className="alert-info-value">{alert.acceptedAt}</span>
                                    </div>
                                )}
                            </div>
                            {alert.status === 'DANGER' && (
                                <button
                                    id={`accept-card-alert-${alert.id}`}
                                    onClick={() => handleAcceptEmergency(alert.id)}
                                    className="btn-primary btn-sm"
                                >
                                    🛡️ Accept & Stop Siren
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Dashboard;