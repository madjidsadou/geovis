// Initialize the map
var map = new L.Map('map', {
  center: [50, 5.3],
  maxBounds: [[45.8, 5.2], [47.5, 9]],
  minZoom: 8,
  maxZoom: 12,
  zoom: 8
});

// Set initial message in the infoDiv when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
  const infoDiv = document.getElementById('inforparc');
  infoDiv.innerHTML = '<p>- Veuillez sélectionner un parc si dessus ou cliquer sur le parc qui vous interesse sur la carte -<br> - Please select a park above or click on the park you are interested in on the map -</p>';
});

// Initialize Swiper
const swiper = new Swiper('.swiper-container', {});

// Define tile layers
var osmLayer = L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
});
var esriImagery = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: '&copy; <a href="http://www.esri.com">Esri</a>, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

// Add OpenStreetMap layer to the map
osmLayer.addTo(map);

// Define base layers
var baseLayers = {
  "OpenStreetMap": osmLayer,
  "Photos aériennes ESRI": esriImagery,
};

// Handle preloader fade-out on window load
window.addEventListener('load', () => {
  setTimeout(() => {
    const preloader = document.getElementById('preloader');
    preloader.classList.add('fade-out');
    setTimeout(() => {
      preloader.style.display = 'none';
    }, 1000);
  }, 4000);
});

// Function to handle each feature in the GeoJSON layer
function onEachFeature(feature, layer) {
  const images = feature.properties.pop || [];
  const popupContent = `
    <div class="parc-popup">
      <h3>${feature.properties.name}</h3>
      <div class="swiper-container">
        <div class="swiper-wrapper">
          ${images.map(image => `
            <div class="swiper-slide">
              <img src="photo/${image}" alt="${feature.properties.name}" class="popup-image">
            </div>
          `).join('')}
        </div>
        <div class="swiper-pagination"></div>
        <div class="swiper-button-next"></div>
        <div class="swiper-button-prev"></div>
      </div>
    </div>
  `;
  layer.bindPopup(popupContent);

  // Bind tooltip to the layer
  layer.bindTooltip(feature.properties.name, {
    permanent: false,
    direction: 'top',
    className: 'parc-tooltip'
  });

  // Handle tooltip visibility based on zoom level
  map.on('zoomend', function() {
    const currentZoom = map.getZoom();
    if (currentZoom > 9) {
      layer.unbindTooltip();
    } else {
      layer.bindTooltip(feature.properties.name, {
        permanent: false,
        direction: 'top',
        className: 'parc-tooltip'
      });
    }
  });

  // Define new max bounds for the map
  const originalMaxBounds = map.options.maxBounds;
  const newMaxBounds = [
    [originalMaxBounds.getSouthWest().lat - 0.5, originalMaxBounds.getSouthWest().lng - 0.5],
    [originalMaxBounds.getNorthEast().lat + 0.9, originalMaxBounds.getNorthEast().lng + 0.9]
  ];

  // Handle click event on the layer
  layer.on('click', function() {
    map.setMaxBounds(newMaxBounds);
    layer.openPopup();
    new Swiper('.swiper-container', {
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
    });
  });

  // Revert max bounds when popup is closed
  map.on('popupclose', function() {
    map.setMaxBounds(originalMaxBounds);
  });
}

// Add GeoJSON layer to the map
L.geoJSON(parcs, {
  onEachFeature: onEachFeature
}).addTo(map);

// Loop through each feature in the parcs GeoJSON
for (var k in parcs.features) {
  var parc = parcs.features[k];
  var type_parc = parc.properties.type;

  if (parc.geometry.type === "Polygon") {
    var coordinates = parc.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
    var polygon = L.polygon(coordinates, {
      color: 'green',
      fillOpacity: 0.5
    }).addTo(map);
    onEachFeature(parc, polygon);
  } else if (parc.geometry.type === "MultiPolygon") {
    parc.geometry.coordinates.forEach(polyCoords => {
      var coordinates = polyCoords[0].map(coord => [coord[1], coord[0]]);
      var polygon = L.polygon(coordinates, {
        color: 'green',
        fillOpacity: 0.5
      }).addTo(map);
      onEachFeature(parc, polygon);
    });
  }
}

