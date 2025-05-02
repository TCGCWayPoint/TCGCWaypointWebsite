// === Map Configuration and State ===
const MAP_CONFIG = {
  bounds: L.latLngBounds([8.0600, 123.7500], [8.0700, 123.7630]),
  defaultCoords: [8.065151, 123.756515],
  zoom: {
    min: 10,
    max: 23,
    default: 19
  },
  tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© OpenStreetMap contributors'
};

const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 15000,
  timeout: 10000
};
const GEOLOCATION_TOTAL_TIMEOUT = 30000;
const MIN_ACCURACY_THRESHOLD = 50;

const state = {
  currentLocationMarker: null,
  currentLocationCircle: null,
  searchableFeatures: [],
  highlightedMarker: null,
  geolocationWatchId: null,
  lastGoodLocation: null,
  map: null,
  routingControl: null,
  routingGraph: null,
  customRoute: null,
  geolocationRetryCount: 0,
  maxGeolocationRetries: 3,
  geolocationTimeout: null,
  lastGoodAccuracy: null,
  currentDestination: null,
  routingInProgress: false,
  currentFloor: '0',
  floorLayers: {},
  currentGeoJSON: null,
  startFeature: null,
  destinationFeature: null,
  startMarker: null,
  destinationMarker: null,
  labelLayer: null,
  floorData: {},
  stairs: [],
  labelsVisible: true // Added
};

// === Floor Name === 
const getFloorName = (floor) => {
  const floorMap = {
    '0': 'Ground Floor',
    '1': 'Second Floor',
    '2': 'Third Floor',
    // Add more floors as needed
  };
  return floorMap[floor] || `Level ${floor}`; // Fallback to "Level X" if not mapped
};

// === Map Initialization ===
const initMap = () => {
  state.map = L.map('map', {
    maxZoom: MAP_CONFIG.zoom.max,
    minZoom: MAP_CONFIG.zoom.min,
    maxBounds: MAP_CONFIG.bounds,
    maxBoundsViscosity: 1.0,
    preferCanvas: true
  }).setView(MAP_CONFIG.defaultCoords, MAP_CONFIG.zoom.default);

  L.tileLayer(MAP_CONFIG.tileUrl, {
    attribution: MAP_CONFIG.attribution,
    tileSize: 256,
    maxZoom: 20
  }).addTo(state.map);
};

// === Geolocation Handling ===
const startGeolocation = () => {
  if (state.geolocationTimeout) clearTimeout(state.geolocationTimeout);
  if (state.geolocationWatchId !== null) {
    navigator.geolocation.clearWatch(state.geolocationWatchId);
  }

  state.geolocationTimeout = setTimeout(() => {
    if (!state.lastGoodLocation) {
      handleGeolocationFallback();
    }
  }, GEOLOCATION_TOTAL_TIMEOUT);

  if (navigator.geolocation) {
    showMessage("Detecting your location...", 2000);

    state.geolocationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = position.coords.accuracy;
        const latlng = L.latLng(
          position.coords.latitude,
          position.coords.longitude
        );

        if (accuracy <= MIN_ACCURACY_THRESHOLD) {
          state.lastGoodLocation = {
            latlng: latlng,
            accuracy: accuracy,
            timestamp: position.timestamp
          };
          state.lastGoodAccuracy = accuracy;
          state.geolocationRetryCount = 0;

          updateCurrentLocation(latlng, accuracy);
          showMessage("Location found!", 2000);
        } else if (!state.lastGoodLocation) {
          state.lastGoodLocation = {
            latlng: latlng,
            accuracy: accuracy,
            timestamp: position.timestamp
          };
          showMessage("Low accuracy location - moving to improve", 2000);
        }
        updateRoutingButton();
      },
      (error) => {
        console.error('Geolocation error:', error);
        state.geolocationRetryCount++;

        let errorMessage = "Location error: ";
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += "Permission denied. Please enable location services";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += "Position unavailable. Please check your GPS signal";
            break;
          case error.TIMEOUT:
            errorMessage += "Request timed out. Please try again";
            break;
          default:
            errorMessage += "Unknown error occurred";
        }
        showMessage(errorMessage, 3000);

        if (state.geolocationRetryCount >= state.maxGeolocationRetries) {
          handleGeolocationFallback();
        } else {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const latlng = L.latLng(
                position.coords.latitude,
                position.coords.longitude
              );
              state.lastGoodLocation = {
                latlng: latlng,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
              };
              updateCurrentLocation(latlng, position.coords.accuracy);
            },
            () => handleGeolocationFallback(),
            {
              enableHighAccuracy: false,
              maximumAge: 30000,
              timeout: 5000
            }
          );
        }
      },
      GEOLOCATION_OPTIONS
    );
  } else {
    console.log('Geolocation not supported');
    showMessage("Geolocation not supported by your browser", 3000);
    handleGeolocationFallback();
  }
};

