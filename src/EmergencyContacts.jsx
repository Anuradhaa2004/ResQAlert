import { useState, useEffect } from 'react';
import { auth, database } from './firebase';
import { ref, set, onValue, push, remove } from 'firebase/database';

function EmergencyContacts() {
    const [contacts, setContacts] = useState([]);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [msg, setMsg] = useState('');

    const user = auth.currentUser;

    // Firebase se contacts real-time load karna
    useEffect(() => {
        if (!user) return;
        const contactsRef = ref(database, `users/${user.uid}/contacts`);
        const unsubscribe = onValue(contactsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const list = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
                setContacts(list);
            } else {
                setContacts([]);
            }
        });
        return () => unsubscribe();
    }, [user]);

    // Naya contact save karne ka logic
    const handleAddContact = (e) => {
        e.preventDefault();
        if (!name || !phone) {
            setMsg('Name and Phone number are required!');
            return;
        }
        if (!user) return;

        const newContactRef = push(ref(database, `users/${user.uid}/contacts`));
        set(newContactRef, {
            name,
            phone,
            email
        }).then(() => {
            setName('');
            setPhone('');
            setEmail('');
            setMsg('Contact saved successfully! ✅');
            setTimeout(() => setMsg(''), 3000);
        });
    };

    // Contact delete karne ka logic
    const handleDelete = (contactId) => {
        if (!user) return;
        remove(ref(database, `users/${user.uid}/contacts/${contactId}`));
    };

    return (
        <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', textAlign: 'left' }}>
            <h3 style={{ textAlign: 'center' }}>📱 Emergency Contacts</h3>
            <p style={{ fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
                Add details of family members or guardians who will be notified.
            </p>

            {msg && (
                <p style={{ color: msg.includes('✅') ? 'green' : 'red', textAlign: 'center', fontWeight: 'bold' }}>
                    {msg}
                </p>
            )}

            {/* Form */}
            <form onSubmit={handleAddContact} style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '20px 0' }}>
                <input
                    type="text"
                    placeholder="Guardian Name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                    required
                />
                <input
                    type="tel"
                    placeholder="Phone Number *"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                    required
                />
                <input
                    type="email"
                    placeholder="Email Address (Optional)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                />
                <button
                    type="submit"
                    style={{ padding: '10px', backgroundColor: '#2ed573', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    Save Contact
                </button>
            </form>

            {/* Saved Contacts List */}
            <h4>Saved Guardians ({contacts.length}):</h4>
            {contacts.length === 0 ? (
                <p style={{ color: '#888' }}>No emergency contacts saved yet.</p>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {contacts.map((c) => (
                        <li key={c.id} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f9f9' }}>
                            <div>
                                <strong style={{ fontSize: '1.05rem' }}>{c.name}</strong><br />
                                <small>📞 {c.phone}</small> {c.email && <small> | ✉️ {c.email}</small>}
                            </div>
                            <button
                                onClick={() => handleDelete(c.id)}
                                style={{ backgroundColor: '#ff4757', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Delete
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default EmergencyContacts;