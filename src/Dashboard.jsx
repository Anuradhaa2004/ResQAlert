import { useEffect, useState, useRef } from 'react'; // <-- useRef YAHAN IMPORT HO GAYA HAI
import { ref, onValue } from 'firebase/database';
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

const SIREN_URL = "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg";

function Dashboard() {
    const [alerts, setAlerts] = useState([]);
    const audioRef = useRef(null);

    useEffect(() => {
        audioRef.current = new Audio(SIREN_URL);
        audioRef.current.loop = true;

        const alertsRef = ref(database, 'active_alerts');

        const unsubscribe = onValue(alertsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const activeList = Object.keys(data)
                    .map((key) => ({ id: key, ...data[key] }))
                    .filter((item) => item.status === 'DANGER');

                setAlerts(activeList);

                if (activeList.length > 0) {
                    audioRef.current?.play().catch((err) => {
                        console.log("Autoplay blocked, click on screen once:", err);
                    });
                } else {
                    audioRef.current?.pause();
                    if (audioRef.current) audioRef.current.currentTime = 0;
                }
            } else {
                setAlerts([]);
                audioRef.current?.pause();
                if (audioRef.current) audioRef.current.currentTime = 0;
            }
        });

        return () => {
            unsubscribe();
            if (audioRef.current) audioRef.current.pause();
        };
    }, []);

    const defaultCenter = alerts.length > 0
        ? [alerts[0].latitude, alerts[0].longitude]
        : [20.5937, 78.9629];

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '20px', textAlign: 'center' }}>
                <h2>🚨 Live Emergency Dashboard</h2>
                <p style={{ color: alerts.length > 0 ? '#ff4757' : '#2ed573', fontWeight: 'bold' }}>
                    {alerts.length > 0
                        ? `⚠️ ACTIVE EMERGENCIES: ${alerts.length}`
                        : '✅ All Safe! Monitoring Active.'}
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
                                <div>
                                    <strong style={{ color: 'red' }}>⚠️ DANGER ALERT</strong><br />
                                    <b>Email:</b> {alert.email}<br />
                                    <b>Time:</b> {alert.timestamp}
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