const updateCurrentLocation = (latlng, accuracy) => {
  if (state.currentLocationMarker) state.map.removeLayer(state.currentLocationMarker);
  if (state.currentLocationCircle) state.map.removeLayer(state.currentLocationCircle);

  if (accuracy < 1000) {
    state.currentLocationCircle = L.circle(latlng, {
      color: '#4285F4',
      fillColor: '#4285F4',
      fillOpacity: accuracy > 200 ? 0.1 : 0.2,
      radius: 1
    }).addTo(state.map);
  }

  const isPrecise = accuracy <= MIN_ACCURACY_THRESHOLD;

  state.currentLocationMarker = L.marker(latlng, {
    icon: L.divIcon({
      className: isPrecise ? 'current-location-marker' : 'current-location-marker approximate',
      html: isPrecise ? '' : '<div style="color:white;font-weight:bold;">?</div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    }),
    interactive: true,
    zIndexOffset: 1000
  }).addTo(state.map)
    .bindPopup(`<strong>${isPrecise ? 'Your Location' : 'Approximate Location'}</strong><br>
               Accuracy: ~${Math.round(accuracy)}m${isPrecise ? '' : '<br><small>For better accuracy, enable GPS</small>'}`);

  if (isPrecise || !state.map.getCenter().equals(MAP_CONFIG.defaultCoords)) {
    const currentZoom = state.map.getZoom();
    state.map.setView(latlng, currentZoom);
  }

  updateRoutingButton();
};

const handleGeolocationFallback = () => {
  showMessage("Getting your location... trying alternative methods", 2000);

  fetch('https://ipapi.co/json/')
    .then(response => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    })
    .then(data => {
      if (data.latitude && data.longitude) {
        const latlng = L.latLng(data.latitude, data.longitude);
        const accuracy = 5000;

        state.lastGoodLocation = {
          latlng: latlng,
          accuracy: accuracy,
          timestamp: Date.now(),
          source: 'ip'
        };

        updateCurrentLocation(latlng, accuracy);
        showMessage("Using approximate location based on your IP address");
        return;
      }
      throw new Error('No location data in IP response');
    })
    .catch(ipError => {
      console.log('IP geolocation failed:', ipError);
      const fallbackLocation = state.lastGoodLocation ?
        state.lastGoodLocation.latlng :
        L.latLng(MAP_CONFIG.defaultCoords[0], MAP_CONFIG.defaultCoords[1]);

      const fallbackAccuracy = state.lastGoodLocation ?
        state.lastGoodLocation.accuracy : 100;

      updateCurrentLocation(fallbackLocation, fallbackAccuracy);

      if (!state.lastGoodLocation) {
        showMessage("Using default location - enable location services for better accuracy");
      } else {
        showMessage(`Using last known location (accuracy: ~${Math.round(fallbackAccuracy)}m)`);
      }
    });
};

// === UI and Notifications ===
const showMessage = (message, duration = 3000) => {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.innerHTML = message;
    loadingElement.style.display = 'block';
    setTimeout(() => {
      loadingElement.style.display = 'none';
    }, duration);
  }

  const existingNotification = document.querySelector('.location-notification');
  if (existingNotification) {
    document.body.removeChild(existingNotification);
  }

  const notification = document.createElement('div');
  notification.className = 'location-notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, duration);
};

// === Search Functionality ===
const initSearch = () => {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  setupSearch(searchInput, searchResults, null, (result, displayName) => {
    zoomToFeature(result, false);
  });
};

