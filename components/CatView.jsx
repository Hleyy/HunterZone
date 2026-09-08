import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/global.css';
import Cat from '../assets/icons/Cat(Hunter).svg';


// Icônes personnalisées pour les marqueurs
const catIcon = L.divIcon({
  html: '<div style="font-size: 24px;">🐱</div>',
  className: 'custom-marker',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const mouseIcon = L.divIcon({
  html: '<div style="font-size: 24px;">🐭</div>',
  className: 'custom-marker',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

// Fonctions mathématiques

// Formule de Haversine (Retourne la distance en mètres)
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

// Calcul de l'azimut/bearing pour la direction cardinale (N, NE, E, SE, S, SO, O, NO)
function getBearingDirection(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180));
  const x =
    Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
    Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos((lon2 - lon1) * (Math.PI / 180));
  const bearing = ((Math.atan2(y, x) * (180 / Math.PI)) + 360) % 360;

  const directions = ['N ⬆️', 'NE ↗️', 'E ➡️', 'SE ↘️', 'S ⬇️', 'SO ↙️', 'O ⬅️', 'NO ↖️'];
  return directions[Math.round(bearing / 45) % 8];
}

export default function CatGameView() {
  // Position initiale du Chat
  const [catPosition, setCatPosition] = useState({ lat: 48.8566, lng: 2.3522 });
  const [timeLeft, setTimeLeft] = useState(600); // Timer 10 minutes (600 secondes)

  // Données de simulation des Souris
  const [mice, setMice] = useState([
    { id: '1', name: 'Thomas', lat: 48.8572, lng: 2.3530, isFound: false },
    { id: '2', name: 'Flo', lat: 48.8550, lng: 2.3510, isFound: false },
    { id: '3', name: 'Nami', lat: 48.8580, lng: 2.3500, isFound: true }
  ]);

  // Suivi GPS en direct pour le Chat
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setCatPosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => console.error("Erreur GPS :", err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Gestion du décompte du Timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  // Formater le temps restant (MM:SS)
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#DC712B' }}>
      
      {/* Bandeau supériéur: Timer*/}
        <div style={{
          position: 'absolute',
          top: '50px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: '#DC7A2B',
          padding: '10px 24px',
          borderRadius: '20px',
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          color: '#fff',
          height: '86px',
          width: '200px',
          textAlign: 'center',
          fontFamily: '"AMCAP Eternal"',
          fontSize: '40px',
          fontStyle: 'normal',
          fontWeight: 400,
          lineheight: 'normal',

        }}> 
          <img 
            style={{
              position: 'absolute',
              top: '-60px',
              height: '66px',
              width: '133px',
            }}
            src={Cat} 
            alt="Cat" 
          />
          <span style={{ fontSize: '0.8rem', marginTop: '12px', opacity: 0.9 }}>
            TIME LEFT
          </span>

          <span style={{ 
            fontSize: '1.4rem', 
            fontWeight: 'bold', 
            fontFamily: 'AMCAP Eternal',
          }}>
            {formatTime(timeLeft)} s
          </span>
        </div>

        

      {/* Carte */}
      <MapContainer
        center={[catPosition.lat, catPosition.lng]}
        zoom={17}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />

        {/* Marqueur du Chat (Joueur courant) */}
        <Marker position={[catPosition.lat, catPosition.lng]} icon={catIcon}>
          <Popup><strong>Vous (Chat)</strong></Popup>
        </Marker>

        {/* Rayon visuel autour du chat */}
        <Circle
          center={[catPosition.lat, catPosition.lng]}
          radius={30}
          pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15 }}
        />

        {/* Marqueurs des Souris */}
        {mice.map((mouse) => (
          <Marker
            key={mouse.id}
            position={[mouse.lat, mouse.lng]}
            icon={mouseIcon}
            opacity={mouse.isFound ? 0.4 : 1}
          >
            <Popup>
              {mouse.name} {mouse.isFound ? '(Attrapé !)' : ''}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Panel droite : Scoreboard et boussole */}
      <div style={{
        position: 'absolute',
        right: '16px',
        top: '16px',
        bottom: '16px',
        width: '180px',
        zIndex: 1000,
        background: '#DC7A2B',
        borderRadius: '20px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        color: '#DC7A2B',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff'}}>Tracker Souris</h3>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {mice.map((mouse) => {
            const distance = getDistanceInMeters(catPosition.lat, catPosition.lng, mouse.lat, mouse.lng);
            const direction = getBearingDirection(catPosition.lat, catPosition.lng, mouse.lat, mouse.lng);

            return (
              <div
                key={mouse.id}
                style={{
                  background: mouse.isFound ? '#1e293b' : '#ffff',
                  padding: '12px',
                  borderRadius: '10px',
                  opacity: mouse.isFound ? 0.5 : 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>

                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                    {mouse.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} /> {mouse.isFound ? 'Capturé' : `${distance}m`}
                  </div>
                </div>

                {!mouse.isFound && (
                  <div style={{
                    background: '#565968',
                    padding: '6px 10px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    color: '#DC7A2B',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {direction}
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