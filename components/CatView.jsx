import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import Cat from '../assets/icons/Cat(Hunter).svg';
import MouseStyle from '../assets/icons/mouse-style.svg';
import HandIcon from '../assets/icons/hand.svg';
import { getAvatarDataUri } from './ScoreBoard';
import { recordCaughtMouse, recordLocalWin } from '../src/lib/localProfile';
import { getClientPlayerId } from '../src/lib/playerSession';
import { supabase } from '../src/lib/supabase';

const GAME_DURATION_SECONDS = 600; // Durée du jeu
const CATCH_RADIUS_METERS = 10; // Rayon de capture en mètres pour le chat
const SAFE_ZONE_RADIUS_METERS = 500; // Rayon pour pas que les souris dépassent les limites du jeu
const ZONE_WARNING_SECONDS = 5; // Cooldown pour l'avertissement de sortie des limites du jeu
const GEOLOCATION_OPTIONS = { // Options pour les requêttes haute précision
  enableHighAccuracy: true,
  timeout: 60000,
  maximumAge: 0,
};
const GEOLOCATION_FALLBACK_OPTIONS = { // Options pour les requêtes basses précisions
  enableHighAccuracy: false,
  timeout: 15000,
  maximumAge: 30000,
};

const PLAYER_HEARTBEAT_MS = 5000; // 
const INACTIVE_PLAYER_TIMEOUT_MS = 10 * 60 * 1000;
const PLAYER_FIELDS = 'id, name, role, lat, lng, accuracy_m, is_found, game_id';

/**
 * Calcule la distance de Haversine entre deux coordonnées GPS.
 * @param {number} lat1 Latitude du premier point.
 * @param {number} lon1 Longitude du premier point.
 * @param {number} lat2 Latitude du second point.
 * @param {number} lon2 Longitude du second point.
 * @returns {number} Distance en mètres, arrondie à l'entier le plus proche.
 */
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calcule le cap (bearing) d'une coordonnée GPS vers une autre.
 * @param {number} lat1 Latitude du point d'origine.
 * @param {number} lon1 Longitude du point d'origine.
 * @param {number} lat2 Latitude du point cible.
 * @param {number} lon2 Longitude du point cible.
 * @returns {number} Cap en degrés, normalisé entre 0 et 360.
 */
function getBearingAngle(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180));
  const x =
    Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
    Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos((lon2 - lon1) * (Math.PI / 180));
  return ((Math.atan2(y, x) * (180 / Math.PI)) + 360) % 360;
}

/**
 * Formate une distance en mètres en un libellé lisible (m ou km).
 * @param {number} distanceInMeters Distance à formater.
 * @returns {string} Libellé formaté, par exemple "120 m" ou "1.2 km".
 */
function getDistanceLabel(distanceInMeters) {
  if (distanceInMeters >= 1000) {
    return `${(distanceInMeters / 1000).toFixed(1)} km`;
  }
  return `${distanceInMeters} m`;
}

/**
 * Calcule la marge d'incertitude à ajouter au rayon de capture, plafonnée à 25 m.
 * @param {number} accuracy1 Précision GPS du premier point (en mètres).
 * @param {number} accuracy2 Précision GPS du second point (en mètres).
 * @returns {number} Marge d'incertitude en mètres.
 */
function getLocationUncertainty(accuracy1, accuracy2) {
  return Math.min(25, Math.max(accuracy1 || 0, accuracy2 || 0));
}

/**
 * Récupère tous les joueurs d'une partie donnée depuis Supabase.
 * @param {string|number} gameId Identifiant de la partie dont on récupère les joueurs.
 * @returns {Promise<import('@supabase/supabase-js').PostgrestSingleResponse<any>>} Résultat de la requête Supabase.
 */
async function fetchPlayers(gameId) {
  return supabase
    .from('players')
    .select(PLAYER_FIELDS)
    .eq('game_id', gameId);
}

