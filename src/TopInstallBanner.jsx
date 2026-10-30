import React, { useState, useEffect } from 'react';
import './TopInstallBanner.css';
import appLogo from './assets/Logo.png';

const DISMISS_KEY = 'resq_install_banner_dismissed';

/**
 * TopInstallBanner Component
 * 
 * Top navbar-style banner for PWA installation matching the ResQAlert dark theme.
 * Appears at the very top of the viewport above the main header/navbar.
 * Captures beforeinstallprompt and triggers the native install experience.
 */
export default function TopInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // 1. Condition (a): Verify the app is NOT already running in standalone/installed mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      return;
    }

    // 2. Condition (b): Verify the user has NOT previously dismissed the banner in current session
    const isDismissed =
      sessionStorage.getItem(DISMISS_KEY) === 'true' ||
      localStorage.getItem(DISMISS_KEY) === 'true';

    // Optional query param (?preview-banner=true) to preview UI anytime during development
    const isPreview = new URLSearchParams(window.location.search).has('preview-banner');

    if (isDismissed && !isPreview) {
      return;
    }

    if (isPreview) {
      setIsVisible(true);
    }

    // Check if event was captured early before component mounted
    if (window.deferredPwaPrompt) {
      setDeferredPrompt(window.deferredPwaPrompt);
      setIsVisible(true);
    }

    // 3. Capture beforeinstallprompt event and hold deferredPrompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      window.deferredPwaPrompt = e;
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    // 4. Hide banner if installed successfully
    const handleAppInstalled = () => {
      setIsVisible(false);
      setDeferredPrompt(null);
      window.deferredPwaPrompt = null;
      console.log('🎉 ResQAlert installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Graceful fallback guidance for iOS Safari or browsers without beforeinstallprompt
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) {
        alert(
          "To install ResQAlert on iOS:\n1. Tap the Share icon (square with arrow)\n2. Select 'Add to Home Screen'"
        );
      } else {
        alert(
          "To install ResQAlert:\nOpen your browser settings menu (⋮) and select 'Install App' or 'Add to Home screen'."
        );
      }
      return;
    }

    try {
      // Trigger native browser install prompt
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        console.log('✅ User accepted PWA installation');
      }
    } catch (err) {
      console.error('Error triggering PWA install prompt:', err);
    } finally {
      setDeferredPrompt(null);
      window.deferredPwaPrompt = null;
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setIsClosing(true);
    // Smooth exit animation before unmounting
    setTimeout(() => {
      setIsVisible(false);
      sessionStorage.setItem(DISMISS_KEY, 'true');
    }, 240);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <aside
      className={`top-install-banner ${isClosing ? 'closing' : ''}`}
      role="banner"
      aria-label="Install ResQAlert Application"
    >
      <div className="top-install-container">
        {/* Left: ResQAlert logo icon + promotional copy */}
        <div className="top-install-left">
          <div className="top-install-logo-wrap">
            <img src={appLogo || '/Logo.png'} alt="ResQAlert Logo" className="top-install-logo" />
          </div>
          <div className="top-install-text-group">
            <span className="top-install-title">
              Get <span className="top-install-brand-name">ResQAlert</span> for a better experience
            </span>
            <span className="top-install-subtitle">
              Instant 1-tap SOS • Faster response • Offline ready
            </span>
          </div>
        </div>

        {/* Right: Primary 'Get App' button + '✕' dismiss button */}
        <div className="top-install-right">
          <button
            id="btn-top-install"
            className="top-install-cta-btn"
            onClick={handleInstallClick}
            type="button"
            aria-label="Install ResQAlert App"
          >
            <svg
              className="top-install-btn-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Get App</span>
          </button>
          <button
            id="btn-top-install-dismiss"
            className="top-install-dismiss-btn"
            onClick={handleDismiss}
            aria-label="Dismiss install banner"
            type="button"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Sleek bottom neon accent line matching ResQAlert theme */}
      <div className="top-install-glow-bar" />
    </aside>
  );
}
