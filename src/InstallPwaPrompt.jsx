import React, { useState, useEffect } from 'react';
import './InstallPwaPrompt.css';

/**
 * InstallPwaPrompt Component
 * Captures browser's beforeinstallprompt event.
 * Displays a sleek, native-feel install banner on mobile and desktop
 * allowing one-tap installation directly onto the user's home screen.
 */
export default function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already running as installed standalone PWA
    const checkStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (checkStandalone) {
      setIsStandalone(true);
      return;
    }

    // Check if user previously dismissed prompt in this session
    const dismissed = sessionStorage.getItem('pwa_prompt_dismissed');
    if (dismissed) return;

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setIsVisible(false);
      setDeferredPrompt(null);
      console.log('🎉 ResQAlert PWA successfully installed!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
    }
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (isStandalone || !isVisible) {
    return null;
  }

  return (
    <div className="pwa-install-banner" role="banner" aria-label="Install App">
      <div className="pwa-install-content">
        <div className="pwa-install-icon-wrapper">
          <img src="/Logo.png" alt="ResQAlert" className="pwa-install-logo" />
        </div>
        <div className="pwa-install-text">
          <strong className="pwa-install-title">Install ResQAlert App</strong>
          <span className="pwa-install-subtitle">1-tap SOS right from your home screen</span>
        </div>
      </div>

      <div className="pwa-install-actions">
        <button
          id="btn-pwa-install"
          className="pwa-btn-install"
          onClick={handleInstallClick}
          type="button"
        >
          📲 Install
        </button>
        <button
          className="pwa-btn-dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          type="button"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