/**
 * Construit une icône Leaflet (divIcon) affichant l'avatar d'un joueur avec un effet de pulsation.
 * @param {{ id: string|number, name: string }} player Joueur à afficher sur la carte.
 * @param {string} role Rôle du joueur ("cat" ou "mouse"), actuellement inutilisé pour le style.
 * @returns {L.DivIcon} Icône Leaflet prête à être utilisée sur un Marker.
 */
function createPulseIcon(player, role) {
  const avatar = getAvatarDataUri(player);
  const color = '#565968';

  return L.divIcon({
    html: `
      <div class="game-map-marker-shell" style="--marker-color: ${color}">
        <div class="game-map-marker-pulse"></div>
        <div class="game-map-marker-pulse game-map-marker-pulse--delayed"></div>
        <img class="game-map-marker-avatar" src="${avatar}" alt="${player.name || 'Player'}" />
      </div>
    `,
    className: 'custom-player-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
}

function RecenterOnPlayer({ position }) {
  const map = useMap();
  const hasCentered = useRef(false);

  useEffect(() => {
    if (!position || hasCentered.current) return;

    map.flyTo([position.lat, position.lng], 17, {
      animate: true,
      duration: 1.2,
    });
    hasCentered.current = true;
  }, [map, position]);

  return null;
}

export default function CatGameView({ code }) {
  const router = useRouter();
  const [catPosition, setCatPosition] = useState({ lat: 48.8566, lng: 2.3522 });
  const [playerPosition, setPlayerPosition] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SECONDS);
  const [gameWinner, setGameWinner] = useState(null);
  const [isCatching, setIsCatching] = useState(false);
  const [zoneCenter, setZoneCenter] = useState(null);
  const [isInRestrictedZone, setIsInRestrictedZone] = useState(false);
  const [zoneWarningSeconds, setZoneWarningSeconds] = useState(ZONE_WARNING_SECONDS);
  const [locationError, setLocationError] = useState(false);
  const [locationErrorCode, setLocationErrorCode] = useState(null);
  const [locationRetry, setLocationRetry] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const hasEndedRef = useRef(false);
  const zoneCenterRef = useRef(null);
  const zoneWarningTimerRef = useRef(null);
  const zoneCountdownTimerRef = useRef(null);
  const locationRetryTimerRef = useRef(null);
  const chatChannelRef = useRef(null);

  const [players, setPlayers] = useState([]);
  const [gameId, setGameId] = useState(null);
  const [gameStartedAt, setGameStartedAt] = useState(null);
  const playerId = getClientPlayerId();

  /**
   * Définit une seule fois le centre partagé de la zone sûre, à partir de la première position du chat.
   * @param {{ lat: number, lng: number }} position Position candidate pour le centre.
   * @param {string|number} [gameIdentifier] Partie à mettre à jour
   */
  const updateZoneCenter = (position, gameIdentifier = gameId) => {
    if (!position || zoneCenterRef.current || !gameIdentifier) return;

    zoneCenterRef.current = position;
    setZoneCenter(position);
    supabase
      .from('games')
      .update({ zone_center_lat: position.lat, zone_center_lng: position.lng })
      .eq('id', gameIdentifier)
      .is('zone_center_lat', null)
      .is('zone_center_lng', null);
  };

  useEffect(() => {
    if (!code) return;

    const loadPlayers = async (id) => {
      const { data, error } = await fetchPlayers(id);

      if (error) return console.error('Map players:', error);

      const allPlayers = data || [];
      setPlayers(allPlayers);

      const positionedPlayers = allPlayers.filter(player => player.lat != null && player.lng != null);
      const cat = positionedPlayers.find(player => player.role === 'cat');
      if (cat) setCatPosition({ lat: cat.lat, lng: cat.lng });
      if (cat && !zoneCenterRef.current) updateZoneCenter({ lat: cat.lat, lng: cat.lng }, id);

      const currentPlayer = allPlayers.find(player => player.id === playerId);
      if (currentPlayer) {
        if (currentPlayer.lat != null && currentPlayer.lng != null) {
          setPlayerPosition({ lat: currentPlayer.lat, lng: currentPlayer.lng });
        }
        setCurrentRole(currentPlayer.role);
      }

    };

    const loadGame = async () => {
      const { data: game, error } = await supabase
        .from('games')
        .select('id, started_at, status, winner, zone_center_lat, zone_center_lng')
        .eq('code', code)
        .single();

      if (error) return console.error('Map game:', error);
      setGameId(game.id);
      setGameStartedAt(game.started_at);
      if (game.zone_center_lat != null && game.zone_center_lng != null) {
        const center = { lat: game.zone_center_lat, lng: game.zone_center_lng };
        zoneCenterRef.current = center;
        setZoneCenter(center);
      }
      if (game.status === 'finished') {
        setGameWinner(game.winner);
      }
      loadPlayers(game.id);
    };

    loadGame();
  }, [code, playerId]);

  useEffect(() => {
    if (!gameId) return;

    // Le heartbeat et le polling maintiennent le jeu actif si Realtime est indisponible
    const heartbeat = async () => {
      if (!playerId) return;

      const { error } = await supabase
        .from('players')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', playerId)
        .eq('game_id', gameId);

      if (error) console.error('Game heartbeat:', error);
    };

    const cleanupInactivePlayers = async () => {
      const cutoff = new Date(Date.now() - INACTIVE_PLAYER_TIMEOUT_MS).toISOString();
      const { data: inactivePlayers, error } = await supabase
        .from('players')
        .select('id, role')
        .eq('game_id', gameId)
        .lt('last_seen', cutoff);

      if (error) {
        console.error('Game cleanup:', error);
        return;
      }

      if (inactivePlayers?.some((player) => player.role === 'cat')) {
        await finishGame('mouse');
      }

      if (inactivePlayers?.length) {
        const { error: deleteError } = await supabase
          .from('players')
          .delete()
          .in('id', inactivePlayers.map((player) => player.id));

        if (deleteError) console.error('Removing inactive players:', deleteError);
      }

      const { data: remainingPlayers, error: remainingError } = await supabase
        .from('players')
        .select('id, role')
        .eq('game_id', gameId);

      if (remainingError) {
        console.error('Checking remaining players:', remainingError);
        return;
      }

      if (remainingPlayers?.length < 2) {
        const remainingCat = remainingPlayers.some((player) => player.role === 'cat');
        await finishGame(remainingCat ? 'cat' : 'mouse');
      }
    };

    heartbeat();
    const heartbeatInterval = setInterval(heartbeat, PLAYER_HEARTBEAT_MS);
    const cleanupInterval = setInterval(cleanupInactivePlayers, PLAYER_HEARTBEAT_MS * 2);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') heartbeat();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    const refreshPlayers = async () => {
      const { data, error } = await fetchPlayers(gameId);

      if (error) {
        console.error('Refreshing players:', error);
        return;
      }

      const allPlayers = data || [];
      setPlayers(allPlayers);

      const positionedPlayers = allPlayers.filter((player) => player.lat != null && player.lng != null);
      const cat = positionedPlayers.find((player) => player.role === 'cat');
      if (cat) setCatPosition({ lat: cat.lat, lng: cat.lng });

      const currentPlayer = allPlayers.find((player) => player.id === playerId);
      if (currentPlayer) {
        setCurrentRole(currentPlayer.role);
        if (currentPlayer.lat != null && currentPlayer.lng != null) {
          setPlayerPosition({ lat: currentPlayer.lat, lng: currentPlayer.lng });
        }
      }
    };

    const channel = supabase
      .channel(`map-${gameId}`)
      .on('broadcast', { event: 'chat-message' }, ({ payload }) => {
        if (!payload?.text || !payload?.alias) return;
        setChatMessages((messages) => [...messages.slice(-3), payload]);
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}`
      }, async () => {
        const { data } = await fetchPlayers(gameId);
        const allPlayers = data || [];
        setPlayers(allPlayers);

        const positionedPlayers = allPlayers.filter(player => player.lat != null && player.lng != null);
        const cat = positionedPlayers.find(player => player.role === 'cat');
        if (cat) setCatPosition({ lat: cat.lat, lng: cat.lng });
        if (cat && !zoneCenterRef.current) updateZoneCenter({ lat: cat.lat, lng: cat.lng }, gameId);

        const currentPlayer = allPlayers.find(player => player.id === playerId);
        if (currentPlayer) {
          if (currentPlayer.lat != null && currentPlayer.lng != null) {
            setPlayerPosition({ lat: currentPlayer.lat, lng: currentPlayer.lng });
          }
          setCurrentRole(currentPlayer.role);
        }

        checkAllMiceCaptured();
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}`
      }, ({ new: updatedGame }) => {
        if (updatedGame.zone_center_lat != null && updatedGame.zone_center_lng != null) {
          const center = { lat: updatedGame.zone_center_lat, lng: updatedGame.zone_center_lng };
          zoneCenterRef.current = center;
          setZoneCenter(center);
        }
        if (updatedGame.status === 'finished' && updatedGame.winner) {
          setGameWinner(updatedGame.winner);
        }
      })
      .subscribe();
    chatChannelRef.current = channel;

    const refreshInterval = setInterval(refreshPlayers, 5000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(cleanupInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
      chatChannelRef.current = null;
    };
  }, [gameId, playerId]);

  /**
   * Termine la partie en cours avec le rôle gagnant indiqué, si elle n'est pas déjà terminée.
   * @param {'cat'|'mouse'} winner Rôle qui a gagné la partie.
   */
  const finishGame = async (winner) => {
    if (!gameId || hasEndedRef.current) return;

    hasEndedRef.current = true;
    const { data, error } = await supabase
      .from('games')
      .update({ status: 'finished', winner, ended_at: new Date().toISOString() })
      .eq('id', gameId)
      .eq('status', 'playing')
      .select('winner')
      .maybeSingle();

    if (error) {
      hasEndedRef.current = false;
      console.error('Game finish:', error);
      return;
    }

    if (data?.winner) setGameWinner(data.winner);
  };

  /**
   * Termine la partie et fait gagner le chat une fois que toutes les souris ont été capturées ou éliminées.
   * Chaque client exécute cette vérification après une capture ou une élimination de zone.
   */
  const checkAllMiceCaptured = async () => {
    if (!gameId || gameWinner) return;

    const { data: mice, error } = await supabase
      .from('players')
      .select('id, is_found')
      .eq('game_id', gameId)
      .eq('role', 'mouse');

    if (error) {
      console.error('Checking mice:', error);
      return;
    }

    if (mice?.length > 0 && mice.every((mouse) => mouse.is_found)) {
      await finishGame('cat');
    }
  };

  /**
   * Élimine la souris actuelle pour être restée trop longtemps hors des limites du jeu.
   */
  const eliminatePlayerOutsideZone = async () => {
    if (!playerId || !gameId || currentRole !== 'mouse' || gameWinner) return;

    const { error } = await supabase
      .from('players')
      .update({ is_found: true })
      .eq('id', playerId)
      .eq('game_id', gameId)
      .eq('is_found', false);

    if (error) {
      console.error('Zone elimination:', error);
      return;
    }

    setIsInRestrictedZone(false);
    await checkAllMiceCaptured();
  };

  useEffect(() => {
    // La souris dispose de cinq secondes pour revenir dans la zone de jeu
    if (currentRole !== 'mouse' || !playerPosition || !zoneCenter || gameWinner) {
      setIsInRestrictedZone(false);
      clearTimeout(zoneWarningTimerRef.current);
      clearInterval(zoneCountdownTimerRef.current);
      zoneWarningTimerRef.current = null;
      zoneCountdownTimerRef.current = null;
      return undefined;
    }

    const distanceFromZoneCenter = getDistanceInMeters(
      zoneCenter.lat,
      zoneCenter.lng,
      playerPosition.lat,
      playerPosition.lng
    );

    if (distanceFromZoneCenter <= SAFE_ZONE_RADIUS_METERS) {
      setIsInRestrictedZone(false);
      setZoneWarningSeconds(ZONE_WARNING_SECONDS);
      clearTimeout(zoneWarningTimerRef.current);
      clearInterval(zoneCountdownTimerRef.current);
      zoneWarningTimerRef.current = null;
      zoneCountdownTimerRef.current = null;
      return undefined;
    }

    if (zoneWarningTimerRef.current) return undefined;

    setIsInRestrictedZone(true);
    setZoneWarningSeconds(ZONE_WARNING_SECONDS);
    zoneCountdownTimerRef.current = setInterval(() => {
      setZoneWarningSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    zoneWarningTimerRef.current = setTimeout(() => {
      clearInterval(zoneCountdownTimerRef.current);
      zoneCountdownTimerRef.current = null;
      zoneWarningTimerRef.current = null;
      eliminatePlayerOutsideZone();
    }, ZONE_WARNING_SECONDS * 1000);

  }, [currentRole, playerPosition, zoneCenter, gameWinner]);

  useEffect(() => () => {
    clearTimeout(zoneWarningTimerRef.current);
    clearInterval(zoneCountdownTimerRef.current);
  }, []);

  useEffect(() => {
    if (!gameWinner || !code) return;
    if (currentRole === gameWinner && gameId) recordLocalWin(gameId);
    router.replace(`/endGame?code=${encodeURIComponent(code)}&winner=${gameWinner}`);
  }, [gameWinner, code, currentRole, gameId, router]);

  // Suivi GPS en direct.
  useEffect(() => {
    if (!gameId || !playerId || !('geolocation' in navigator)) return;

    const savePosition = async (position) => {
      // Met à jour l’interface immédiatement, puis enregistre la position pour les autres joueurs
      setLocationError(false);
      setLocationErrorCode(null);
      setPlayerPosition(position);
      setPlayers((currentPlayers) => currentPlayers.map((player) => (
        player.id === playerId ? { ...player, ...position } : player
      )));

      const { data } = await supabase
        .from('players')
        .select('role')
        .eq('id', playerId)
        .eq('game_id', gameId)
        .single();

      if (data?.role === 'cat') {
        setCatPosition(position);
        updateZoneCenter(position);
      }

      if (playerId && gameId) {
        const { error: positionError } = await supabase
          .from('players')
          .update(position)
          .eq('id', playerId)
          .eq('game_id', gameId);

        if (positionError) console.error('Position update:', positionError);
      }
    };

    let fallbackInProgress = false;
    let watchId = null;
    let usingFallback = false;

    const startLocationWatch = (options) => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const position = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy_m: pos.coords.accuracy,
          };
          savePosition(position);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setLocationError(true);
            setLocationErrorCode(error.code);
            return;
          }

          if (!usingFallback) {
            usingFallback = true;
            startLocationWatch(GEOLOCATION_FALLBACK_OPTIONS);
          }
        },
        options
      );
    };

    const syncCurrentPlayerPosition = (options = GEOLOCATION_OPTIONS) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const position = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy_m: pos.coords.accuracy,
          };
          fallbackInProgress = false;
          savePosition(position);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setLocationError(true);
            setLocationErrorCode(error.code);
            return;
          }

          if (!fallbackInProgress) {
            fallbackInProgress = true;
            usingFallback = true;
            startLocationWatch(GEOLOCATION_FALLBACK_OPTIONS);
            syncCurrentPlayerPosition(GEOLOCATION_FALLBACK_OPTIONS);
            return;
          }

          setLocationError(true);
          setLocationErrorCode(error.code);
          fallbackInProgress = false;
          locationRetryTimerRef.current = setTimeout(
            () => syncCurrentPlayerPosition(),
            10000
          );
        },
        options
      );
    };

    syncCurrentPlayerPosition();
    startLocationWatch(GEOLOCATION_OPTIONS);

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(locationRetryTimerRef.current);
    };
  }, [gameId, playerId, locationRetry]);

  // Décompte basé sur l'heure de début enregistrée en base
  useEffect(() => {
    if (!gameStartedAt) return undefined;

    const startAt = Date.parse(gameStartedAt);
    if (!Number.isFinite(startAt)) return undefined;

    const syncTimer = () => {
      const elapsedSeconds = Math.floor((Date.now() - startAt) / 1000);
      const remaining = Math.max(0, GAME_DURATION_SECONDS - elapsedSeconds);
      setTimeLeft(remaining);

      if (remaining === 0) finishGame('mouse');
    };

    syncTimer();

    const interval = setInterval(syncTimer, 1000);
    const handleVisibilityChange = () => {
      if (!document.hidden) syncTimer();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameStartedAt]);

  /**
   * Formate une durée en secondes sous la forme MM:SS.
   * @param {number} seconds Durée à formater.
   * @returns {string} Temps formaté, par exemple "09:05".
   */
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const catchablePlayer = currentRole === 'cat' && playerPosition
    ? players.find((player) => {
      if (player.role !== 'mouse' || player.is_found || player.lat == null || player.lng == null) {
        return false;
      }

      const reportedDistance = getDistanceInMeters(
        playerPosition.lat,
        playerPosition.lng,
        player.lat,
        player.lng
      );
      const locationUncertainty = getLocationUncertainty(playerPosition.accuracy_m, player.accuracy_m);

      return reportedDistance <= CATCH_RADIUS_METERS + locationUncertainty;
    })
    : null;

  /**
   * Tente de capturer une souris si elle se trouve dans le rayon de capture.
   * @param {{ id: string|number, lat: number, lng: number, accuracy_m?: number }} player Joueur souris à capturer.
   */
  const catchPlayer = async (player) => {
    if (!player || !gameId || !playerPosition || isCatching || gameWinner) return;

    const distance = getDistanceInMeters(
      playerPosition.lat,
      playerPosition.lng,
      player.lat,
      player.lng
    );

    const locationUncertainty = getLocationUncertainty(playerPosition.accuracy_m, player.accuracy_m);
    if (distance > CATCH_RADIUS_METERS + locationUncertainty) return;

    setIsCatching(true);
    const { data: caughtPlayer, error } = await supabase
      .from('players')
      .update({ is_found: true })
      .eq('id', player.id)
      .eq('game_id', gameId)
      .eq('is_found', false)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Player catch:', error);
      setIsCatching(false);
      return;
    }

    if (caughtPlayer) {
      recordCaughtMouse(player.id);
      await checkAllMiceCaptured();
    }

    setIsCatching(false);
  };

  /**
   * Envoie le brouillon de message de chat en diffusion aux autres joueurs de la partie.
   * @param {React.FormEvent} event Événement de soumission du formulaire, utilisé pour empêcher le rechargement de la page.
   */
  const sendChatMessage = async (event) => {
    event.preventDefault();
    const text = chatDraft.trim();
    if (!text || !chatChannelRef.current) return;

    const aliasKey = `hunterzone_chat_alias_${gameId}`;
    const alias = sessionStorage.getItem(aliasKey) || `Player ${Math.floor(100 + Math.random() * 900)}`;
    sessionStorage.setItem(aliasKey, alias);
    const message = { alias, text: text.slice(0, 160), sentAt: Date.now() };
    setChatMessages((messages) => [...messages.slice(-3), message]);
    setChatDraft('');

    const { error } = await chatChannelRef.current.send({
      type: 'broadcast',
      event: 'chat-message',
      payload: message,
    });

    if (error) {
      console.error('Chat send:', error);
      return;
    }
  };

  const markedPlayers = players.filter((player) => player.lat != null && player.lng != null);
  const mapCenter = playerPosition ?? catPosition;
  const roleIcon = currentRole === 'cat' ? (Cat.src || Cat) : (MouseStyle.src || MouseStyle);
  const isMouseView = currentRole === 'mouse';

  return (
    <div className={`game-map-root${isMouseView ? ' game-map-root--mouse' : ''}`}>
      <div className="game-map-timer">
        <img
          className="game-map-role-icon"
          src={roleIcon}
          alt={currentRole === 'cat' ? 'Cat' : 'Mouse'}
        />
        <span className="game-map-timer-label">TIME LEFT</span>
        <span className="game-map-timer-value">{formatTime(timeLeft)} s</span>
      </div>

      {catchablePlayer && (
        <button
          className="game-map-catch-action"
          type="button"
          onClick={() => catchPlayer(catchablePlayer)}
          disabled={isCatching}
        >
          {isCatching ? 'Catching...' : `Catch ${catchablePlayer.name || `Player ${catchablePlayer.id}`}`}
        </button>
      )}

      {isInRestrictedZone && (
        <div className="game-map-zone-warning" role="alert">
          <strong>Safe zone exceeded</strong>
          <span>Return to the safe zone within {zoneWarningSeconds}s or you will be eliminated.</span>
        </div>
      )}

      {locationError && !playerPosition && (
        <div className="game-map-location-warning" role="status">
          <strong>{locationErrorCode === 2 ? 'Desktop location unavailable' : 'Location unavailable'}</strong>
          <span>
            {locationErrorCode === 2
              ? 'Enable location services for your browser or use a phone with GPS.'
              : 'Allow location access, then try again.'}
          </span>
          <button type="button" onClick={() => setLocationRetry((retry) => retry + 1)}>
            Retry location
          </button>
        </div>
      )}

      <section className="game-map-chat" aria-label="Anonymous game chat">
        <div className="game-map-chat-messages" aria-live="polite">
          {chatMessages.length === 0 && <span className="game-map-chat-empty">Anonymous chat</span>}
          {chatMessages.map((message, index) => (
            <div className="game-map-chat-message" key={`${message.sentAt}-${index}`}>
              <strong>{message.alias}</strong>
              <span>{message.text}</span>
            </div>
          ))}
        </div>
        <form className="game-map-chat-form" onSubmit={sendChatMessage}>
          <input
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            placeholder="Write a message..."
            maxLength={160}
            aria-label="Message"
          />
          <button type="submit" aria-label="Send message">Send</button>
        </form>
      </section>

      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={17}
        zoomControl={false}
        className="game-map-leaflet"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />

        {zoneCenter && (
          <Circle
            center={[zoneCenter.lat, zoneCenter.lng]}
            radius={SAFE_ZONE_RADIUS_METERS}
            pathOptions={{
              color: '#565968',
              fillColor: '#565968',
              fillOpacity: 0.08,
              weight: 3,
            }}
          />
        )}

        <RecenterOnPlayer position={playerPosition} />

        {markedPlayers.map((player) => (
          <Marker
            key={player.id}
            position={[player.lat, player.lng]}
            icon={createPulseIcon(player, player.role)}
            interactive={false}
            opacity={player.is_found ? 0.4 : 1}
          />
        ))}
      </MapContainer>

      <div className="game-map-player-panel">
        <div className="game-map-player-list">
          {players.filter((player) => player.id !== playerId).map((player) => {
            const hasPosition = player.lat != null && player.lng != null;
            const distance = hasPosition
              ? getDistanceInMeters(catPosition.lat, catPosition.lng, player.lat, player.lng)
              : 0;
            const rotation = hasPosition
              ? getBearingAngle(catPosition.lat, catPosition.lng, player.lat, player.lng)
              : 0;

            return (
              <div
                key={player.id}
                className="player-card"
                style={{
                  opacity: player.is_found ? 0.5 : 1,
                }}
              >
                <img
                  className="player-card-avatar"
                  src={getAvatarDataUri(player)}
                  alt={player.name || `Player ${player.id}`}
                />

                <div className="player-card-meta">
                  <div className="player-card-name">
                    {player.name || `Player ${player.id}`}
                  </div>
                  <div className="player-card-distance">
                    {player.is_found ? 'Captured' : hasPosition ? getDistanceLabel(distance) : 'Location unknown'}
                  </div>
                </div>

                {!player.is_found && hasPosition && (
                  <div className="direction-indicator">
                    <img src={HandIcon.src || HandIcon} alt="Direction" style={{ transform: `rotate(${rotation}deg)` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}