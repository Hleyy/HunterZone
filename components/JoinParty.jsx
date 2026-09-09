import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../src/lib/supabase';

export default function JoinParty() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!router.isReady) return;

        const invitedCode = typeof router.query.code === 'string'
            ? router.query.code.toUpperCase()
            : '';

        if (invitedCode) setCode(invitedCode);
    }, [router.isReady, router.query.code]);

    async function join(e) {
        e.preventDefault();

        const playerName = name.trim();
        const partyCode = code.trim().toUpperCase();

        if (!playerName) return setError('Enter a username.');
        if (!partyCode) return setError('Enter the game code.');

        setLoading(true);
        setError('');

        // Vérifie que la partie existe avant de traiter une reconnexion ou une nouvelle inscription.
        const { data: game, error: gameError } = await supabase
            .from('games')
            .select('id, code, status')
            .eq('code', partyCode)
            .maybeSingle();

        if (gameError || !game) {
            setError('This game does not exist.');
            return setLoading(false);
        }

        const { data: existing, error: existingError } = await supabase
            .from('players')
            .select('id, name')
            .eq('game_id', game.id)
            .ilike('name', playerName)
            .maybeSingle();

        if (existingError) {
            console.error('Checking existing player:', existingError);
            setError('Unable to check the player.');
            return setLoading(false);
        }

        if (existing) {
            if (game.status === 'playing') {
                sessionStorage.setItem('hunterzone_player_id', existing.id);
                sessionStorage.setItem('hunterzone_game_id', game.id);
                router.push(`/partie?code=${game.code}`);
                return;
            }

            if (game.status === 'finished') {
                setError('This game has ended.');
            } else {
                setError('This username is already in use in this game.');
            }
            return setLoading(false);
        }

        if (game.status !== 'waiting') {
            setError('This game has already started.');
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

            {!router.query.code && (
                <input
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="Game code"
                    maxLength={7}
                />
            )}

            <button disabled={loading}>
                {loading ? 'Joining...' : 'Join a game'}
            </button>

            {error && <p>{error}</p>}
        </form>
    );
}