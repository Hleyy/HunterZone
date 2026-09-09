import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Cat from '../assets/icons/Cat(Hunter).svg';
import Mouse from '../assets/icons/mouse-style.svg';
import { getAvatarDataUri } from '../components/ScoreBoard';
import { supabase } from '../src/lib/supabase';
import crownIconCat from '../assets/icons/crownWinnerCat.svg';
import crownIconMouse from '../assets/icons/crownWinnerMouse.svg';


export default function EndGame() {
	const router = useRouter();
	const [players, setPlayers] = useState([]);
	const winner = router.query.winner;
	const playerId = typeof window !== 'undefined'
		? Number(sessionStorage.getItem('hunterzone_player_id'))
		: null;

	useEffect(() => {
		if (!router.isReady || !router.query.code) return;

		const loadPlayers = async () => {
			const { data: game, error: gameError } = await supabase
				.from('games')
				.select('id')
				.eq('code', router.query.code)
				.single();

			if (gameError) {
				console.error('End game:', gameError);
				return;
			}

			const { data: gamePlayers, error: playersError } = await supabase
				.from('players')
				.select('id, name, role, is_found')
				.eq('game_id', game.id)
				.order('created_at');

			if (playersError) {
				console.error('End game players:', playersError);
				return;
			}

			setPlayers(gamePlayers || []);
		};

		loadPlayers();
	}, [router.isReady, router.query.code]);

	const currentPlayer = players.find((player) => player.id === playerId);
	const playerWon = currentPlayer?.role === winner;
	const winnerCrownIcon = currentPlayer?.role === 'cat' ? crownIconCat : crownIconMouse;

	const returnHome = () => {
		sessionStorage.removeItem('hunterzone_player_id');
		sessionStorage.removeItem('hunterzone_game_id');
		router.replace('/accueil');
	};

	return (
		<main className="end-game-page">
			<section className="end-game-content" aria-live="polite">
				<h1 className="end-game-title">HUNTERZONE</h1>

				<div className={`end-game-result${currentPlayer?.role === 'cat' ? ' end-game-result--cat' : ''}`}>
					{playerWon ? 'YOU WIN!' : 'YOU LOSE!'}
				</div>

				<div className={`end-game-players${currentPlayer?.role === 'cat' ? ' end-game-players--cat' : ''}`} aria-label="Players">
					{players.map((player) => {
						const roleIcon = player.role === 'cat' ? Cat : Mouse;

						return (
							<div className="end-game-player" key={player.id}>
								<span className="end-game-player-avatar-wrap">
									<img
										className="end-game-player-avatar"
										src={getAvatarDataUri(player)}
										alt={player.name || `Player ${player.id}`}
									/>
									{player.role === winner && (
										<img className="crown" src={winnerCrownIcon.src || winnerCrownIcon} alt="Winner" />
									)}
								</span>
								<span className="end-game-player-name">
									{player.name || `Joueur ${player.id}`}
								</span>
								<img
									className="end-game-player-role"
									src={roleIcon.src || roleIcon}
									alt={player.role === 'cat' ? 'Cat' : 'Mouse'}
								/>
							</div>
						);
					})}
				</div>

				<button className="end-game-home-button" type="button" onClick={returnHome}>
					Back home
				</button>
			</section>
		</main>
	);
}