// === Helper Function for Markers ===
const createCustomMarker = (latlng, isStart) => {
  return L.marker(latlng, {
    icon: L.divIcon({
      className: isStart ? 'start-marker' : 'end-marker',
      html: `
        <div style="
          background: ${isStart ? '#32CD32' : '#FF0000'};
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 5px rgba(0,0,0,0.3);
          display: flex;
          justify-content: center;
          align-items: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
        ">
          ${isStart ? 'A' : 'B'}
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    }),
    zIndexOffset: 1500
  });
};

// === Search Functionality ===
const initRoutePlannerSearch = () => {
  const searchFields = document.querySelectorAll('.search-field input');
  if (searchFields.length !== 2) return;

  const startInput = searchFields[0];
  const destinationInput = searchFields[1];
  const startResults = startInput.parentElement.querySelector('.route-search-results');
  const destinationResults = destinationInput.parentElement.querySelector('.route-search-results');
  const startOptions = startInput.parentElement.querySelector('.route-options');
  const destinationOptions = destinationInput.parentElement.querySelector('.route-options');

  setupSearch(startInput, startResults, startOptions, (result, displayName) => {
    state.startFeature = result;
    if (state.startMarker) {
      state.map.removeLayer(state.startMarker);
      state.startMarker = null;
    }
    if (state.highlightedMarker) {
      state.map.removeLayer(state.highlightedMarker);
      state.highlightedMarker = null;
    }
    const latlng = getFeatureLatLng(result);
    if (latlng) {
      state.startMarker = createCustomMarker(latlng, true).addTo(state.map);
    }
    zoomToFeature(result, true);
  });

  setupSearch(destinationInput, destinationResults, destinationOptions, (result, displayName) => {
    state.destinationFeature = result;
    if (state.destinationMarker) {
      state.map.removeLayer(state.destinationMarker);
      state.destinationMarker = null;
    }
    if (state.highlightedMarker) {
      state.map.removeLayer(state.highlightedMarker);
      state.highlightedMarker = null;
    }
    const latlng = getFeatureLatLng(result);
    if (latlng) {
      state.destinationMarker = createCustomMarker(latlng, false).addTo(state.map);
    }
    zoomToFeature(result, true);
  });

  const getFeatureLatLng = (feature) => {
    if (feature.geometry.type === 'Point') {
      return L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
    } else if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      const midIndex = Math.floor(coords.length / 2);
      return L.latLng(coords[midIndex][1], coords[midIndex][0]);
    } else if (feature.geometry.type === 'Polygon') {
      const coords = feature.geometry.coordinates[0];
      const midIndex = Math.floor(coords.length / 2);
      return L.latLng(coords[midIndex][1], coords[midIndex][0]);
    }
    return null;
  };

  const useMyLocationBtn = startOptions.querySelector('.use-my-location');
  if (useMyLocationBtn) {
    useMyLocationBtn.addEventListener('click', () => {
      if (!state.lastGoodLocation) {
        showMessage("Detecting your location...", 2000);
        startGeolocation();

        let attempts = 0;
        const maxAttempts = 30;
        const checkLocation = setInterval(() => {
          attempts++;
          if (state.lastGoodLocation) {
            clearInterval(checkLocation);
            setLocationFeature();
          } else if (attempts >= maxAttempts) {
            clearInterval(checkLocation);
            showMessage("Unable to detect location. Please enable location services");
          }
        }, 1000);

        return;
      }

      setLocationFeature();

      function setLocationFeature() {
        const locationFeature = {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [state.lastGoodLocation.latlng.lng, state.lastGoodLocation.latlng.lat]
          },
          properties: {
            name: "Your Location",
            level: state.currentFloor
          }
        };

        state.startFeature = locationFeature;
        startInput.value = "Your Location";
        if (state.startMarker) {
          state.map.removeLayer(state.startMarker);
          state.startMarker = null;
        }
        if (state.highlightedMarker) {
          state.map.removeLayer(state.highlightedMarker);
          state.highlightedMarker = null;
        }
        state.startMarker = createCustomMarker(state.lastGoodLocation.latlng, true).addTo(state.map);
        zoomToFeature(locationFeature, true);
        startOptions.style.display = 'none';
        startResults.innerHTML = '';
      }
    });
  }

  const setupDropMapPins = (input, options, isStart) => {
    const dropPinsBtn = options.querySelector('.drop-map-pins');
    if (dropPinsBtn) {
      dropPinsBtn.addEventListener('click', () => {
        options.style.display = 'none';
        showMessage(`Click on the map to set ${isStart ? 'starting point' : 'destination'}`);

        state.map.once('click', (e) => {
          const clickedPoint = {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [e.latlng.lng, e.latlng.lat]
            },
            properties: {
              name: isStart ? "Start Pin" : "Destination Pin",
              level: state.currentFloor
            }
          };

          if (isStart) {
            state.startFeature = clickedPoint;
            input.value = "Start Pin";
            if (state.startMarker) {
              state.map.removeLayer(state.startMarker);
              state.startMarker = null;
            }
            if (state.highlightedMarker) {
              state.map.removeLayer(state.highlightedMarker);
              state.highlightedMarker = null;
            }
            state.startMarker = createCustomMarker(e.latlng, true).addTo(state.map);
          } else {
            state.destinationFeature = clickedPoint;
            input.value = "Destination Pin";
            if (state.destinationMarker) {
              state.map.removeLayer(state.destinationMarker);
              state.destinationMarker = null;
            }
            if (state.highlightedMarker) {
              state.map.removeLayer(state.highlightedMarker);
              state.highlightedMarker = null;
            }
            state.destinationMarker = createCustomMarker(e.latlng, false).addTo(state.map);
          }

          zoomToFeature(clickedPoint, true);
        });
      });
    }
  };

  setupDropMapPins(startInput, startOptions, true);
  setupDropMapPins(destinationInput, destinationOptions, false);
};

const setupSearch = (inputElement, resultsContainer, optionsContainer, onSelect) => {
  if (!inputElement || !resultsContainer) return;

  inputElement.addEventListener('focus', () => {
    if (optionsContainer) {
      optionsContainer.style.display = 'block';
    }
  });

  inputElement.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    resultsContainer.innerHTML = '';
    if (optionsContainer) {
      optionsContainer.style.display = query.length < 2 ? 'block' : 'none';
    }

    if (query.length < 2) return;

    const results = state.searchableFeatures.filter(feature => {
      const roomName = feature.properties?.room?.toLowerCase() || '';
      const pathwayName = feature.properties?.pathway?.toLowerCase() || '';
      const buildingName = feature.properties?.building === 'yes' ? 'building' : '';
      const name = feature.properties?.name?.toLowerCase() || '';
      const user = feature.properties?.user || '';

      if (user === 'Timmy_Tesseract' || user === 'TheMonroeMapper') {
        return false;
      }

      return roomName.includes(query) ||
             pathwayName.includes(query) ||
             buildingName.includes(query) ||
             name.includes(query);
    });

    if (results.length === 0) {
      resultsContainer.innerHTML = '<div class="search-result-item">No results found</div>';
      return;
    }

    results.forEach(result => {
      const item = document.createElement('div');
      item.className = 'search Peterborough';
      let displayName = '';
      if (result.properties?.room) {
        displayName = result.properties.room;
      } else if (result.properties?.pathway) {
        displayName = result.properties.pathway;
      } else if (result.properties?.building === 'yes') {
        displayName = 'Building';
      } else if (result.properties?.name) {
        displayName = result.properties.name;
      }

      item.textContent = displayName;
      item.addEventListener('click', () => {
        onSelect(result, displayName);
        resultsContainer.innerHTML = '';
        if (optionsContainer) {
          optionsContainer.style.display = 'none';
        }
        inputElement.value = displayName;
      });
      resultsContainer.appendChild(item);
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-field') &&
        !e.target.closest('.route-search-results') &&
        !e.target.closest('.route-options') &&
        !e.target.closest('.search-container')) {
      resultsContainer.innerHTML = '';
      if (optionsContainer) {
        optionsContainer.style.display = 'none';
      }
    }
  });
};

const zoomToFeature = (feature, skipHighlight = false) => {
  if (!state.map) return;

  if (state.highlightedMarker) {
    state.map.removeLayer(state.highlightedMarker);
    state.highlightedMarker = null;
  }

  let center;
  if (feature.geometry.type === 'Point') {
    center = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
  } else if (feature.geometry.type === 'LineString') {
    const coords = feature.geometry.coordinates;
    const midIndex = Math.floor(coords.length / 2);
    center = [coords[midIndex][1], coords[midIndex][0]];
  } else if (feature.geometry.type === 'Polygon') {
    const coords = feature.geometry.coordinates[0];
    const midIndex = Math.floor(coords.length / 2);
    center = [coords[midIndex][1], coords[midIndex][0]];
  }

  if (center) {
    if (!skipHighlight) {
      state.highlightedMarker = L.marker(center, {
        icon: L.divIcon({
          className: 'marker-highlight',
          html: '<div style="background:#FF5722;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.5)"></div>',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        }),
        zIndexOffset: 2000
      }).addTo(state.map);

      if (feature.properties?.room || feature.properties?.pathway) {
        const popupContent = feature.properties.room || feature.properties.pathway;
        state.highlightedMarker.bindPopup(`<strong>${popupContent}</strong>`).openPopup();
      }
    }

    state.map.setView(center, 19);
  }

  state.currentDestination = feature;
  updateRoutingButton();
};

// === NEW: Preload All Floor Data ===
const preloadFloorData = async () => {
  const floors = ['0', '1', '2'];
  state.floorData = {};
  state.stairs = [];

  for (const floor of floors) {
    try {
      const response = await fetch(`floor_levels/Level${floor}.json`);
      const geojsonData = await response.json();
      state.floorData[floor] = geojsonData.features;

      geojsonData.features.forEach(feature => {
        if (feature.properties?.highway === 'steps' && feature.properties?.level) {
          const levels = feature.properties.level.split(';');
          state.stairs.push({
            feature,
            levels,
            floor
          });
        }
      });
    } catch (error) {
      console.error(`Error loading floor ${floor} data:`, error);
      showMessage(`Failed to load floor ${floor} data`, 3000);
    }
  }
  console.log('Loaded stairs:', state.stairs); // DEBUG: Check stair features
  if (state.stairs.length === 0) {
    showMessage("Warning: No stair features found in GeoJSON files. Multi-floor routing may not work.", 5000);
  }
};

// === Floor Switching and Data Loading ===
const loadCampusData = async (floor = '0', preserveMarkers = false) => {
  try {
    if (state.currentGeoJSON) {
      state.map.removeLayer(state.currentGeoJSON);
    }
    if (state.labelLayer) {
      state.map.removeLayer(state.labelLayer);
      state.labelLayer = null;
    }

    if (Object.keys(state.floorData).length === 0) {
      await preloadFloorData();
    }

    const geojsonData = {
      type: 'FeatureCollection',
      features: state.floorData[floor]
    };

    state.currentFloor = floor;

    // Modified: Add level check for Level1 (floor = '1') and Level2 (floor = '2')
    state.searchableFeatures = geojsonData.features.filter(f => {
      // For Level1 and Level2, only include features with matching level
      const isCorrectLevel = floor === '0' || (
        f.properties?.level === floor || 
        (f.properties?.level?.split(';').includes(floor))
      );
      return isCorrectLevel && (
        f.properties?.room ||
        f.properties?.pathway ||
        f.properties?.building === 'yes' ||
        f.properties?.name ||
        f.properties?.indoor === 'corridor' ||
        f.properties?.highway === 'service' ||
        f.properties?.highway === 'footway' ||
        f.properties?.highway === 'steps'
      );
    });

    const styleFunction = (feature) => {
      if (floor === '0') {
        if (feature.geometry.type === 'LineString') {
          if (feature.properties?.highway === 'steps') {
            return { color: '#FF4500', weight: 3, opacity: 0.8 };
          } else if (feature.properties?.indoor === 'corridor') {
            return { color: '#800080', weight: 1, opacity: 0.8 };
          } else {
            return { color: '#1E90FF', weight: 3, opacity: 0.8 };
          }
        }
        if (feature.geometry.type === 'Polygon') {
          return {
            color: feature.properties?.building === 'yes' ? '#555' : '#808080',
            weight: feature.properties?.building === 'yes' ? 2 : 1,
            fillColor: feature.properties?.building === 'yes' ? '#ddd' : '',
            fillOpacity: feature.properties?.building === 'yes' ? 0.5 : 0
          };
        }
        return {};
      }
    
      const isCorrectLevel = feature.properties?.level === floor || feature.properties?.level?.split(';').includes(floor);
      if (!isCorrectLevel) {
        return {
          color: '#333333',
          weight: 1,
          fillColor: '#222222',
          fillOpacity: 0.3,
          opacity: 0.5,
          interactive: false
        };
      }
    
      if (feature.geometry.type === 'LineString') {
        if (feature.properties?.highway === 'steps') {
          return { color: '#FF4500', weight: 3, opacity: 0.8 };
        } else if (feature.properties?.indoor === 'corridor') {
          return { color: '#800080', weight: 1, opacity: 0.8 };
        } else {
          return { color: '#1E90FF', weight: 3, opacity: 0.8 };
        }
      }
      if (feature.geometry.type === 'Polygon') {
        return {
          color: feature.properties?.building === 'yes' ? '#555' : '#808080',
          weight: feature.properties?.building === 'yes' ? 2 : 1,
          fillColor: feature.properties?.building === 'yes' ? '#ddd' : '',
          fillOpacity: feature.properties?.building === 'yes' ? 0.5 : 0
        };
      }
      return {};
    };

    state.currentGeoJSON = L.geoJSON(geojsonData, {
      style: styleFunction,
      pointToLayer: (feature, latlng) => {
        if (floor === '0') {
          if (feature.properties?.room || feature.properties?.pathway || feature.properties?.highway === 'steps') {
            return L.circleMarker(latlng, {
              radius: feature.properties?.highway === 'steps' ? 7 : 5,
              fillColor: feature.properties?.highway === 'steps' ? '#FF0000' : '#ff7800',
              color: '#000',
              weight: 1,
              opacity: 1,
              fillOpacity: 0.8
            });
          }
          return null;
        }

        const isCorrectLevel = feature.properties?.level === floor || feature.properties?.level?.split(';').includes(floor);
        if (!isCorrectLevel) return null;

        if (feature.properties?.room || feature.properties?.pathway || feature.properties?.highway === 'steps') {
          return L.circleMarker(latlng, {
            radius: feature.properties?.highway === 'steps' ? 7 : 5,
            fillColor: feature.properties?.highway === 'steps' ? '#FF0000' : '#ff7800',
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
          });
        }
        return null;
      },
      onEachFeature: (feature, layer) => {
        if (floor === '0') {
          if (feature.properties?.room || feature.properties?.pathway || feature.properties?.highway === 'steps') {
            layer.bindPopup(`<strong>${feature.properties.room || feature.properties.pathway || feature.properties.name || 'Stairs'}</strong>`);
          }
          return;
        }

        const isCorrectLevel = feature.properties?.level === floor || feature.properties?.level?.split(';').includes(floor);
        if (!isCorrectLevel) {
          layer.off('click');
          return;
        }

        if (feature.properties?.room || feature.properties?.pathway || feature.properties?.highway === 'steps') {
          layer.bindPopup(`<strong>${feature.properties.room || feature.properties.pathway || feature.properties.name || 'Stairs'}</strong>`);
        }
      }
    }).addTo(state.map);

    state.labelLayer = L.layerGroup();
    geojsonData.features.forEach(feature => {
      const isCorrectLevel = floor === '0' || feature.properties?.level === floor || feature.properties?.level?.split(';').includes(floor);
      if (!isCorrectLevel) return;

      let labelText = '';
      if (feature.properties?.room) {
        labelText = feature.properties.room;
      } else if (feature.properties?.pathway) {
        labelText = feature.properties.pathway;
      } else if (feature.properties?.building === 'yes') {
        labelText = feature.properties?.name || 'Building';
      } else if (feature.properties?.name) {
        labelText = feature.properties.name;
      } else if (feature.properties?.highway === 'steps') {
        labelText = feature.properties?.name || 'Stairs';
      }

      if (labelText) {
        let latlng;
        if (feature.geometry.type === 'Point') {
          latlng = L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
        } else if (feature.geometry.type === 'LineString') {
          const coords = feature.geometry.coordinates;
          const midIndex = Math.floor(coords.length / 2);
          latlng = L.latLng(coords[midIndex][1], coords[midIndex][0]);
        } else if (feature.geometry.type === 'Polygon') {
          const coords = feature.geometry.coordinates[0];
          const midIndex = Math.floor(coords.length / 2);
          latlng = L.latLng(coords[midIndex][1], coords[midIndex][0]);
        }

        if (latlng) {
          const labelMarker = L.marker(latlng, {
            icon: L.divIcon({
              className: 'room-label',
              html: `<span>${labelText}</span>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0]
            }),
            interactive: false,
            zIndexOffset: 500
          });
          state.labelLayer.addLayer(labelMarker);
        }
      }
    });
    if (state.labelsVisible) {
      state.labelLayer.addTo(state.map);
    }

    initSearch();
    state.routingGraph = createRoutingGraph(Object.values(state.floorData).flat());
    state.currentDestination = null;
    state.routingInProgress = false;
    updateRoutingButton();

    if (!preserveMarkers) {
      if (state.startMarker) {
        state.map.removeLayer(state.startMarker);
        state.startMarker = null;
      }
      if (state.destinationMarker) {
        state.map.removeLayer(state.destinationMarker);
        state.destinationMarker = null;
      }
    }

    if (state.highlightedMarker) {
      state.map.removeLayer(state.highlightedMarker);
      state.highlightedMarker = null;
    }

    document.querySelectorAll('.floor-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.floor === floor);
    });

    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  } catch (error) {
    console.error(`Error loading floor ${floor} data:`, error);
    showMessage(`Failed to load floor ${floor} data`, 3000);
  }
};