// Define overlays
var overlays = {};
L.control.layers(baseLayers, overlays).addTo(map);

// Function to display park information
async function displayParkInfo(parkIndex) {
  const park = parcs.features[parkIndex];
  const parkName = park.properties.name;
  const cantonName = park.properties.canton;
  const parcArea = park.properties.area;
  const website = park.properties.website;
  const coordinates = park.geometry.coordinates[0][0];
  const description = park.properties.info;

  const temperature = await fetchTemperature(coordinates[0][1], coordinates[0][0]);
  const weather = await fetchwether(coordinates[0][1], coordinates[0][0]);

  const parkImages = parcs.features
    .filter(feature => feature.properties.name.toLowerCase() === parkName.toLowerCase())
    .map(feature => feature.properties.images)
    .flat();

  const imagesHtml = parkImages.map(image => `<img src="logoparcs/${image}" alt="${parkName}" style="width: 100px; height: auto; margin: 5px;">`).join('');
  const infoDiv = document.getElementById('inforparc');
  infoDiv.innerHTML = `
    <h3>${parkName}</h3>
    <p>${description}</p>
    <p>Canton: ${cantonName}</p>
    <p>Surface: ${parcArea.toFixed(2)} km²</p>
    <p>Temperature: ${temperature !== null ? `${temperature}°C` : "Temperature not available"}, ${`${weather}`} </p>
    <p><a href="${website}" target="_blank">Visit Park Website for more information</a></p>
    <div>${imagesHtml}</div>
    <button onclick="reloadParksList()">Back to map zoom</button>
  `;
  zoomToParkPolygon(coordinates);
}

// Function to zoom to park polygon
function zoomToParkPolygon(coordinates) {
  const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
  const polygon = L.polygon(latLngs);
  map.flyToBounds(polygon.getBounds(), {
    animate: true,
    duration: 1.5
  });
}

// Function to reload parks list
function reloadParksList() {
  const inforparc = document.getElementById('inforparc');
  if (inforparc) inforparc.innerHTML = '';
  zoomedIn = false;
  unselectDropdown();
}

// Function to unselect dropdown
function unselectDropdown() {
  const dropdown = document.querySelector('.recherche select');
  if (dropdown) {
    dropdown.value = '';
  }
  const originalBounds = [[45.8, 4.6], [47.558, 10.432]];
  map.fitBounds(originalBounds);
}

// Define parks data
const parks = {
  1: { name: "Parc naturel régional Jura vaudois", coords: [46.5068, 6.2965] },
  2: { name: "Parc naturel régional Gruyère Pays-d'Enhaut", coords: [46.48492, 7.05013] },
  3: { name: "Parc naturel du Jorat", coords: [46.57360, 6.67149] },
  4: { name: "Parc naturel régional Chasseral", coords: [47.253183, 6.997175] },
  5: { name: "Naturpark Gantrisch", coords: [46.76153, 7.42547] },
  6: { name: "Parc naturel régional du Haut-Jura", coords: [46.42585, 5.89408] },
  7: { name: "Naturpark Diemtigtal", coords: [46.6234, 7.5239] },
  8: { name: "Landschaftspark Binntal", coords: [46.4680, 8.1805] },
  9: { name: "Parc du Doubs", coords: [47.3607, 7.0694] },
  10: { name: "Parc naturel régional Vallée du Trient", coords: [46.0619, 6.9382] },
};

// Function to fetch temperature data
async function fetchTemperature(lat, lon) {
  const apiKey = 'eafce9179dc5378cf926ff3f7e5f4e7b';
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.main.temp;
  } catch (error) {
    console.error("Error fetching temperature:", error);
    return null;
  }
}

