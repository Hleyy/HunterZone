import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../src/lib/supabase';

export default function CreateParty() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function create(e) {
        e.preventDefault();
        const playerName = name.trim();

        if (!playerName) return setError('Enter a username.');

        setLoading(true);
        setError('');

        // Création de la partie
        const code = `HZ-${Math.floor(1000 + Math.random() * 9000)}`;

        const { data: game, error: gameError } = await supabase
            .from('games')
            .insert({ code })
            .select()
            .single();

        if (gameError) {
            console.error(gameError);
            setError('Unable to create the game.');
            return setLoading(false);
        }

        // Création de l'hôte
        const { data: player, error: playerError } = await supabase
            .from('players')
            .insert({ game_id: game.id, name: playerName })
            .select()
            .single();

        if (playerError) {
            console.error(playerError);
            setError('Unable to create the player.');
            return setLoading(false);
        }

        await supabase
            .from('games')
            .update({ host_id: player.id })
            .eq('id', game.id);

        sessionStorage.setItem('hunterzone_player_id', player.id);
        sessionStorage.setItem('hunterzone_game_id', game.id);

        router.push(`/lobby?code=${code}`);
    }

    return (
        <form onSubmit={create}>
            <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your username"
                maxLength={20}
            />

            <button disabled={loading}>
                {loading ? 'Creating...' : 'Create a game'}
            </button>

            {error && <p>{error}</p>}
        </form>
    );
}