// === Routing and Pathfinding ===
const createRoutingGraph = (features) => {
  const graph = {};

  features.forEach(feature => {
    if (feature.geometry.type === 'LineString' &&
        (feature.properties?.indoor === 'corridor' ||
         feature.properties?.highway === 'service' ||
         feature.properties?.highway === 'footway')) {
      const coords = feature.geometry.coordinates;
      const points = coords.map(coord => ({
        latlng: L.latLng(coord[1], coord[0]),
        floor: feature.properties?.level || '0'
      }));

      for (let i = 0; i < points.length - 1; i++) {
        const from = `${points[i].latlng.toString()}_${points[i].floor}`;
        const to = `${points[i + 1].latlng.toString()}_${points[i + 1].floor}`;

        if (!graph[from]) graph[from] = [];
        if (!graph[to]) graph[to] = [];

        if (!graph[from].includes(to)) graph[from].push(to);
        if (!graph[to].includes(from)) graph[to].push(from);
      }
    }
  });

  state.stairs.forEach(stair => {
    const levels = stair.levels;
    const feature = stair.feature;
    let latlng;
    if (feature.geometry.type === 'Point') {
      latlng = L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
    } else if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      const midIndex = Math.floor(coords.length / 2);
      latlng = L.latLng(coords[midIndex][1], coords[midIndex][0]);
    }

    if (latlng) {
      levels.forEach(level => {
        const node = `${latlng.toString()}_${level}`;
        if (!graph[node]) graph[node] = [];
      });

      for (let i = 0; i < levels.length; i++) {
        for (let j = i + 1; j < levels.length; j++) {
          const nodeA = `${latlng.toString()}_${levels[i]}`;
          const nodeB = `${latlng.toString()}_${levels[j]}`;
          graph[nodeA].push(nodeB);
          graph[nodeB].push(nodeA);
        }
      }
    }
  });

  console.log('Routing graph:', graph); // DEBUG: Check graph nodes and connections
  return graph;
};

