// Constants
const MAP_CONFIG = {
    bounds: L.latLngBounds([8.0600, 123.7500], [8.0700, 123.7630]),
    defaultCoords: [8.065151, 123.756515],
    zoom: { 
        min: 16,
        max: 23,
        default: 19
    },
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors'
};

// Enhanced Geolocation Constants
const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true,
    maximumAge: 15000,
    timeout: 10000
};

const GEOLOCATION_TOTAL_TIMEOUT = 30000;
const MIN_ACCURACY_THRESHOLD = 50;

// State management
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
    routingInProgress: false
};

// Initialize the map
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

// Update current location with accuracy circle
const updateCurrentLocation = (latlng, accuracy) => {
    if (state.currentLocationMarker) state.map.removeLayer(state.currentLocationMarker);
    if (state.currentLocationCircle) state.map.removeLayer(state.currentLocationCircle);

    if (accuracy < 1000) {
        state.currentLocationCircle = L.circle(latlng, {
            color: '#4285F4',
            fillColor: '#4285F4',
            fillOpacity: accuracy > 200 ? 0.1 : 0.2,
            radius: accuracy
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

// Show user messages
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

// Geolocation fallback
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

// Start geolocation tracking
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
                        errorMessage += "Permission denied. Please enable location services.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += "Position unavailable. Please check your GPS signal.";
                        break;
                    case error.TIMEOUT:
                        errorMessage += "Request timed out. Please try again.";
                        break;
                    default:
                        errorMessage += "Unknown error occurred.";
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

// Initialize search functionality
const initSearch = () => {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    if (!searchInput || !searchResults) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        searchResults.innerHTML = '';

        if (query.length < 2) return;

        const results = state.searchableFeatures.filter(feature => {

            // Check if the feature has a 'user' property and if it's not 'tcgcwaypoint'
            const hasUserProperty = 'user' in (feature.properties || {});
            const isCreator = hasUserProperty ? feature.properties.user === 'tcgcwaypoint' : true;
            if (!isCreator) return false; // Exclude features where user exists and is not 'tcgcwaypoint'
                
            const roomName = feature.properties?.room?.toLowerCase() || '';
            const pathwayName = feature.properties?.pathway?.toLowerCase() || '';
            const buildingName = feature.properties?.building === 'yes' ? 'building' : '';
            const name = feature.properties?.name?.toLowerCase() || '';
            
            return roomName.includes(query) || 
                   pathwayName.includes(query) || 
                   buildingName.includes(query) ||
                   name.includes(query);
        });

        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
            return;
        }

        results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            
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
                zoomToFeature(result);
                searchResults.innerHTML = '';
                searchInput.value = displayName;
            });
            searchResults.appendChild(item);
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResults.innerHTML = '';
        }
    });
};

