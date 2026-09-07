function Player (name, role, isFound, isOwnerParty, lat, lng){
    this.name = name;
    this.role = role;
    this.isFound = isFound;
    this.isOwnerParty = isOwnerParty;;
    this.lat = lat;
    this.lng = lng;
}


function roles (isCat){
	if (cat == true){
		Player.role = cat;
	} else {
		Player.role = mouse;
	}
}

function isFound (isFound){
	if (isFound == true){
		Player.isFound = true;
	} else {
		Player.isFound = false;
	}
}

function isCat (Players){
	for (let i = 0; i < Players.getLength(); i ++){
        if (Players[i].role == cat){
            return Players[i];
        }
	}
}

//Fonction qui permet de trouver la localisation des joueurs (souris) afin de calculer 
//la distance qui sépare le chat des autres,
//Ce sera par la suite afficher sur un tableau à l'écran du chat.
function mouseFounder(Players){
    const Cat = isCat(Players);


	for (let i = 0; i < Players.getLength(); i ++){
		//Calcul de distance entre le joueur i et le chat
        getDistanceFromLatLonInKm(Players[i].lat,Players[i].lng,Cat.lat,Cat[i].lng);

	}
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon de la Terre en km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}   

//Montrer sur la boussole su joueur dans quel direction se trouve chaque joueur
function showDirection (Players){
    const Cat = isCat(Players);
    
    for (let i = 0; i < Players.getLength(); i ++){
        calculerDirection(Players[i].lat,Players[i].lng,Cat.lat,Cat[i].lng);
	}
}
function calculerDirection(x1, y1, x2, y2) {
    // Calcul de l'angle en radians puis en degrés
    let angleDeg = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    // Normalisation entre 0 et 360
    return (angleDeg + 360) % 360;
}