const findNearestPoint = (point, features, targetFloor) => {
  let nearestPoint = null;
  let minDistance = Infinity;

  features.forEach(feature => {
    if (feature.geometry.type === 'LineString' &&
        (feature.properties?.indoor === 'corridor' ||
         feature.properties?.highway === 'service' ||
         feature.properties?.highway === 'footway') &&
        (feature.properties?.level === targetFloor || feature.properties?.level?.split(';').includes(targetFloor))) {
      const coords = feature.geometry.coordinates;
      for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];
        const latLng = L.latLng(coord[1], coord[0]);
        const distance = point.distanceTo(latLng);
        if (distance < minDistance) {
          minDistance = distance;
          nearestPoint = { latlng: latLng, floor: targetFloor };
        }
      }
    }
    if (feature.properties?.highway === 'steps' &&
        feature.properties?.level?.split(';').includes(targetFloor)) {
      let latLng;
      if (feature.geometry.type === 'Point') {
        latLng = L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
      } else if (feature.geometry.type === 'LineString') {
        const coords = feature.geometry.coordinates;
        const midIndex = Math.floor(coords.length / 2);
        latLng = L.latLng(coords[midIndex][1], coords[midIndex][0]);
      }
      if (latLng) {
        const distance = point.distanceTo(latLng);
        if (distance < minDistance) {
          minDistance = distance;
          nearestPoint = {
            latlng: latLng,
            floor: targetFloor,
            stairName: feature.properties?.name || 'Stair'
          };
        }
      }
    }
  });

  console.log(`Nearest point to ${point} on floor ${targetFloor}:`, nearestPoint); // DEBUG: Check nearest point
  return nearestPoint;
};

