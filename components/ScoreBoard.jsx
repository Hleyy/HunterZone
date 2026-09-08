import { Avatar } from '@dicebear/core';
import initialFace from '@dicebear/styles/initial-face.json' with { type: 'json' };
import crownIcon from '../assets/icons/crown.svg';

function getAvatarDataUri(player) {
    return new Avatar(initialFace, {
        backgroundColor: ['#ffc7bd'],
        seed: player.name,
    }).toDataUri();
}

export default function ScoreBoard({ players, hostId }) {
    return (
        <ul className="player-list" aria-label="Game players">
            {players.map(player => (
                <li className="player-row" key={player.id}>
                    <span className="player-avatar">
                        <img className="avatar-image" src={getAvatarDataUri(player)} alt={`Avatar de ${player.name}`}/>

                        {player.id === hostId && (
                            <img className="crown" src={crownIcon.src || crownIcon} alt="Host" />
                        )}
                    </span>

                    <span className="player-name">{player.name}</span>
                </li>
            ))}
        </ul>
    );
}