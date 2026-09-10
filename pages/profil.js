import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

import { getLocalProfileStats } from '../src/lib/localProfile';

export default function Profil() {
	const [stats, setStats] = useState({ wins: 0, miceCaught: 0 });
	const router = useRouter();

	useEffect(() => {
		setStats(getLocalProfileStats());
	}, []);

	return (
		<main className="profile-page">
			<section className="profile-panel">
				<h1>PROFILE</h1>
				<dl className="profile-stats">
					<div className="profile-stat">
						<dt>Wins</dt>
						<dd>{stats.wins} 🏆</dd>
					</div>
					<div className="profile-stat">
						<dt>Mice caught</dt>
						<dd>{stats.miceCaught} 🐭</dd>
					</div>
				</dl>
				<button className="home-back-button" type="button" onClick={() => router.push('/accueil')}>
					Back
				</button>
			</section>
		</main>
	);
}