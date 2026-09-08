import { Avatar } from '@dicebear/core';
import initialFace from '@dicebear/styles/initial-face.json' with { type: 'json' };
import crownIcon from '../assets/icons/crown.svg';

const avatarColors = [
    '#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff',
    '#a0c4ff', '#bdb2ff', '#ffc6ff', '#f1c0e8', '#cfbaf0',
    '#90dbf4', '#8eecf5', '#98f5e1', '#b9fbc0', '#f8edeb',
    '#f7aef8', '#f7d488', '#c1fba4', '#a9def9', '#e4c1f9',
];

export function getAvatarColor(player) {
    const seed = `${player.id}-${player.name}`;
    const value = [...seed].reduce((total, character) => total + character.charCodeAt(0), 0);
    return avatarColors[value % avatarColors.length];
}

export function getAvatarDataUri(player) {
    return new Avatar(initialFace, {
        backgroundColor: [getAvatarColor(player)],
        seed: player.name,
    }).toDataUri();
}

export default function ScoreBoard({ players, hostId }) {
    return (
        <ul className="player-list" aria-label="Game players">
            {players.map(player => (
                <li className="player-row" key={player.id}>
                    <span className="player-avatar">
                        <img className="avatar-image" src={getAvatarDataUri(player)} alt={`Avatar of ${player.name}`}/>

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