// Zoom to feature and store as destination
const zoomToFeature = (feature) => {
    if (!state.map) return;

    if (state.highlightedMarker) {
        state.map.removeLayer(state.highlightedMarker);
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
        state.highlightedMarker = L.marker(center, {
            icon: L.divIcon({
                className: 'marker-highlight',
                html: '<div style="background:#FF5722;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.5)"></div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            }),
            zIndexOffset: 2000
        }).addTo(state.map);

        state.map.setView(center, 19);

        if (feature.properties?.room || feature.properties?.pathway) {
            const popupContent = feature.properties.room || feature.properties.pathway;
            state.highlightedMarker.bindPopup(`<strong>${popupContent}</strong>`).openPopup();
        }
    }

    state.currentDestination = feature;
    updateRoutingButton();
};

// Create routing graph from pathways
const createRoutingGraph = (features) => {
    const graph = {};
    
    features.forEach(feature => {
        // Updated condition to match your new pathway properties
        if (feature.geometry.type === 'LineString' && 
            (feature.properties?.indoor === 'corridor' || 
             feature.properties?.highway === 'service' ||
             feature.properties?.highway === 'footway')) {
                console.log("Adding to routing graph:", feature.properties);
            const coords = feature.geometry.coordinates;
            const points = coords.map(coord => L.latLng(coord[1], coord[0]));
            
            for (let i = 0; i < points.length - 1; i++) {
                const from = points[i].toString();
                const to = points[i + 1].toString();
                
                if (!graph[from]) graph[from] = [];
                if (!graph[to]) graph[to] = [];
                
                if (!graph[from].includes(to)) graph[from].push(to);
                if (!graph[to].includes(from)) graph[to].push(from);
            }
        }
    });
    
    return graph;
};
// Find nearest point on pathway
const findNearestPoint = (point, features) => {
    let nearestPoint = null;
    let minDistance = Infinity;
    
    features.forEach(feature => {
        // Updated condition to match your new pathway properties
        if (feature.geometry.type === 'LineString' && 
            (feature.properties?.indoor === 'corridor' || 
             feature.properties?.highway === 'service' ||
             feature.properties?.highway === 'footway')) {
            const coords = feature.geometry.coordinates;
            
            for (let i = 0; i < coords.length; i++) {
                const coord = coords[i];
                const latLng = L.latLng(coord[1], coord[0]);
                const distance = point.distanceTo(latLng);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestPoint = latLng;
                }
            }
        }
    });
    
    return nearestPoint;
};

// Dijkstra's algorithm for pathfinding
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
            const alt = distances[closestNode] + 1;
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
            const [lat, lng] = str.split(', ');
            return L.latLng(parseFloat(lat.substring(7)), parseFloat(lng.substring(0, lng.length - 1)));
        });
    }
    
    return null;
};

