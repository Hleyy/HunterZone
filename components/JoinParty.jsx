import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../src/lib/supabase';

export default function JoinParty() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function join(e) {
        e.preventDefault();

        const playerName = name.trim();
        const partyCode = code.trim().toUpperCase();

        if (!playerName) return setError('Enter a username.');
        if (!partyCode) return setError('Enter the game code.');

        setLoading(true);
        setError('');

        // Vérifie que la partie existe et attend encore des joueurs car sinon on pourrait avoir des joueurs qui join en cours de partie
        const { data: game, error: gameError } = await supabase
            .from('games')
            .select('id, code, status')
            .eq('code', partyCode)
            .maybeSingle();

        if (gameError || !game) {
            setError('This game does not exist.');
            return setLoading(false);
        }

        if (game.status !== 'waiting') {
            setError('This game has already started.');
            return setLoading(false);
        }

        // Un pseudo ne peut être utilisé qu'une fois dans une partie
        const { data: existing } = await supabase
            .from('players')
            .select('id')
            .eq('game_id', game.id)
            .ilike('name', playerName)
            .maybeSingle();

        if (existing) {
            setError('This username is already in use in this game.');
            return setLoading(false);
        }

        // S'il y a une erreur quelconque, on bloque
        const { data: player, error: playerError } = await supabase
            .from('players')
            .insert({ game_id: game.id, name: playerName })
            .select()
            .single();

        if (playerError) {
            console.error(playerError);
            setError('Unable to join the game.');
            return setLoading(false);
        }

        sessionStorage.setItem('hunterzone_player_id', player.id);
        sessionStorage.setItem('hunterzone_game_id', game.id);

        router.push(`/lobby?code=${game.code}`);
    }

    return (
        <form onSubmit={join}>
            <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your username"
                maxLength={20}
            />

            <input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Game code"
                maxLength={7}
            />

            <button disabled={loading}>
                {loading ? 'Joining...' : 'Join a game'}
            </button>

            {error && <p>{error}</p>}
        </form>
    );
}