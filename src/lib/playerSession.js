const PLAYER_ID_KEY = 'hunterzone_player_id';
const GAME_ID_KEY = 'hunterzone_game_id';

/**
 * Lit l'identifiant du joueur courant stocké pour cet onglet/navigateur.
 * @returns {number|null} Identifiant du joueur, ou null côté serveur.
 */
export function getClientPlayerId() {
  if (typeof window === 'undefined') return null;
  return Number(sessionStorage.getItem(PLAYER_ID_KEY));
}

/**
 * Enregistre l'identifiant du joueur et de la partie en cours dans sessionStorage.
 * @param {string|number} playerId Identifiant du joueur.
 * @param {string|number} gameId Identifiant de la partie.
 */
export function setPlayerSession(playerId, gameId) {
  sessionStorage.setItem(PLAYER_ID_KEY, playerId);
  sessionStorage.setItem(GAME_ID_KEY, gameId);
}

/**
 * Supprime les identifiants de joueur et de partie de sessionStorage.
 */
export function clearPlayerSession() {
  sessionStorage.removeItem(PLAYER_ID_KEY);
  sessionStorage.removeItem(GAME_ID_KEY);
}