const findPath = (graph, start, end) => {
  const distances = {};
  const previous = {};
  const nodes = new Set();

  Object.keys(graph).forEach(node => {
    distances[node] = node === start.toString() ? 0 : Infinity;
    nodes.add(node);
  });

  while (nodes.size > 0) {
    let closestNode = null;
    nodes.forEach(node => {
      if (closestNode === null || distances[node] < distances[closestNode]) {
        closestNode = node;
      }
    });

    if (distances[closestNode] === Infinity) break;
    if (closestNode === end.toString()) break;

    nodes.delete(closestNode);

    graph[closestNode].forEach(neighbor => {
      const alt = distances[closestNode] + (closestNode.split('_')[1] !== neighbor.split('_')[1] ? 10 : 1);
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        previous[neighbor] = closestNode;
      }
    });
  }

  const path = [];
  let currentNode = end.toString();

  while (previous[currentNode] !== undefined) {
    path.unshift(currentNode);
    currentNode = previous[currentNode];
  }

  if (path.length > 0 || start.toString() === end.toString()) {
    path.unshift(start.toString());
    return path.map(str => {
      const [latlng, floor] = str.split('_');
      const [lat, lng] = latlng.split(', ');
      return { latlng: L.latLng(parseFloat(lat.substring(7)), parseFloat(lng.substring(0, lng.length - 1))), floor };
    });
  }

  console.log('No path found from', start, 'to', end); // DEBUG: Check if pathfinding fails
  return null;
};

