import { useState } from 'react';
import { auth } from './firebase'; // Firebase setup import kiya
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'; // Firebase login/signup functions
import './Auth.css';

function Auth({ setIsLoggedIn }) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();

        if (isLogin) {
            // ===== LOGIN KA LOGIC =====
            signInWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    console.log("Logged In Successfully!", userCredential.user);
                    setIsLoggedIn(true); // Login hote hi SOS screen dikhao
                })
                .catch((error) => {
                    alert("Login Failed: " + error.message);
                });

        } else {
            // ===== SIGNUP (Naya Account) KA LOGIC =====
            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    console.log("Account Created!", userCredential.user);
                    alert("Account created successfully! Please login now.");
                    setIsLogin(true); // Account banne ke baad login screen par wapas bhej do
                    setPassword(''); // Password box khali kar do
                })
                .catch((error) => {
                    alert("Signup Failed: " + error.message);
                });
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h2>{isLogin ? 'Login to ResQAlert' : 'Create an Account'}</h2>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <input
                        type="email"
                        placeholder="Enter your Email"
                        required
                        className="auth-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Enter your Password"
                        required
                        className="auth-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button type="submit" className="auth-submit-btn">
                        {isLogin ? 'Login' : 'Sign Up'}
                    </button>
                </form>

                <p className="toggle-text" onClick={() => setIsLogin(!isLogin)}>
                    {isLogin
                        ? "Don't have an account? Click here to Sign Up"
                        : "Already have an account? Click here to Login"}
                </p>
            </div>
        </div>
    );
}

export default Auth;