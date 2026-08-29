import { useState } from 'react';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import './Auth.css';

function Auth({ setIsLoggedIn }) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);

        if (isLogin) {
            signInWithEmailAndPassword(auth, email, password)
                .then(() => setIsLoggedIn(true))
                .catch((error) => {
                    alert("Login Failed: " + error.message);
                    setLoading(false);
                });
        } else {
            createUserWithEmailAndPassword(auth, email, password)
                .then(() => {
                    alert("Account created! Please sign in.");
                    setIsLogin(true);
                    setPassword('');
                    setLoading(false);
                })
                .catch((error) => {
                    alert("Signup Failed: " + error.message);
                    setLoading(false);
                });
        }
    };

    const switchTab = (loginMode) => {
        setIsLogin(loginMode);
        setEmail('');
        setPassword('');
        setLoading(false);
    };

    return (
        <div className="auth-page">
            <div className="auth-container-inner">
                {/* Header above card */}
                <div className="auth-header-top">
                    <div className="auth-brand-badge">
                        <span className="auth-brand-dot"></span>
                        ResQAlert Safety
                    </div>
                    <h1 className="auth-main-title">
                        {isLogin ? 'Welcome back' : 'Join ResQAlert'}
                    </h1>
                </div>

                {/* Main Card */}
                <div className="auth-card">
                    {/* Tab Switcher - Pill style */}
                    <div className="auth-tabs" role="tablist">
                        <button
                            id="tab-login"
                            type="button"
                            role="tab"
                            aria-selected={isLogin}
                            className={`auth-tab ${isLogin ? 'active' : ''}`}
                            onClick={() => switchTab(true)}
                        >
                            <svg className="auth-tab-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            Sign In
                        </button>
                        <button
                            id="tab-signup"
                            type="button"
                            role="tab"
                            aria-selected={!isLogin}
                            className={`auth-tab ${!isLogin ? 'active' : ''}`}
                            onClick={() => switchTab(false)}
                        >
                            <svg className="auth-tab-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="8" x2="20" y2="14"></line>
                                <line x1="23" y1="11" x2="17" y2="11"></line>
                            </svg>
                            Sign Up
                        </button>
                    </div>

                    {/* Form */}
                    <form className="auth-form" onSubmit={handleSubmit} noValidate>
                        <div className="auth-field">
                            <label htmlFor="auth-email">EMAIL ADDRESS</label>
                            <div className="auth-input-wrapper">
                                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <polyline points="22,6 12,13 2,6"></polyline>
                                </svg>
                                <input
                                    id="auth-email"
                                    type="email"
                                    className="auth-input"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        </div>

                        <div className="auth-field">
                            <label htmlFor="auth-password">
                                {isLogin ? 'PASSWORD' : 'CHOOSE PASSWORD'}
                            </label>
                            <div className="auth-input-wrapper">
                                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                                <input
                                    id="auth-password"
                                    type="password"
                                    className="auth-input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            id="auth-submit-btn"
                            type="submit"
                            className="auth-cta"
                            disabled={loading}
                        >
                            {loading
                                ? 'Please wait...'
                                : isLogin
                                    ? 'Sign In →'
                                    : 'Create Account →'}
                        </button>
                    </form>
                </div>

                {/* Bottom Switch Link */}
                <p className="auth-switch">
                    {isLogin ? "Don't have an account? " : 'Already have an account? '}
                    <button
                        id="auth-switch-btn"
                        type="button"
                        onClick={() => switchTab(!isLogin)}
                    >
                        {isLogin ? 'Sign Up' : 'Log In'}
                    </button>
                </p>

                <p className="auth-footer-note">
                    🔒 Secured by Firebase · End-to-end encrypted
                </p>
            </div>
        </div>
    );
}

export default Auth;