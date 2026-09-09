import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

import { supabase } from '../src/lib/supabase';
import Panel from '../components/Panel';
import ScoreBoard from '../components/ScoreBoard';

import doorIcon from '../assets/icons/door.svg';
import doorOpenIcon from '../assets/icons/door-open.svg';
import hunterNetIcon from '../assets/icons/hunter-net.svg';

const HEARTBEAT = 5000;
const TIMEOUT = 600000;

export default function Lobby() {
    const router = useRouter();

    const [party, setParty] = useState(null);
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);

    const code = router.query.code;

    const playerId =
        typeof window !== 'undefined'
            ? Number(sessionStorage.getItem('hunterzone_player_id'))
            : null;

    const isHost = Number(party?.host_id) === playerId;

    async function loadPlayers(gameId) {
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .eq('game_id', gameId)
            .order('created_at');

        if (error) return console.error('Players:', error);

        setPlayers(data);
        setLoading(false);
    }

    async function leave() {
    if (!playerId || !party) {
        return router.push('/accueil');
    }

    const isHost = Number(party.host_id) === playerId;

    // Si l'hôte quitte, on choisit son successeur AVANT de le supprimer.
    let newHost = null;

    if (isHost) {
        const { data, error } = await supabase
            .from('players')
            .select('id')
            .eq('game_id', party.id)
            .neq('id', playerId)
            .order('created_at')
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Finding a new host:', error);
            return;
        }

        newHost = data;
    }

    // Suppression du joueur
    const { error: deleteError } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId)
        .eq('game_id', party.id);

    if (deleteError) {
        console.error('Leaving the game:', deleteError);
        return;
    }

    // Plus aucun joueur
    if (!newHost && isHost) {
        await supabase
            .from('games')
            .delete()
            .eq('id', party.id);
    }

    // Transfert de l'hôte
    if (newHost) {
        const { error: hostError } = await supabase
            .from('games')
            .update({ host_id: newHost.id })
            .eq('id', party.id)
            .eq('host_id', playerId);

        if (hostError) {
            console.error('Host transfer:', hostError);
            return;
        }
    }

    sessionStorage.removeItem('hunterzone_player_id');
    sessionStorage.removeItem('hunterzone_game_id');

    router.push('/accueil');
}

    async function handleEmptyParty(gameId, wasHost = false) {
        const { data: remaining, error } = await supabase
            .from('players')
            .select('id')
            .eq('game_id', gameId)
            .order('created_at');

        if (error) return console.error('Remaining players:', error);

        if (!remaining.length) {
            await supabase
                .from('games')
                .delete()
                .eq('id', gameId);

            return;
        }

        if (wasHost) {
            await supabase
                .from('games')
                .update({ host_id: remaining[0].id })
                .eq('id', gameId);
        }
    }

    async function start() {
        if (!party || !isHost || party.status !== 'waiting') return;

        const { data: gamePlayers, error: playersError } = await supabase
            .from('players')
            .select('id')
            .eq('game_id', party.id);

        if (playersError || !gamePlayers?.length) return console.error('Role assignment:', playersError);
        if (gamePlayers.length < 2) return;

        const catId = gamePlayers[Math.floor(Math.random() * gamePlayers.length)].id;
        const roleUpdates = gamePlayers.map(player =>
            supabase
                .from('players')
                .update({ role: player.id === catId ? 'cat' : 'mouse' })
                .eq('id', player.id)
                .eq('game_id', party.id)
        );

        const results = await Promise.all(roleUpdates);
        const roleError = results.find(result => result.error)?.error;

        if (roleError) return console.error('Role assignment:', roleError);

        const startedAt = new Date().toISOString();

        const { error } = await supabase
            .from('games')
            .update({ status: 'playing', started_at: startedAt })
            .eq('id', party.id)
            .eq('host_id', playerId);

        if (error) console.error('Game start:', error);
    }

    // Récupération initiale
    useEffect(() => {
        if (!router.isReady || !code) return;

        async function load() {
            const { data, error } = await supabase
                .from('games')
                .select('*')
                .eq('code', code)
                .maybeSingle();

            if (error || !data) {
                setLoading(false);
                return;
            }

            setParty(data);
            loadPlayers(data.id);
        }

        load();
    }, [router.isReady, code]);

    // Heartbeat -> Permet de vérifier s'il y a des joueurs inactifs
    useEffect(() => {
        if (!party?.id || !playerId) return;

        const heartbeat = async () => {
            const { error } = await supabase
                .from('players')
                .update({ last_seen: new Date().toISOString() })
                .eq('id', playerId)
                .eq('game_id', party.id);

            if (error) console.error('Heartbeat :', error);
        };

        heartbeat();

        const interval = setInterval(heartbeat, HEARTBEAT);
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') heartbeat();
        };

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [party?.id, playerId]);

    // Nettoyage des joueurs inactifs
    useEffect(() => {
        if (!party?.id) return;

        const cleanup = async () => {
            const limit = new Date(
                Date.now() - TIMEOUT
            ).toISOString();

            const { data: inactive, error } = await supabase
                .from('players')
                .select('id')
                .eq('game_id', party.id)
                .lt('last_seen', limit);

            if (error) return console.error('Cleanup:', error);
            if (!inactive.length) return;

            const { error: deleteError } = await supabase
                .from('players')
                .delete()
                .in(
                    'id',
                    inactive.map(player => player.id)
                );

            if (deleteError) {
                return console.error(
                    'Removing players:',
                    deleteError
                );
            }

            await handleEmptyParty(party.id);
        };

        cleanup();

        const interval = setInterval(
            cleanup,
            HEARTBEAT * 2
        );

        return () => clearInterval(interval);
    }, [party?.id]);

    // Synchronisation temps réel
    useEffect(() => {
        if (!party?.id) return;

        const channel = supabase
            .channel(`lobby-${party.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'players',
                    filter: `game_id=eq.${party.id}`,
                },
                () => loadPlayers(party.id)
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'games',
                    filter: `id=eq.${party.id}`,
                },
                ({ new: game }) => {
                    setParty(game);

                    if (game.status === 'playing') {
                        router.push(
                            `/partie?code=${game.code}`
                        );
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [party?.id]);

    if (loading) {
        return (
            <main className="lobby-page">
                <Panel>
                    <p>Loading the lobby...</p>
                </Panel>
            </main>
        );
    }

    if (!party) {
        return (
            <main className="lobby-page">
                <Panel>
                    <h1>Game not found</h1>
                </Panel>
            </main>
        );
    }

    return (
        <main className="lobby-page">
            <Panel>
                <header className="lobby-header">
                    <h1>HUNTERZONE</h1>
                </header>

                <div className="party-info">
                    <div>
                        <p className="section-label">Game code</p>
                        <strong className="party-code">{party.code}</strong>
                    </div>

                    <button className="leave-button" onClick={leave} aria-label="Leave the lobby">
                        <img className="door-icon door-icon-closed" src={doorIcon.src || doorIcon} alt=""></img>
                        <img className="door-icon door-icon-open" src={doorOpenIcon.src || doorOpenIcon} alt=""></img>
                    </button>
                </div>

                <div className="players-heading">
                    <p className="players-count"><strong>{players.length}</strong>{' '}players in the game</p>
                </div>

                <ScoreBoard players={players} hostId={party.host_id}/>

                {isHost && party.status === 'waiting' && (
                    <footer className="lobby-footer">
                        <button className="start-button" onClick={start} disabled={players.length < 2}>
                            Start to hunt
                            <img className="hunter-net-icon" src={hunterNetIcon.src || hunterNetIcon} alt=""/>
                        </button>
                    </footer>
                )}
            </Panel>
        </main>
    );
}