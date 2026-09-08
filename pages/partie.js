import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../src/lib/supabase';

export default function Partie() {
    const router = useRouter();
    const [role, setRole] = useState(null);
    const code = router.query.code;

    useEffect(() => {
        if (!router.isReady || !code) return;

        async function loadRole() {
            const playerId = Number(sessionStorage.getItem('hunterzone_player_id'));
            const { data: game } = await supabase.from('games').select('id').eq('code', code).single();
            const { data: player } = await supabase.from('players').select('role').eq('id', playerId).eq('game_id', game.id).single();
            setRole(player?.role);
        }

        loadRole();
    }, [router.isReady, code]);

    useEffect(() => {
        if (!role) return;
        const timeout = setTimeout(() => router.replace(`/map?code=${code}`), 5000);
        return () => clearTimeout(timeout);
    }, [role, code, router]);

    if (!role) return <main className="role-page" />;

    const isCat = role === 'cat';

    return (
        <main className="role-page">
            <section className="role-popup" role="dialog" aria-live="polite">
                <button className="role-close" onClick={() => router.replace(`/map?code=${code}`)} aria-label="Close">×</button>
                <p className="role-message">
                    {isCat ? "Meow! 🐱 You're the Cat this round." : "Squeak! 🐭 You're the Mouse this round."}
                </p>
                <button className="role-action" onClick={() => router.replace(`/map?code=${code}`)}>
                    {isCat ? "Run" : "Run"}
                </button>
            </section>
        </main>
    );
}
