import { useState } from 'react';

import CreateParty from '../components/CreateParty';
import JoinParty from '../components/JoinParty';

export default function Accueil() {
    const [mode, setMode] = useState(null);

    return (
        <main className="home-page">
            <section className="home-panel">
                <h1>HUNTERZONE</h1>

                {!mode && (
                    <div className="home-actions">
                        <button className="home-button home-button-primary" onClick={() => setMode('create')}>Create a game</button>

                        <button className="home-button home-button-secondary" onClick={() => setMode('join')}>Join a game</button>
                    </div>
                )}

                {mode === 'create' && (
                    <div className="home-form-panel">
                        <h2>Create a game</h2>

                        <CreateParty />

                        <button className="home-back-button" onClick={() => setMode(null)}>Back</button>
                    </div>
                )}

                {mode === 'join' && (
                    <div className="home-form-panel">
                        <h2>Join a game</h2>

                        <JoinParty />

                        <button className="home-back-button" onClick={() => setMode(null)}>Back</button>
                    </div>
                )}
            </section>
        </main>
    );
}