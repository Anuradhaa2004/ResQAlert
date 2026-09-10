import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from './firebase';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './Dashboard.css';

// Fix leaflet default icon missing assets
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Futuristic Tactical DivIcon for Active SOS Beacons
const createDangerMarker = () =>
    L.divIcon({
        className: 'rc-marker-beacon',
        html: `
            <div class="rc-beacon-ripple"></div>
            <div class="rc-beacon-core">SOS</div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20],
    });

// Smooth Camera Controller
function MapCameraController({ targetCoords }) {
    const map = useMap();
    useEffect(() => {
        if (targetCoords && targetCoords[0] && targetCoords[1]) {
            map.flyTo(targetCoords, 15, {
                animate: true,
                duration: 1.2,
            });
        }
    }, [targetCoords, map]);
    return null;
}

// Auto-Fit Bounds Controller
function MapBoundsController({ alerts, trigger }) {
    const map = useMap();
    useEffect(() => {
        if (alerts.length > 0) {
            const validAlerts = alerts.filter(a => a.latitude && a.longitude);
            if (validAlerts.length === 1) {
                map.flyTo([validAlerts[0].latitude, validAlerts[0].longitude], 14, { animate: true });
            } else if (validAlerts.length > 1) {
                const bounds = L.latLngBounds(validAlerts.map(a => [a.latitude, a.longitude]));
                map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
            }
        }
    }, [trigger, alerts, map]);
    return null;
}

function Dashboard() {
    const [alerts, setAlerts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, DANGER, ACCEPTED
    const [selectedAlertId, setSelectedAlertId] = useState(null);
    const [targetCoords, setTargetCoords] = useState(null);
    const [fitTrigger, setFitTrigger] = useState(0);
    const [mapLayer, setMapLayer] = useState('street'); // satellite, street
    const [isMuted, setIsMuted] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

    const sirenIntervalRef = useRef(null);
    const isMutedRef = useRef(isMuted);

    // Live clock ticker
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const stopContinuousSiren = useCallback(() => {
        if (sirenIntervalRef.current) {
            clearInterval(sirenIntervalRef.current);
            sirenIntervalRef.current = null;
        }
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }, []);

    const startContinuousSiren = useCallback(() => {
        if (sirenIntervalRef.current || isMutedRef.current) return;

        const playSoundLoop = () => {
            if (isMutedRef.current) {
                stopContinuousSiren();
                return;
            }

            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const speechText = "Emergency Alert! SOS distress beacon active. Please accept emergency response.";
                const utterance = new SpeechSynthesisUtterance(speechText);
                utterance.rate = 1.05;
                utterance.pitch = 1.1;
                utterance.volume = 0.9;
                window.speechSynthesis.speak(utterance);
            }

            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(820, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(420, audioCtx.currentTime + 0.5);
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
        sirenIntervalRef.current = setInterval(playSoundLoop, 4200);
    }, [stopContinuousSiren]);

    // Keep ref synchronized with state for interval closures
    useEffect(() => {
        isMutedRef.current = isMuted;
        if (isMuted) {
            stopContinuousSiren();
        } else {
            const hasDanger = alerts.some(a => a.status === 'DANGER');
            if (hasDanger && !sirenIntervalRef.current) {
                startContinuousSiren();
            }
        }
    }, [isMuted, alerts, startContinuousSiren, stopContinuousSiren]);

    // Test drill audio sound
    const handleTestSiren = () => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        } catch (err) {
            console.log("Audio test error:", err);
        }
    };

    // Firebase Listener
    useEffect(() => {
        const alertsRef = ref(database, 'active_alerts');

        const unsubscribe = onValue(alertsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const activeList = Object.keys(data)
                    .map((key) => ({ id: key, ...data[key] }))
                    .filter((item) => item.status === 'DANGER' || item.status === 'ACCEPTED')
                    .sort((a, b) => (b.id || 0) - (a.id || 0));

                setAlerts(activeList);

                const hasDanger = activeList.some((item) => item.status === 'DANGER');
                if (hasDanger && !isMutedRef.current) {
                    startContinuousSiren();
                } else if (!hasDanger) {
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
    }, [startContinuousSiren, stopContinuousSiren]);

    // Accept Emergency Handler
    const handleAcceptEmergency = (alertId) => {
        update(ref(database, 'active_alerts/' + alertId), {
            status: 'ACCEPTED',
            acceptedAt: new Date().toLocaleString()
        });

        // Check remaining danger alerts
        const remainingDangers = alerts.filter(a => a.id !== alertId && a.status === 'DANGER');
        if (remainingDangers.length === 0) {
            stopContinuousSiren();
        }
    };

    // Resolve Emergency Handler (Archives/clears accepted alerts when safe)
    const handleResolveEmergency = (alertId) => {
        update(ref(database, 'active_alerts/' + alertId), {
            status: 'RESOLVED',
            resolvedAt: new Date().toLocaleString()
        });
    };

    // Focus on an alert on the map
    const handleFocusAlert = (alert) => {
        setSelectedAlertId(alert.id);
        if (alert.latitude && alert.longitude) {
            setTargetCoords([alert.latitude, alert.longitude]);
        }
    };

    // Copy Coordinates
    const handleCopyCoords = (alert) => {
        const coordsText = `${alert.latitude?.toFixed(6)}, ${alert.longitude?.toFixed(6)}`;
        navigator.clipboard.writeText(coordsText).then(() => {
            setCopiedId(alert.id);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    // Calculations & Filtering
    const dangerCount = alerts.filter(a => a.status === 'DANGER').length;
    const acceptedCount = alerts.filter(a => a.status === 'ACCEPTED').length;
    const isSirenActive = dangerCount > 0 && !isMuted;

    // Only ACTIVE DANGER SOS alerts should appear on the Tactical Map
    const activeDangerAlerts = useMemo(() => {
        return alerts.filter(a => a.status === 'DANGER' && a.latitude && a.longitude);
    }, [alerts]);

    const filteredAlerts = useMemo(() => {
        return alerts.filter(alert => {
            // Status filter
            if (statusFilter === 'DANGER' && alert.status !== 'DANGER') return false;
            if (statusFilter === 'ACCEPTED' && alert.status !== 'ACCEPTED') return false;

            // Search filter
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const emailMatch = alert.email?.toLowerCase().includes(query);
                const idMatch = String(alert.id).includes(query);
                const coordMatch = `${alert.latitude},${alert.longitude}`.includes(query);
                return emailMatch || idMatch || coordMatch;
            }
            return true;
        });
    }, [alerts, statusFilter, searchQuery]);

    const defaultCenter = alerts.length > 0 && alerts[0].latitude && alerts[0].longitude
        ? [alerts[0].latitude, alerts[0].longitude]
        : [20.5937, 78.9629];

    // Map Tile URLs
    const tileConfig = {
        satellite: {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attribution: 'Tiles &copy; Esri'
        },
        street: {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '&copy; OpenStreetMap contributors'
        }
    };

    return (
        <div className="rc-dashboard">
            {/* 1. TOP OPERATIONAL HUD & BAR */}
            <header className="rc-hud-bar">
                <div className="rc-hud-left">
                    <div className="rc-hud-icon-box">
                        <div className="rc-hud-icon-pulse"></div>
                        <span>🛰️</span>
                    </div>
                    <div className="rc-hud-title-group">
                        <div className="rc-hud-title-row">
                            <h1 className="rc-hud-title">Incident Operations Control</h1>
                            <span className={`rc-hud-status-badge ${dangerCount > 0 ? 'danger' : 'safe'}`}>
                                <span className="rc-hud-beacon-dot"></span>
                                {dangerCount > 0 ? `${dangerCount} CRITICAL ALERT${dangerCount > 1 ? 'S' : ''}` : 'SYSTEM NOMINAL'}
                            </span>
                        </div>
                        <p className="rc-hud-subtitle">
                            SECURE DEFENSE LINK • REALTIME BEACON TELEMETRY
                        </p>
                    </div>
                </div>

                <div className="rc-hud-right">
                    {/* Live Digital Clock */}
                    <div className="rc-clock-pill">
                        <span>🕒</span>
                        <span className="rc-clock-time">{currentTime}</span>
                        <span className="rc-clock-live-tag">LIVE</span>
                    </div>

                    {/* Sound and Siren Controls */}
                    <div className="rc-siren-ctrl-group">
                        <button
                            id="dashboard-mute-toggle-btn"
                            className={`rc-ctrl-btn ${isSirenActive ? 'active-siren' : isMuted ? 'muted' : ''}`}
                            onClick={() => setIsMuted(!isMuted)}
                            title={isMuted ? 'Unmute Audio Siren' : 'Mute Emergency Audio Siren'}
                        >
                            {isMuted ? '🔇 Audio Muted' : isSirenActive ? '🚨 Siren Blaring' : '🔊 Siren Armed'}
                        </button>

                        <button
                            id="dashboard-test-audio-btn"
                            className="rc-ctrl-btn"
                            onClick={handleTestSiren}
                            title="Test Audio Hardware"
                        >
                            🔔 Test
                        </button>
                    </div>
                </div>
            </header>

            {/* 2. KPI METRICS CARDS ROW */}
            <section className="rc-kpi-grid">
                <div className={`rc-kpi-card danger ${dangerCount > 0 ? 'blinking' : ''}`}>
                    <div className="rc-kpi-top">
                        <span className="rc-kpi-label">Distress SOS</span>
                        <div className="rc-kpi-icon">🚨</div>
                    </div>
                    <div className="rc-kpi-value-row">
                        <span className="rc-kpi-value">{dangerCount}</span>
                    </div>
                    <div className="rc-kpi-footer-text">
                        {dangerCount > 0 ? '⚠️ Immediate response required' : '✓ Zero active distress signals'}
                    </div>
                </div>

                <div className="rc-kpi-card accepted">
                    <div className="rc-kpi-top">
                        <span className="rc-kpi-label">Dispatched / Accepted</span>
                        <div className="rc-kpi-icon">🛡️</div>
                    </div>
                    <div className="rc-kpi-value-row">
                        <span className="rc-kpi-value">{acceptedCount}</span>
                    </div>
                    <div className="rc-kpi-footer-text">
                        Guardians en-route / in contact
                    </div>
                </div>

                <div className="rc-kpi-card total">
                    <div className="rc-kpi-top">
                        <span className="rc-kpi-label">Total Signals Tracked</span>
                        <div className="rc-kpi-icon">📡</div>
                    </div>
                    <div className="rc-kpi-value-row">
                        <span className="rc-kpi-value">{alerts.length}</span>
                    </div>
                    <div className="rc-kpi-footer-text">
                        Active incidents in real-time registry
                    </div>
                </div>

                <div className="rc-kpi-card readiness">
                    <div className="rc-kpi-top">
                        <span className="rc-kpi-label">Network Status</span>
                        <div className="rc-kpi-icon">⚡</div>
                    </div>
                    <div className="rc-kpi-value-row">
                        <span className="rc-kpi-value">99.9%</span>
                    </div>
                    <div className="rc-kpi-footer-text">
                        🛰️ GPS Lock & RTDB Synced
                    </div>
                </div>
            </section>

            {/* 3. CRITICAL SOS ALERT BANNER (WHEN DANGER > 0) */}
            {dangerCount > 0 && (
                <div className="rc-active-alert-banner">
                    <div className="rc-banner-content">
                        <span className="rc-banner-beacon"></span>
                        <div>
                            <h2 className="rc-banner-headline">
                                CRITICAL DISTRESS SIGNAL ACTIVE ({dangerCount})
                            </h2>
                            <p className="rc-banner-sub">
                                High-priority SOS beacon triggered. Immediate guardian intervention and dispatched response required.
                            </p>
                        </div>
                    </div>
                    {alerts.filter(a => a.status === 'DANGER')[0] && (
                        <button
                            id="banner-quick-accept-btn"
                            className="rc-banner-action-btn"
                            onClick={() => handleAcceptEmergency(alerts.filter(a => a.status === 'DANGER')[0].id)}
                        >
                            🛡️ Quick Accept First SOS
                        </button>
                    )}
                </div>
            )}

            {/* 4. TACTICAL WORKSPACE: SPLIT SCREEN GRID */}
            <div className="rc-workspace">

                {/* LEFT: GEOSPATIAL RADAR MAP PANEL */}
                <section className="rc-map-panel">
                    <div className="rc-panel-header">
                        <div className="rc-panel-title-area">
                            <h2 className="rc-panel-title">
                                <span>🗺️</span> Tactical Geo-Tracking
                            </h2>
                            <span className="rc-panel-counter">
                                {dangerCount > 0 ? `${dangerCount} ACTIVE SOS` : 'RADAR STANDBY'}
                            </span>
                        </div>

                        <div className="rc-map-controls">
                            <select
                                id="map-layer-selector"
                                className="rc-map-layer-select"
                                value={mapLayer}
                                onChange={(e) => setMapLayer(e.target.value)}
                                aria-label="Map Tile Style Selector"
                            >
                                <option value="street">Normal Map</option>
                                <option value="satellite">Satellite HD</option>
                            </select>

                            <button
                                id="map-recenter-btn"
                                className="rc-map-btn"
                                onClick={() => setFitTrigger(prev => prev + 1)}
                                title="Recenter and frame all active units"
                            >
                                🎯 Fit Units
                            </button>
                        </div>
                    </div>

                    <div className="rc-map-canvas-container">
                        <MapContainer
                            center={activeDangerAlerts.length > 0 ? [activeDangerAlerts[0].latitude, activeDangerAlerts[0].longitude] : defaultCenter}
                            zoom={activeDangerAlerts.length > 0 ? 13 : 5}
                            style={{ height: '100%', width: '100%' }}
                            scrollWheelZoom={true}
                        >
                            <TileLayer
                                url={tileConfig[mapLayer].url}
                                attribution={tileConfig[mapLayer].attribution}
                            />

                            <MapCameraController targetCoords={targetCoords} />
                            <MapBoundsController alerts={activeDangerAlerts} trigger={fitTrigger} />

                            {activeDangerAlerts.map((alert) => (
                                <Marker
                                    key={alert.id}
                                    position={[alert.latitude, alert.longitude]}
                                    icon={createDangerMarker()}
                                >
                                    <Popup>
                                        <div className="rc-popup-container">
                                            <div className="rc-popup-header">
                                                <span className="rc-popup-badge danger">
                                                    🚨 SOS DANGER
                                                </span>
                                                <span className="rc-popup-time">{alert.timestamp}</span>
                                            </div>

                                            <div className="rc-popup-meta">
                                                <div className="rc-popup-row">
                                                    <span>Victim:</span>
                                                    <span className="rc-popup-val">{alert.email}</span>
                                                </div>
                                                <div className="rc-popup-row">
                                                    <span>GPS:</span>
                                                    <span className="rc-popup-val mono">
                                                        {alert.latitude.toFixed(5)}°, {alert.longitude.toFixed(5)}°
                                                    </span>
                                                </div>
                                            </div>

                                            {alert.audio && (
                                                <div className="rc-popup-audio">
                                                    <p className="rc-popup-audio-label">
                                                        <span>🎙️</span> Emergency Voice Transmission
                                                    </p>
                                                    <audio
                                                        controls
                                                        src={alert.audio}
                                                        style={{ width: '100%', height: '32px' }}
                                                    />
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                                <a
                                                    href={`https://www.google.com/maps/dir/?api=1&destination=${alert.latitude},${alert.longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="rc-btn-nav"
                                                    style={{ flex: 1, justifyContent: 'center', padding: '8px' }}
                                                >
                                                    🧭 Google Maps
                                                </a>
                                                <button
                                                    id={`popup-accept-btn-${alert.id}`}
                                                    className="rc-popup-btn accept"
                                                    style={{ flex: 1 }}
                                                    onClick={() => handleAcceptEmergency(alert.id)}
                                                >
                                                    🛡️ Accept
                                                </button>
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>

                        {/* Tactical HUD Overlay at bottom of map */}
                        <div className="rc-map-hud-overlay">
                            <div className="rc-hud-item">
                                <span className={`rc-hud-dot-green ${dangerCount > 0 ? 'pulse-red' : ''}`}></span>
                                <span>{dangerCount > 0 ? `${dangerCount} ACTIVE THREATS` : 'RADAR ACTIVE • ZERO ACTIVE DISTRESS'}</span>
                            </div>
                            <div className="rc-hud-item">
                                <span>LAYER: {mapLayer.toUpperCase()}</span>
                            </div>
                            {selectedAlertId && (
                                <div className="rc-hud-item" style={{ color: 'var(--rc-cyan)' }}>
                                    <span>LOCKED ON #{selectedAlertId}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* RIGHT: LIVE INCIDENTS FEED PANEL */}
                <section className="rc-feed-panel">
                    <div className="rc-feed-controls">
                        {/* Search Box */}
                        <div className="rc-feed-search-box">
                            <span className="rc-feed-search-icon">🔍</span>
                            <input
                                id="feed-search-input"
                                type="text"
                                className="rc-feed-search-input"
                                placeholder="Filter alerts by email, ID or coordinates..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    className="rc-feed-search-clear"
                                    onClick={() => setSearchQuery('')}
                                    title="Clear search"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Filter Tabs */}
                        <div className="rc-filter-tabs">
                            <button
                                id="filter-tab-all"
                                className={`rc-filter-tab ${statusFilter === 'ALL' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('ALL')}
                            >
                                All <span className="rc-tab-badge">{alerts.length}</span>
                            </button>
                            <button
                                id="filter-tab-danger"
                                className={`rc-filter-tab ${statusFilter === 'DANGER' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('DANGER')}
                            >
                                Active SOS <span className="rc-tab-badge danger">{dangerCount}</span>
                            </button>
                            <button
                                id="filter-tab-accepted"
                                className={`rc-filter-tab ${statusFilter === 'ACCEPTED' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('ACCEPTED')}
                            >
                                Dispatched <span className="rc-tab-badge">{acceptedCount}</span>
                            </button>
                        </div>
                    </div>

                    {/* Cards Scrollable Stream */}
                    <div className="rc-cards-list">
                        {filteredAlerts.length === 0 ? (
                            <div className="rc-zero-state">
                                <div className="rc-zero-radar-box">
                                    <div className="rc-zero-radar-ring"></div>
                                    <span>🛡️</span>
                                </div>
                                <h3 className="rc-zero-title">All Sectors Clear</h3>
                                <p className="rc-zero-subtitle">
                                    {alerts.length === 0
                                        ? 'No active emergencies detected. Guardian telemetry standing by in secure standby mode.'
                                        : 'No alerts match your current filter criteria.'}
                                </p>
                            </div>
                        ) : (
                            filteredAlerts.map((alert) => {
                                const isDanger = alert.status === 'DANGER';
                                const isSelected = selectedAlertId === alert.id;
                                const userInitial = alert.email ? alert.email.charAt(0).toUpperCase() : 'U';

                                return (
                                    <article
                                        key={alert.id}
                                        className={`rc-incident-card ${isDanger ? 'danger' : 'accepted'} ${isSelected ? 'selected' : ''}`}
                                        onClick={() => handleFocusAlert(alert)}
                                    >
                                        <div className="rc-card-top-row">
                                            <div className="rc-card-user-info">
                                                <div className="rc-card-avatar">
                                                    {userInitial}
                                                </div>
                                                <div className="rc-card-user-details">
                                                    <span className="rc-card-email">{alert.email || 'Anonymous Unit'}</span>
                                                    <span className="rc-card-time">{alert.timestamp}</span>
                                                </div>
                                            </div>

                                            <span className={`rc-card-badge ${isDanger ? 'danger' : 'accepted'}`}>
                                                {isDanger ? '🚨 SOS ACTIVE' : '✓ ACCEPTED'}
                                            </span>
                                        </div>

                                        {/* Coordinates & Location Box */}
                                        <div className="rc-card-location-box">
                                            <div className="rc-card-coord">
                                                <span>📍</span>
                                                <span>
                                                    {alert.latitude?.toFixed(5)}°, {alert.longitude?.toFixed(5)}°
                                                </span>
                                            </div>

                                            <div className="rc-coord-actions">
                                                <button
                                                    className="rc-coord-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopyCoords(alert);
                                                    }}
                                                    title="Copy GPS coordinates"
                                                >
                                                    {copiedId === alert.id ? '✓ Copied' : '📋 Copy'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Voice Note Audio Recording Player */}
                                        {alert.audio && (
                                            <div className="rc-card-audio-box" onClick={(e) => e.stopPropagation()}>
                                                <div className="rc-card-audio-header">
                                                    <span className="rc-audio-title">
                                                        <span>🎙️</span> Emergency Voice Transmission (7s)
                                                    </span>
                                                    <div className="rc-audio-wave-bars">
                                                        <span className="rc-wave-bar"></span>
                                                        <span className="rc-wave-bar"></span>
                                                        <span className="rc-wave-bar"></span>
                                                        <span className="rc-wave-bar"></span>
                                                    </div>
                                                </div>
                                                <audio
                                                    controls
                                                    src={alert.audio}
                                                    className="rc-audio-player-element"
                                                />
                                            </div>
                                        )}

                                        {/* Timeline info if accepted */}
                                        {alert.acceptedAt && (
                                            <div className="rc-card-timeline">
                                                <span className="rc-timeline-dot"></span>
                                                <span>Dispatched & Accepted at {alert.acceptedAt}</span>
                                            </div>
                                        )}

                                        {/* Card Action Buttons */}
                                        <div className="rc-card-actions" onClick={(e) => e.stopPropagation()}>
                                            {isDanger ? (
                                                <button
                                                    id={`btn-accept-alert-${alert.id}`}
                                                    className="rc-btn-accept"
                                                    onClick={() => handleAcceptEmergency(alert.id)}
                                                >
                                                    🛡️ Accept Emergency & Mute Siren
                                                </button>
                                            ) : (
                                                <button
                                                    id={`btn-resolve-alert-${alert.id}`}
                                                    className="rc-btn-accept"
                                                    style={{
                                                        background: 'rgba(16, 185, 129, 0.15)',
                                                        border: '1px solid rgba(16, 185, 129, 0.4)',
                                                        color: '#34d399'
                                                    }}
                                                    onClick={() => handleResolveEmergency(alert.id)}
                                                    title="Mark incident as resolved and clear from active feed"
                                                >
                                                    ✓ Case Resolved (Clear)
                                                </button>
                                            )}

                                            <button
                                                className="rc-btn-focus"
                                                onClick={() => handleFocusAlert(alert)}
                                                title="Focus this incident on the map"
                                            >
                                                📍 Focus
                                            </button>

                                            <a
                                                href={`https://www.google.com/maps/dir/?api=1&destination=${alert.latitude},${alert.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="rc-btn-nav"
                                                title="Open directions in Google Maps"
                                            >
                                                🧭 Maps
                                            </a>

                                            {alert.email && (
                                                <a
                                                    href={`mailto:${alert.email}?subject=Emergency Response: ResQAlert Dispatched`}
                                                    className="rc-btn-focus"
                                                    title="Email Victim"
                                                >
                                                    ✉️ Contact
                                                </a>
                                            )}
                                        </div>
                                    </article>
                                );
                            })
                        )}
                    </div>
                </section>

            </div>
        </div>
    );
}

export default Dashboard;