const handleGetDirections = () => {
  if (!state.startFeature || !state.destinationFeature) {
    showMessage("Please select both a starting point and a destination");
    return;
  }

  if (state.customRoute) {
    state.map.removeLayer(state.customRoute);
    state.customRoute = null;
  }

  const getFeaturePoint = (feature) => {
    let latlng, floor;
    if (feature.geometry.type === 'Point') {
      latlng = L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
      floor = feature.properties?.level ? feature.properties.level.split(';')[0] || state.currentFloor : state.currentFloor;
    } else if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      const midIndex = Math.floor(coords.length / 2);
      latlng = L.latLng(coords[midIndex][1], coords[midIndex][0]);
      floor = feature.properties?.level ? feature.properties.level.split(';')[0] || state.currentFloor : state.currentFloor;
    } else if (feature.geometry.type === 'Polygon') {
      const coords = feature.geometry.coordinates[0];
      const midIndex = Math.floor(coords.length / 2);
      latlng = L.latLng(coords[midIndex][1], coords[midIndex][0]);
      floor = feature.properties?.level ? feature.properties.level.split(';')[0] || state.currentFloor : state.currentFloor;
    }
    console.log(`Feature point for ${feature.properties?.name || feature.properties?.room}:`, { latlng, floor });
    return { latlng, floor };
  };

  const start = getFeaturePoint(state.startFeature);
  const end = getFeaturePoint(state.destinationFeature);

  if (!start.latlng || !end.latlng) {
    showMessage("Could not determine start or destination point");
    return;
  }

  if (start.floor === end.floor) {
    console.log('Start and destination on same floor:', start.floor);
  } else {
    console.log(`Routing from floor ${start.floor} to floor ${end.floor}`);
  }

  const allFeatures = Object.values(state.floorData).flat();
  const startNearest = findNearestPoint(start.latlng, allFeatures, start.floor);
  const endNearest = findNearestPoint(end.latlng, allFeatures, end.floor);

  if (!startNearest || !endNearest) {
    showMessage("Could not find pathway or stairs between points");
    console.log('No nearest points found:', { startNearest, endNearest });
    return;
  }

  const startNode = `${startNearest.latlng.toString()}_${startNearest.floor}`;
  const endNode = `${endNearest.latlng.toString()}_${endNearest.floor}`;

  const customPath = findPath(state.routingGraph, startNode, endNode);
  if (customPath) {
    const pathsByFloor = {};
    const stairTransitions = [];
    let currentFloor = customPath[0].floor;
    let currentSegment = [];
    let lastStairName = null;

    customPath.forEach((point, index) => {
      if (point.floor !== currentFloor || index === customPath.length - 1) {
        if (index === customPath.length - 1) {
          currentSegment.push(point.latlng);
        }
        pathsByFloor[currentFloor] = currentSegment;
        currentSegment = [point.latlng];
        if (index < customPath.length - 1) {
          const stair = state.stairs.find(s =>
            (s.feature.geometry.type === 'Point' &&
             L.latLng(s.feature.geometry.coordinates[1], s.feature.geometry.coordinates[0]).equals(point.latlng)) ||
            (s.feature.geometry.type === 'LineString' &&
             s.feature.geometry.coordinates.some(coord =>
               L.latLng(coord[1], coord[0]).equals(point.latlng)))
          );
          lastStairName = stair?.feature.properties?.name || 'Stair';
          stairTransitions.push({
            fromFloor: currentFloor,
            toFloor: point.floor,
            latlng: point.latlng,
            stairName: lastStairName
          });
        }
        currentFloor = point.floor;
      } else {
        currentSegment.push(point.latlng);
      }
    });

    console.log('Path by floor:', pathsByFloor, 'Stair transitions:', stairTransitions);

    loadCampusData(end.floor, true);

    state.customRoute = L.layerGroup();

    Object.entries(pathsByFloor).forEach(([floor, segment]) => {
      if (floor !== state.currentFloor && segment.length > 1) {
        L.polyline(segment, {
          color: '#888888',
          weight: 10,
          opacity: 0.6
        }).addTo(state.customRoute);
      }
    });

    Object.entries(pathsByFloor).forEach(([floor, segment]) => {
      if (floor === state.currentFloor && segment.length > 1) {
        L.polyline(segment, {
          color: '#32CD32',
          weight: 6,
          opacity: 1.0
        }).addTo(state.customRoute);
      }
    });

    stairTransitions.forEach(transition => {
      L.marker(transition.latlng, {
        icon: L.divIcon({
          className: 'stair-marker',
          html: `<div style="background:#FF0000;width:20px;height:20px;border-radius:50%;color:white;text-align:center;">S</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(state.customRoute)
        .bindPopup(`Take ${transition.stairName} to ${getFloorName(transition.toFloor)}`);
    });

    state.customRoute.addTo(state.map);

    if (state.startMarker) {
      state.startMarker.addTo(state.map);
    }
    if (state.destinationMarker) {
      state.destinationMarker.addTo(state.map);
    }

    const instructionsContainer = document.getElementById('route-instructions');
    if (instructionsContainer) {
      const message = stairTransitions.length > 0
        ? `Route from ${getFloorName(start.floor)} to ${getFloorName(end.floor)} via ${stairTransitions.map(t => t.stairName).join(' and ')}.`
        : `Route from ${getFloorName(start.floor)} to ${getFloorName(end.floor)} (no stairs needed).`;
      instructionsContainer.textContent = message;
      instructionsContainer.classList.add('active');
    }

    const bounds = L.latLngBounds([start.latlng, end.latlng]);
    state.map.fitBounds(bounds, { padding: [50, 50] });

    state.routingInProgress = true;
  } else {
    showMessage("No route found between points. Check stair and pathway connections.");
  }
};

// Route from the user's current location to a destination
const routeFromCurrentLocation = () => {
  if (!state.currentDestination || !state.lastGoodLocation) {
    showMessage("Please search for a destination first and ensure your location is available");
    return;
  }

  if (state.customRoute) {
    state.map.removeLayer(state.customRoute);
    state.customRoute = null;
  }

  const startPoint = state.lastGoodLocation.latlng;
  let endPoint;

  if (state.highlightedMarker) {
    endPoint = state.highlightedMarker.getLatLng();
  } else if (state.currentDestination.geometry.type === 'Point') {
    endPoint = L.latLng(
      state.currentDestination.geometry.coordinates[1],
      state.currentDestination.geometry.coordinates[0]
    );
  } else if (state.currentDestination.geometry.type === 'LineString') {
    const coords = state.currentDestination.geometry.coordinates;
    const midIndex = Math.floor(coords.length / 2);
    endPoint = L.latLng(coords[midIndex][1], coords[midIndex][0]);
  } else if (state.currentDestination.geometry.type === 'Polygon') {
    const coords = state.currentDestination.geometry.coordinates[0];
    const midIndex = Math.floor(coords.length / 2);
    endPoint = L.latLng(coords[midIndex][1], coords[midIndex][0]);
  }

  if (!endPoint) {
    showMessage("Could not determine destination point");
    return;
  }

  const allFeatures = Object.values(state.floorData).flat();
  const startNearest = findNearestPoint(startPoint, allFeatures, state.currentFloor);
  const endNearest = findNearestPoint(endPoint, allFeatures, state.currentDestination.properties?.level?.split(';')[0] || state.currentFloor);

  if (!startNearest || !endNearest) {
    showMessage("Could not find pathway or stairs to destination");
    return;
  }

  const startNode = `${startNearest.latlng.toString()}_${startNearest.floor}`;
  const endNode = `${endNearest.latlng.toString()}_${endNearest.floor}`;

  const customPath = findPath(state.routingGraph, startNode, endNode);
  if (customPath) {
    const pathsByFloor = {};
    const stairTransitions = [];
    let currentFloor = customPath[0].floor;
    let currentSegment = [];
    let lastStairName = null;

    customPath.forEach((point, index) => {
      if (point.floor !== currentFloor || index === customPath.length - 1) {
        if (index === customPath.length - 1) {
          currentSegment.push(point.latlng);
        }
        pathsByFloor[currentFloor] = currentSegment;
        currentSegment = [point.latlng];
        if (index < customPath.length - 1) {
          const stair = state.stairs.find(s =>
            (s.feature.geometry.type === 'Point' &&
             L.latLng(s.feature.geometry.coordinates[1], s.feature.geometry.coordinates[0]).equals(point.latlng)) ||
            (s.feature.geometry.type === 'LineString' &&
             s.feature.geometry.coordinates.some(coord =>
               L.latLng(coord[1], coord[0]).equals(point.latlng)))
          );
          lastStairName = stair?.feature.properties?.name || 'Stair';
          stairTransitions.push({
            fromFloor: currentFloor,
            toFloor: point.floor,
            latlng: point.latlng,
            stairName: lastStairName
          });
        }
        currentFloor = point.floor;
      } else {
        currentSegment.push(point.latlng);
      }
    });

    loadCampusData(endNearest.floor, true);

    state.customRoute = L.layerGroup();

    Object.entries(pathsByFloor).forEach(([floor, segment]) => {
      if (floor !== state.currentFloor && segment.length > 1) {
        L.polyline(segment, {
          color: '#888888',
          weight: 10,
          opacity: 0.6
        }).addTo(state.customRoute);
      }
    });

    Object.entries(pathsByFloor).forEach(([floor, segment]) => {
      if (floor === state.currentFloor && segment.length > 1) {
        L.polyline(segment, {
          color: '#32CD32',
          weight: 6,
          opacity: 1.0
        }).addTo(state.customRoute);
      }
    });

    stairTransitions.forEach(transition => {
      L.marker(transition.latlng, {
        icon: L.divIcon({
          className: 'stair-marker',
          html: `<div style="background:#FF0000;width:20px;height:20px;border-radius:50%;color:white;text-align:center;">S</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(state.customRoute)
        .bindPopup(`Take ${transition.stairName} to ${getFloorName(transition.toFloor)}`);
    });

    state.customRoute.addTo(state.map);

    if (state.startMarker) {
      state.startMarker.addTo(state.map);
    }
    if (state.destinationMarker) {
      state.destinationMarker.addTo(state.map);
    }

    const instructionsContainer = document.getElementById('route-instructions');
    if (instructionsContainer) {
      const message = stairTransitions.length > 0
        ? `Route from ${getFloorName(startNearest.floor)} to ${getFloorName(endNearest.floor)} via ${stairTransitions.map(t => t.stairName).join(' and ')}.`
        : `Route from ${getFloorName(startNearest.floor)} to ${getFloorName(endNearest.floor)} (no stairs needed).`;
      instructionsContainer.textContent = message;
      instructionsContainer.classList.add('active');
    }

    const bounds = L.latLngBounds([startPoint, endPoint]);
    state.map.fitBounds(bounds, { padding: [50, 50] });

    state.routingInProgress = true;
    updateRoutingButton();
  } else {
    showMessage("No route found to destination. Check stair and pathway connections.");
  }
};

// Initialize the routing button event listener
const initRoutingButton = () => {
  const button = document.getElementById('start-routing');
  if (button) {
    button.addEventListener('click', () => {
      if (state.routingInProgress) {
        if (state.customRoute) {
          state.map.removeLayer(state.customRoute);
          state.customRoute = null;
        }
        if (state.startMarker) {
          state.map.removeLayer(state.startMarker);
          state.startMarker = null;
        }
        if (state.destinationMarker) {
          state.map.removeLayer(state.destinationMarker);
          state.destinationMarker = null;
        }
        if (state.highlightedMarker) {
          state.map.removeLayer(state.highlightedMarker);
          state.highlightedMarker = null;
        }
        // Clear the instructions container
        const instructionsContainer = document.getElementById('route-instructions');
        if (instructionsContainer) {
          instructionsContainer.textContent = '';
          instructionsContainer.classList.remove('active'); // Hide the container
        }
        state.routingInProgress = false;
      } else {
        routeFromCurrentLocation();
      }
      updateRoutingButton();
    });
  }
};

// Initialize the Get Directions button
const initDirectionsButton = () => {
  const button = document.querySelector('.directions-button');
  if (button) {
    button.addEventListener('click', handleGetDirections);
  }
};

// Update the routing button's state and appearance
const updateRoutingButton = () => {
  const button = document.getElementById('start-routing');
  if (button) {
    button.disabled = !(state.currentDestination && state.lastGoodLocation);
    if (state.routingInProgress) {
      button.textContent = 'Clear Route';
      button.style.backgroundColor = '#F44336';
    } else {
      button.textContent = 'Show Route';
      button.style.backgroundColor = '#4CAF50';
    }
  }
};

// Initialize floor switcher buttons
const initFloorSwitcher = () => {
  document.querySelectorAll('.floor-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const floor = btn.dataset.floor;
      if (floor !== state.currentFloor) {
        loadCampusData(floor);
      }
    });
    // Update the button text to use the friendly floor name
    btn.textContent = getFloorName(btn.dataset.floor);
  });
};