const routeFromCurrentLocation = () => {
    if (!state.currentDestination || !state.lastGoodLocation) {
        showMessage("Please search for a destination first and ensure your location is available");
        return;
    }

    // Remove any existing routes
    if (state.customRoute) {
        state.map.removeLayer(state.customRoute);
        state.customRoute = null;
    }

    const startPoint = state.lastGoodLocation.latlng;
    let endPoint;

    // Use the exact position of the highlighted marker if it exists
    if (state.highlightedMarker) {
        endPoint = state.highlightedMarker.getLatLng();
    } 
    // Fallback to the destination feature's geometry
    else if (state.currentDestination.geometry.type === 'Point') {
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

    // Get only pathway features for routing
    const pathwayFeatures = state.searchableFeatures.filter(feature => 
        feature.geometry.type === 'LineString' &&
        (feature.properties?.indoor === 'corridor' || 
         feature.properties?.highway === 'service' ||
         feature.properties?.highway === 'footway')
    );

    // Find nearest points on pathways
    const nearestStart = findNearestPoint(startPoint, pathwayFeatures);
    const nearestEnd = findNearestPoint(endPoint, pathwayFeatures);

    if (!nearestStart || !nearestEnd) {
        showMessage("Could not find pathway to destination");
        return;
    }

    // Create the green path using our custom routing
    const customPath = findPath(state.routingGraph, nearestStart, nearestEnd);
    if (customPath) {
        state.customRoute = L.polyline(customPath, {
            color: '#32CD32', // Lime green color
            weight: 8,       // Thick line
            opacity: 0.8,
            lineJoin: 'round'
        }).addTo(state.map);
    }

    // Fit the view to show both the start and destination
    const bounds = L.latLngBounds([startPoint, endPoint]);
    state.map.fitBounds(bounds, { padding: [50, 50] });

    state.routingInProgress = true;
    updateRoutingButton();
};

// Update routing button state
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

// Initialize routing button
const initRoutingButton = () => {
    const button = document.getElementById('start-routing');
    if (button) {
        button.addEventListener('click', () => {
            if (state.routingInProgress) {
                if (state.customRoute) {
                    state.map.removeLayer(state.customRoute);
                    state.customRoute = null;
                }
                state.routingInProgress = false;
            } else {
                routeFromCurrentLocation();
            }
            updateRoutingButton();
        });
    }
};

// Initialize routing functionality
const initRouting = (geojsonData) => {
    state.routingGraph = createRoutingGraph(geojsonData.features);
    
    state.map.on('click', function(e) {
        if (!state.routingControl) {
            const startPoint = findNearestPoint(e.latlng, geojsonData.features);
            
            if (startPoint) {
                state.routingControl = L.Routing.control({
                    waypoints: [startPoint],
                    routeWhileDragging: true,
                    show: false,
                    createMarker: function(i, wp) {
                        return L.marker(wp.latLng, {
                            draggable: true,
                            icon: L.divIcon({
                                className: i === 0 ? 'start-marker' : 'end-marker',
                                html: i === 0 ? 'A' : 'B',
                                iconSize: [24, 24]
                            })
                        });
                    },
                    router: new L.Routing.OSRMv1({
                        serviceUrl: 'https://router.project-osrm.org/route/v1',
                        profile: 'foot'
                    })
                }).addTo(state.map);
                
                state.map.once('click', function(e2) {
                    const endPoint = findNearestPoint(e2.latlng, geojsonData.features);
                    if (endPoint) {
                        state.routingControl.setWaypoints([startPoint, endPoint]);
                        
                        const customPath = findPath(state.routingGraph, startPoint, endPoint);
                        if (customPath) {
                            if (state.customRoute) {
                                state.map.removeLayer(state.customRoute);
                            }
                            state.customRoute = L.polyline(customPath, {color: 'red', weight: 5}).addTo(state.map);
                        }
                    }
                });
            }
        } else {
            state.map.removeControl(state.routingControl);
            if (state.customRoute) {
                state.map.removeLayer(state.customRoute);
                state.customRoute = null;
            }
            state.routingControl = null;
        }
    });
};

// Load campus data and initialize layers
const loadCampusData = async () => {
    try {
        const response = await fetch('tcgc-pathways.json');
        const geojsonData = await response.json();

        state.searchableFeatures = geojsonData.features.filter(f => 
            f.properties?.room || f.properties?.pathway || f.properties?.building === 'yes' || f.properties?.name ||
            f.properties?.indoor === 'corridor' || // Add this
            f.properties?.highway === 'service' || // Add this
            f.properties?.highway === 'footway'    // Add this
        );
        console.log("Searchable features:", state.searchableFeatures);

        initSearch();

        const addLayer = (features, style) => L.geoJSON(features, {
            style: typeof style === 'function' ? style : () => style,
            interactive: true,
            pointToLayer: (feature, latlng) => {
                if (feature.properties?.room || feature.properties?.pathway) {
                    return L.circleMarker(latlng, {
                        radius: 5,
                        fillColor: "#ff7800",
                        color: "#000",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                }
                return null;
            },
            onEachFeature: (feature, layer) => {
                if (feature.properties?.room || feature.properties?.pathway) {
                    layer.bindPopup(`<strong>${feature.properties.room || feature.properties.pathway}</strong>`);
                }
            }
        }).addTo(state.map);

        addLayer(
            { ...geojsonData, features: geojsonData.features.filter(f => 
                f.geometry.type === 'LineString' && 
                !f.properties?.pathway && // Keep this
                !(f.properties?.indoor === 'corridor' || // Exclude corridors
                  f.properties?.highway === 'service' || // Exclude service paths
                  f.properties?.highway === 'footway')) }, // Exclude footways
            { color: '#0000FF', weight: 3, opacity: 0.8 }
        );

        addLayer(
            { ...geojsonData, features: geojsonData.features.filter(f => 
                f.geometry.type === 'LineString' && !f.properties.pathway) },
            { color: '#0000FF', weight: 3, opacity: 0.8 }
        );

        addLayer(
            { ...geojsonData, features: geojsonData.features.filter(f => 
                f.geometry.type === 'Polygon') },
            f => ({
                color: f.properties?.building === 'yes' ? '#555' : '#808080',
                weight: f.properties?.building === 'yes' ? 2 : 1,
                fillColor: f.properties?.building === 'yes' ? '#ddd' : '',
                fillOpacity: f.properties?.building === 'yes' ? 0.5 : 0
            })
        );
        
        initRouting(geojsonData);
        
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        startGeolocation();
    } catch (error) {
        console.error('Error loading map data:', error);
        showMessage('Failed to load map data. Please refresh the page.', 5000);
    }
};

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadCampusData();
    initRoutingButton();
});