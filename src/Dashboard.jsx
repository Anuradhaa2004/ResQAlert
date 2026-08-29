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

    // Function to continuously play siren & speech until stopped/accepted
    const startContinuousSiren = () => {
        if (sirenIntervalRef.current) return; // Already playing

        const playSoundLoop = () => {
            // 1. Text-to-Speech
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const speechText = "Emergency Alert! SOS button press hua hai. Please accept the emergency immediately.";
                const utterance = new SpeechSynthesisUtterance(speechText);
                utterance.rate = 1.0;
                utterance.pitch = 1.1;
                utterance.volume = 1.0;
                window.speechSynthesis.speak(utterance);
            }

            // 2. Web Audio Siren Beep
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
        // Repeat every 4 seconds until cleared
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

                // Check if there is any active DANGER that needs siren
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

    // Handle Accept Button Click by Guardian/Admin
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

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '20px', textAlign: 'center' }}>
                <h2>🚨 Guardian & Admin Emergency Dashboard</h2>
                <p style={{ color: alerts.some(a => a.status === 'DANGER') ? '#ff4757' : '#2ed573', fontWeight: 'bold' }}>
                    {alerts.some(a => a.status === 'DANGER')
                        ? `⚠️ ACTIVE EMERGENCIES REQUIRING ATTENTION!`
                        : '✅ All Emergencies Handled or Safe.'}
                </p>
            </header>

            <div style={{ height: '450px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '3px solid #ff4757' }}>
                <MapContainer center={defaultCenter} zoom={alerts.length > 0 ? 13 : 5} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                    />
                    {alerts.map((alert) => (
                        <Marker key={alert.id} position={[alert.latitude, alert.longitude]}>
                            <Popup>
                                <div style={{ minWidth: '240px' }}>
                                    <strong style={{ color: alert.status === 'DANGER' ? 'red' : 'green' }}>
                                        {alert.status === 'DANGER' ? '⚠️ DANGER ALERT' : '✅ ACCEPTED BY GUARDIAN'}
                                    </strong><br />
                                    <b>User:</b> {alert.email}<br />
                                    <b>Time:</b> {alert.timestamp}<br /><br />

                                    {/* Audio Player */}
                                    {alert.audio ? (
                                        <div style={{ backgroundColor: '#fff0f0', padding: '8px', borderRadius: '6px', border: '1px solid #ff4757', marginBottom: '10px' }}>
                                            <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem', fontWeight: 'bold', color: '#d63031' }}>
                                                🎙️ Voice Note:
                                            </p>
                                            <audio controls src={alert.audio} style={{ width: '100%', height: '35px' }} />
                                        </div>
                                    ) : null}

                                    {/* Accept Button */}
                                    {alert.status === 'DANGER' ? (
                                        <button
                                            onClick={() => handleAcceptEmergency(alert.id)}
                                            style={{
                                                width: '100%',
                                                backgroundColor: '#2ed573',
                                                color: 'white',
                                                border: 'none',
                                                padding: '10px',
                                                borderRadius: '6px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                fontSize: '0.95rem'
                                            }}
                                        >
                                            🛡️ Accept Emergency (Stop Siren)
                                        </button>
                                    ) : (
                                        <p style={{ color: '#2ed573', fontWeight: 'bold', textAlign: 'center', margin: '5px 0' }}>
                                            You have accepted this alert!
                                        </p>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
}

export default Dashboard;