// === View Toggles ===
function setupViewToggles() {
  document.addEventListener('click', function(e) {
    if (e.target.closest('.route-button')) {
      const routePlanner = document.querySelector('.route-planner');
      routePlanner.classList.add('active');
      document.querySelector('.route-planning-view').style.display = 'block';
      document.querySelector('.single-search-view').style.display = 'none';
      document.querySelector('.search-container').style.display = 'none';
      if (state.highlightedMarker) {
        state.map.removeLayer(state.highlightedMarker);
        state.highlightedMarker = null;
      }
    }

    if (e.target.closest('.back-button')) {
      const routePlanner = document.querySelector('.route-planner');
      routePlanner.classList.remove('active');
      document.querySelector('.search-container').style.display = 'block';
      if (state.startMarker) {
        state.map.removeLayer(state.startMarker);
        state.startMarker = null;
      }
      if (state.destinationMarker) {
        state.map.removeLayer(state.destinationMarker);
        state.destinationMarker = null;
      }
      if (state.highlightedMarker) {
        state.map.removeLayer(state.highlightedMarker);
        state.highlightedMarker = null;
      }
      // Clear the instructions container
      const instructionsContainer = document.getElementById('route-instructions');
      if (instructionsContainer) {
        instructionsContainer.textContent = '';
        instructionsContainer.classList.remove('active'); // Hide the container
      }
    }
  });
}

const initToggleLabelsButton = () => {
  const button = document.getElementById('toggle-labels');
  if (button) {
    button.addEventListener('click', () => {
      state.labelsVisible = !state.labelsVisible;
      if (state.labelsVisible) {
        if (state.labelLayer) {
          state.labelLayer.addTo(state.map);
        }
        button.classList.add('active');
        showMessage("Labels visible", 2000);
      } else {
        if (state.labelLayer) {
          state.map.removeLayer(state.labelLayer);
        }
        button.classList.remove('active');
        showMessage("Labels hidden", 2000);
      }
    });
  }
};

// === Application Initialization ===
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadCampusData();
  initRoutingButton();
  initFloorSwitcher();
  setupViewToggles();
  initRoutePlannerSearch();
  initDirectionsButton();
  initToggleLabelsButton();
});
