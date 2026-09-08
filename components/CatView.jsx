import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import Cat from '../assets/icons/Cat(Hunter).svg';
import MouseStyle from '../assets/icons/mouse-style.svg';
import HandIcon from '../assets/icons/hand.svg';
import { getAvatarDataUri } from './ScoreBoard';
import { supabase } from '../src/lib/supabase';

const GAME_DURATION_SECONDS = 600;
const CATCH_RADIUS_METERS = 5;
const SAFE_ZONE_RADIUS_METERS = 500;
const ZONE_WARNING_SECONDS = 5;
const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 30000,
  maximumAge: 10000,
};


// Icônes personnalisées pour les marqueurs
const catIcon = L.divIcon({
  html: '<div style="font-size: 24px;">🐱</div>',
  className: 'custom-marker',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Rayon de la Terre en mètres
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function getBearingAngle(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180));
  const x =
    Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
    Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos((lon2 - lon1) * (Math.PI / 180));
  return ((Math.atan2(y, x) * (180 / Math.PI)) + 360) % 360;
}

function getDistanceLabel(distanceInMeters) {
  if (distanceInMeters >= 1000) {
    return `${(distanceInMeters / 1000).toFixed(1)} km`;
  }
  return `${distanceInMeters} m`;
}

function createPulseIcon(player, role) {
  const avatar = getAvatarDataUri(player);
  const color = role === 'cat' ? '#f97316' : '#60a5fa';

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
  const hasEndedRef = useRef(false);
  const zoneCenterRef = useRef(null);
  const zoneWarningTimerRef = useRef(null);
  const zoneCountdownTimerRef = useRef(null);

  const [players, setPlayers] = useState([]);
  const [gameId, setGameId] = useState(null);
  const [gameStartedAt, setGameStartedAt] = useState(null);
  const playerId = typeof window !== 'undefined'
    ? Number(sessionStorage.getItem('hunterzone_player_id'))
    : null;

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
      const { data, error } = await supabase
        .from('players')
        .select('id, name, role, lat, lng, is_found, game_id')
        .eq('game_id', id);

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

    const refreshPlayers = async () => {
      const { data, error } = await supabase
        .from('players')
        .select('id, name, role, lat, lng, is_found, game_id')
        .eq('game_id', gameId);

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
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}`
      }, async () => {
        const { data } = await supabase
          .from('players')
          .select('id, name, role, lat, lng, is_found, game_id')
          .eq('game_id', gameId);
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

    const refreshInterval = setInterval(refreshPlayers, 5000);

    return () => {
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, [gameId, playerId]);

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
    router.replace(`/endGame?code=${encodeURIComponent(code)}&winner=${gameWinner}`);
  }, [gameWinner, code, router]);

  // Suivi GPS en direct pour le Chat
  useEffect(() => {
    if (!gameId || !playerId || !('geolocation' in navigator)) return;

    const savePosition = async (position) => {
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

    const handleLocationError = (error) => {
      if (error.code === error.PERMISSION_DENIED || error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
        setLocationError(true);
        setLocationErrorCode(error.code);
      }
      console.error('Location error:', error);
    };

    const syncCurrentPlayerPosition = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const position = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          savePosition(position);
        },
          handleLocationError,
          GEOLOCATION_OPTIONS
      );
    };

    syncCurrentPlayerPosition();

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const position = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        savePosition(position);
      },
      handleLocationError,
      GEOLOCATION_OPTIONS
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [gameId, playerId, locationRetry]);

  // Gestion du décompte du Timer
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

  // Formater le temps restant (MM:SS)
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

      return getDistanceInMeters(
        playerPosition.lat,
        playerPosition.lng,
        player.lat,
        player.lng
      ) <= CATCH_RADIUS_METERS;
    })
    : null;

  const catchPlayer = async (player) => {
    if (!player || !gameId || !playerPosition || isCatching || gameWinner) return;

    const distance = getDistanceInMeters(
      playerPosition.lat,
      playerPosition.lng,
      player.lat,
      player.lng
    );

    if (distance > CATCH_RADIUS_METERS) return;

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

    if (caughtPlayer) await checkAllMiceCaptured();

    setIsCatching(false);
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
              ? 'Enable location services for your browser, or use a phone with GPS.'
              : 'Allow location access, then try again.'}
          </span>
          <button type="button" onClick={() => setLocationRetry((retry) => retry + 1)}>
            Retry location
          </button>
        </div>
      )}

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

        {currentRole === 'cat' && (
          <>
            <Marker position={[catPosition.lat, catPosition.lng]} icon={catIcon} interactive={false} />
            <Circle
              center={[catPosition.lat, catPosition.lng]}
              radius={5}
              pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15 }}
            />
          </>
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
          {players.map((player) => {
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