// Function to fetch weather data
async function fetchwether(lat, lon) {
  const apiKey = 'eafce9179dc5378cf926ff3f7e5f4e7b';
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.weather[0].description;
  } catch (error) {
    console.error("Error fetching temperature:", error);
    return null;
  }
}

// Handle dropdown change event
const dropdown = document.querySelector('.recherche select');
dropdown.addEventListener('change', function () {
  const selectedValue = dropdown.value;
  const infoDiv = document.getElementById('inforparc');
  infoDiv.innerHTML = '';

  if (!selectedValue || !parks[selectedValue]) {
    infoDiv.innerHTML = '<p>- Veuillez sélectionner un parc si dessus ou cliquer sur le parc qui vous interesse sur la carte -</p>';
    return;
  }

  const parkIndex = selectedValue - 1;
  displayParkInfo(parkIndex);
});

// Define marker icons
var markerIcons = {
  "camp": L.icon({ iconUrl: 'icone/camping.png', iconSize: [30, 30] }),
  "hotel": L.icon({ iconUrl: 'icone/hotel-restaurant.png', iconSize: [30, 30] }),
  "parking": L.icon({ iconUrl: 'icone/parking.png', iconSize: [40, 40] }),
  "ski": L.icon({ iconUrl: 'icone/ski.png', iconSize: [30, 30] }),
  "TP": L.icon({ iconUrl: 'icone/tp.png', iconSize: [30, 30] }),
  "hike": L.icon({ iconUrl: 'icone/hike.png', iconSize: [40, 40] })
};

// Function to add markers based on zoom level
function addMarkers() {
  var zoomLevel = map.getZoom();
  ROI.features.forEach(function (feature) {
    const [lng, lat] = feature.geometry.coordinates;
    const { type, nom } = feature.properties;
    var zoomRange = [10, 12];

    if (zoomLevel >= zoomRange[0] && zoomLevel <= zoomRange[1]) {
      if (!feature.marker) {
        if (type === "TP") {
          feature.randomValue = Math.floor(Math.random() * 15) + 1;
        } else if (type === "parking") {
          feature.randomValue = Math.floor(Math.random() * 50) + 1;
        }

        feature.marker = L.marker([lat, lng], {
          icon: markerIcons[type] || L.icon({ iconUrl: 'default.png', iconSize: [30, 30] })
        }).addTo(map);

        if (type !== "TP" && type !== "parking") {
          feature.marker.bindTooltip(nom, {
            permanent: false,
            direction: 'top',
            className: 'marker-tooltip'
          });
        }

        feature.marker.on('mouseover', function () {
          if (type === "TP") {
            feature.marker.bindPopup(`<b>${nom}</b><br>Next bus: ${feature.randomValue} minutes`).openPopup();
          } else if (type === "parking") {
            feature.marker.bindPopup(`<b>${nom}</b><br>Parking spots left: ${feature.randomValue}`).openPopup();
          }
        });

        feature.marker.on('mouseout', function () {
          feature.marker.closePopup();
        });
      }
    } else {
      if (feature.marker) {
        map.removeLayer(feature.marker);
        feature.marker = null;
      }
    }
  });
}

// Initial markers setup based on the zoom level
addMarkers();

// Update markers when zoom level changes
map.on('zoomend', function () {
  addMarkers();
});

// Add coordinates display control to the map
const coordDiv = L.control({ position: 'bottomleft' });

coordDiv.onAdd = function () {
  const div = L.DomUtil.create('div', 'coordinates-display');
  div.style.backgroundColor = 'white';
  div.style.padding = '5px';
  div.style.border = '1px solid #ccc';
  div.style.borderRadius = '5px';
  div.style.fontSize = '14px';
  div.style.minWidth = '120px';
  return div;
};

coordDiv.addTo(map);

// Update coordinates display on mouse move
map.on('mousemove', function (e) {
  const { lat, lng } = e.latlng;
  const formattedLat = lat.toFixed(5);
  const formattedLng = lng.toFixed(5);
  document.querySelector('.coordinates-display').innerHTML = 
    `Coordinates: ${formattedLat}, ${formattedLng}`;
});