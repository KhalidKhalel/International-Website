// Written by Khalid Khalel
// Global variables - these help me keep track of data across different functions
let map;
let allEarthquakeData = [];
let filteredEarthquakeData = [];
let earthquakesLayer;
let pinsLayer;
let grayscaleLayer;
let satelliteLayer;
let magnitudeChartInstance;
let timelineChartInstance;
let regionChartInstance;
let currentTimelinePeriod = 'day';
let dateRangePicker;
let dateFilterActive = false;
let daysToFetch = 90;
let currentPage = 1;
let itemsPerPage = 50;
let currentMagnitudeFilter = 0;

// Turkey center coordinates
const TURKEY_CENTER = [39.0, 35.0];
const TURKEY_ZOOM = 6;
const MIN_ZOOM = 4;
const MAX_ZOOM = 15;

// Direction name mappings - the USGS API gives us abbreviations like "N" instead of "North"
const DIRECTION_NAMES = {
    'N': 'North',
    'S': 'South',
    'E': 'East',
    'W': 'West',
    'NE': 'Northeast',
    'NW': 'Northwest',
    'SE': 'Southeast',
    'SW': 'Southwest',
    'NNE': 'North-Northeast',
    'NNW': 'North-Northwest',
    'SSE': 'South-Southeast',
    'SSW': 'South-Southwest',
    'ENE': 'East-Northeast',
    'ESE': 'East-Southeast',
    'WNW': 'West-Northwest',
    'WSW': 'West-Southwest'
};

// ========================================
// HELPER FUNCTIONS
// ========================================

// Get the magnitude range based on current filter
function getMagnitudeRange() {
    const minMagnitude = currentMagnitudeFilter;
    const maxMagnitude = minMagnitude > 0 ? (minMagnitude === 5 ? 10 : minMagnitude + 1) : 10;
    return { minMagnitude, maxMagnitude };
}

// Filter earthquake data by magnitude
function filterByMagnitude(data) {
    const { minMagnitude, maxMagnitude } = getMagnitudeRange();

    if (minMagnitude === 0) return data;

    return data.filter(eq => {
        return eq.magnitude >= minMagnitude && eq.magnitude < maxMagnitude;
    });
}

// Opens or closes popup menus
function togglePopup(popupId, iconId, extraCallback = null) {
    const popup = document.getElementById(popupId);
    const icon = document.getElementById(iconId);
    const isShowing = popup.classList.contains('show');

    closeAllPopups();

    if (!isShowing) {
        popup.classList.add('show');
        icon.classList.add('active');
        if (extraCallback) extraCallback();
    }
}

// Close all popups only one menu should be open at a time
function closeAllPopups() {
    document.getElementById('layerMenu')?.classList.remove('show');
    document.getElementById('magnitudePopup')?.classList.remove('show');
    document.getElementById('datePickerPopup')?.classList.remove('show');
    document.getElementById('daysPopup')?.classList.remove('show');

    document.getElementById('layerIcon')?.classList.remove('active');
    document.getElementById('magnitudeIcon')?.classList.remove('active');
    document.getElementById('dateIcon')?.classList.remove('active');
    document.getElementById('daysIcon')?.classList.remove('active');

    if (dateRangePicker) dateRangePicker.close();
}

// Capitalize each word in a string (for city names)
function capitalizeWords(str) {
    return str.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
}

// Destroy old chart before creating new one
function destroyChart(chartInstance) {
    if (chartInstance) {
        chartInstance.destroy();
    }
}

// Get marker color based on earthquake magnitude
function getMagnitudeColor(magnitude) {
    if (magnitude >= 5.0) return '#ef4444'; // Red for major
    if (magnitude >= 4.0) return '#facc15'; // Yellow for moderate
    return '#10b981'; // Green for light
}

// Generate distinct colors dynamically based on how many we need
function generateColors(count) {
    // Base distinct colors that look very different from each other
    const baseColors = [
        'rgba(220, 20, 60, 0.9)',      // Crimson
        'rgba(30, 144, 255, 0.9)',     // Dodger Blue
        'rgba(50, 205, 50, 0.9)',      // Lime Green
        'rgba(255, 140, 0, 0.9)',      // Dark Orange
        'rgba(148, 0, 211, 0.9)',      // Dark Violet
        'rgba(220, 20, 20, 0.9)',      // Fire Red
        'rgba(0, 128, 128, 0.9)',      // Teal
        'rgba(255, 215, 0, 0.9)',      // Gold
        'rgba(255, 20, 147, 0.9)',     // Deep Pink
        'rgba(0, 100, 0, 0.9)',        // Dark Green
        'rgba(139, 0, 0, 0.9)',        // Dark Red
        'rgba(0, 0, 139, 0.9)',        // Dark Blue
        'rgba(184, 134, 11, 0.9)',     // Dark Goldenrod
        'rgba(128, 0, 128, 0.9)',      // Purple
        'rgba(210, 105, 30, 0.9)',     // Chocolate
        'rgba(0, 139, 139, 0.9)',      // Dark Cyan
        'rgba(178, 34, 34, 0.9)',      // Fire Brick
        'rgba(25, 25, 112, 0.9)',      // Midnight Blue
        'rgba(107, 142, 35, 0.9)',     // Olive Drab
        'rgba(139, 69, 19, 0.9)'       // Saddle Brown
    ];

    const colors = [];

    // If we need more colors than base colors, cycle through and vary them
    for (let i = 0; i < count; i++) {
        if (i < baseColors.length) {
            colors.push(baseColors[i]);
        } else {
            // For extra colors, take base color and adjust hue slightly
            const baseIndex = i % baseColors.length;
            const hueShift = Math.floor((i / baseColors.length)) * 30;
            const goldenRatio = 0.618033988749895;
            let hue = (i * goldenRatio * 360 + hueShift) % 360;
            colors.push(`hsla(${hue}, 85%, 40%, 0.9)`);
        }
    }

    return colors;
}

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded, starting initialization...');

    initializeMap();
    fetchEarthquakeData();
    setupEventListeners();
    setupSmoothScrolling();
    setupMapControls();
    setupMenuToggle();

    console.log('Initialization complete!');
});

function setupSmoothScrolling() {
    document.querySelector('.scroll-down-arrow').addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelector('#why').scrollIntoView({ behavior: 'smooth' });
    });
}

function setupMenuToggle() {
    const menuBtn = document.getElementById('menu-btn');
    
    // Add event listener to prevent body scroll when menu is open
    menuBtn.addEventListener('change', function() {
        if (this.checked) {
            document.body.classList.add('menu-open');
        } else {
            document.body.classList.remove('menu-open');
        }
    });
    
    // Close menu when clicking on nav links
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            menuBtn.checked = false;
            document.body.classList.remove('menu-open');
        });
    });
}

// ========================================
// MAP CONTROLS SETUP
// ========================================

function setupMapControls() {
    const resetControl = document.createElement('div');
    resetControl.className = 'reset-control';
    resetControl.innerHTML = '<button id="resetMapBtn">Reset</button>';
    resetControl.title = 'Reset View and Filters';

    const magnitudeControl = document.createElement('div');
    magnitudeControl.className = 'magnitude-control';
    magnitudeControl.innerHTML = `
        <div class="magnitude-icon" id="magnitudeIcon" onclick="toggleMagnitudeFilter()" title="Magnitude Filter">
            <i class="fas fa-filter"></i>
        </div>
        <div class="magnitude-popup" id="magnitudePopup">
            <button class="close-btn" onclick="toggleMagnitudeFilter()">X</button>
            <h5>Magnitude:</h5>
            <div class="legend-items">
                <div class="magnitude-option" onclick="setMagnitudeFilter(0)">
                    <span>All Magnitudes</span>
                </div>
                <div class="magnitude-option" onclick="setMagnitudeFilter(3)">
                    <span class="color-indicator" style="background: #10b981;"></span>
                    <span>M 3.0-3.9 (Light)</span>
                </div>
                <div class="magnitude-option" onclick="setMagnitudeFilter(4)">
                    <span class="color-indicator" style="background: #facc15;"></span>
                    <span>M 4.0-4.9 (Moderate)</span>
                </div>
                <div class="magnitude-option" onclick="setMagnitudeFilter(5)">
                    <span class="color-indicator" style="background: #ef4444;"></span>
                    <span>M 5.0+ (Major)</span>
                </div>
            </div>
        </div>
    `;

    const baseLayerControl = document.createElement('div');
    baseLayerControl.className = 'base-layer-control';
    baseLayerControl.innerHTML = `
        <div class="layer-icon" id="layerIcon" onclick="toggleBaseLayerMenu()" title="Change Base Layer">
            <i class="fas fa-layer-group"></i>
        </div>
        <div class="layer-menu" id="layerMenu">
            <button class="close-btn" onclick="toggleBaseLayerMenu()">X</button>
            <h5>Base Layer:</h5>
            <div class="legend-items">
                <div class="layer-option" onclick="switchBaseLayer('grayscale')">
                    <i class="fas fa-map"></i> Grayscale
                </div>
                <div class="layer-option" onclick="switchBaseLayer('satellite')">
                    <i class="fas fa-satellite"></i> Satellite
                </div>
            </div>
        </div>
    `;

    const dateRangeControl = document.createElement('div');
    dateRangeControl.className = 'date-range-control';
    dateRangeControl.innerHTML = `
        <div class="date-icon" id="dateIcon" onclick="toggleDatePicker()" title="Date Range">
            <i class="fas fa-calendar-alt"></i>
        </div>
        <div class="date-picker-popup" id="datePickerPopup">
            <button class="close-btn" onclick="toggleDatePicker()">X</button>
            <h5>Date Range:</h5>
            <div class="legend-items">
                <div id="datePickerInline"></div>
            </div>
        </div>
    `;

    const daysControl = document.createElement('div');
    daysControl.className = 'days-control';
    daysControl.innerHTML = `
        <div class="days-icon" id="daysIcon" onclick="toggleDaysMenu()" title="Days to Fetch">
            <i class="fas fa-clock"></i>
        </div>
        <div class="days-popup" id="daysPopup">
            <button class="close-btn" onclick="toggleDaysMenu()">X</button>
            <h5>Days to Fetch:</h5>
            <div class="legend-items">
                <input type="number" id="daysInput" class="form-control" min="1" max="3650" value="90" placeholder="Enter days">
                <button class="btn btn-primary btn-sm mt-2 w-100" onclick="updateDays()">Apply</button>
            </div>
        </div>
    `;

    const mapContainer = document.getElementById('earthquake-map');
    mapContainer.appendChild(resetControl);
    mapContainer.appendChild(magnitudeControl);
    mapContainer.appendChild(baseLayerControl);
    mapContainer.appendChild(dateRangeControl);
    mapContainer.appendChild(daysControl);

    document.getElementById('resetMapBtn').addEventListener('click', function() {
        map.setView(TURKEY_CENTER, TURKEY_ZOOM);
        if (dateRangePicker) dateRangePicker.clear();
        dateFilterActive = false;
        currentMagnitudeFilter = 0;
        currentPage = 1;
        filterEarthquakes();
        console.log('Map view and filters reset!');
    });

    // Initialize Flatpickr date picker
    dateRangePicker = flatpickr("#datePickerInline", {
        mode: "range",
        inline: true,
        dateFormat: "Y-m-d",
        maxDate: "today",
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                dateFilterActive = true;
                filterEarthquakes();
            }
        }
    });
}

// ========================================
// CONTROL FUNCTIONS
// ========================================

function updateDays() {
    const input = document.getElementById('daysInput');
    const days = parseInt(input.value);

    if (days > 0 && days <= 3650) {
        daysToFetch = days;
        currentPage = 1;
        toggleDaysMenu();
        fetchEarthquakeData();
    } else {
        alert('Please enter a valid number of days between 1 and 3650 (10 years)');
    }
}

function toggleDaysMenu() {
    togglePopup('daysPopup', 'daysIcon');
}

function setMagnitudeFilter(value) {
    currentMagnitudeFilter = value;
    currentPage = 1;
    displayEarthquakes();
    populateTable();
    updateStatistics();
    createCharts();
    toggleMagnitudeFilter();
}

function toggleMagnitudeFilter() {
    togglePopup('magnitudePopup', 'magnitudeIcon');
}

function toggleBaseLayerMenu() {
    togglePopup('layerMenu', 'layerIcon');
}

function toggleDatePicker() {
    togglePopup('datePickerPopup', 'dateIcon', () => {
        if (dateRangePicker) dateRangePicker.open();
    });
}

function switchBaseLayer(layerType) {
    if (layerType === 'satellite') {
        map.removeLayer(grayscaleLayer);
        map.addLayer(satelliteLayer);
    } else {
        map.removeLayer(satelliteLayer);
        map.addLayer(grayscaleLayer);
    }
    toggleBaseLayerMenu();
}

// ========================================
// MAP INITIALIZATION
// ========================================

function initializeMap() {
    console.log('Setting up map...');

    map = L.map('earthquake-map', {
        center: TURKEY_CENTER,
        zoom: TURKEY_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        scrollWheelZoom: true,
        zoomControl: true,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        attributionControl: false
    });

    grayscaleLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: MAX_ZOOM,
        minZoom: MIN_ZOOM,
        attribution: ''
    });

    satelliteLayer = L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: MAX_ZOOM,
            minZoom: MIN_ZOOM,
            attribution: ''
        }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: MAX_ZOOM,
            minZoom: MIN_ZOOM,
            attribution: ''
        })
    ]);

    grayscaleLayer.addTo(map);

    earthquakesLayer = L.layerGroup().addTo(map);
    pinsLayer = L.layerGroup().addTo(map);

    const coordsDiv = document.createElement('div');
    coordsDiv.className = 'coordinates-display';
    coordsDiv.innerHTML = `
        <small>
            <i class="fas fa-crosshairs me-1"></i>
            <span style="color: #ffffff;">Lat:</span> <strong id="live-lat">39.0000</strong> <span style="color: #ffffff;">|</span>
            <span style="color: #ffffff;">Lng:</span> <strong id="live-lng">35.0000</strong>
        </small>
    `;
    document.getElementById('earthquake-map').appendChild(coordsDiv);

    map.on('mousemove', function(e) {
        document.getElementById('live-lat').textContent = e.latlng.lat.toFixed(4);
        document.getElementById('live-lng').textContent = e.latlng.lng.toFixed(4);
    });

    console.log('Map setup complete!');
}

function expandDirection(location) {
    let expanded = location;
    const sortedDirections = Object.keys(DIRECTION_NAMES).sort((a, b) => b.length - a.length);

    sortedDirections.forEach(abbr => {
        const regex = new RegExp('\\b' + abbr + '\\b', 'g');
        expanded = expanded.replace(regex, DIRECTION_NAMES[abbr]);
    });

    return expanded;
}

// ========================================
// DATA FETCHING
// ========================================

async function fetchEarthquakeData() {
    console.log(`Fetching earthquake data from USGS for last ${daysToFetch} days...`);

    try {
        const usgsData = await fetchUSGSData();
        console.log(`USGS returned ${usgsData.length} earthquakes`);

        allEarthquakeData = usgsData;
        allEarthquakeData.sort((a, b) => b.time - a.time);

        console.log(`Total earthquakes loaded: ${allEarthquakeData.length}`);

        filteredEarthquakeData = [...allEarthquakeData];

        displayEarthquakes();
        updateStatistics();
        createCharts();
        populateTable();

    } catch (error) {
        console.error('Error fetching earthquake data:', error);
        document.getElementById('earthquakes-tbody').innerHTML =
            '<tr><td colspan="8" class="text-center text-danger">Failed to load earthquake data. Please try again later.</td></tr>';
    }
}

async function fetchUSGSData() {
    console.log('Fetching from USGS...');

    try {
        const response = await fetch(
            'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
            '&starttime=' + getDateDaysAgo(daysToFetch) +
            '&endtime=' + getCurrentDate() +
            '&minlatitude=35.8&maxlatitude=42.1' +
            '&minlongitude=25.6&maxlongitude=44.8' +
            '&minmagnitude=2.5' +
            '&limit=20000' +
            '&orderby=time'
        );

        if (!response.ok) {
            throw new Error('USGS API failed');
        }

        const data = await response.json();
        console.log(`Got ${data.features.length} earthquakes from USGS`);

        return data.features.map(feature => {
            return {
                magnitude: feature.properties.mag,
                location: expandDirection(feature.properties.place),
                time: new Date(feature.properties.time),
                latitude: feature.geometry.coordinates[1],
                longitude: feature.geometry.coordinates[0],
                depth: feature.geometry.coordinates[2],
                url: feature.properties.url,
                source: 'USGS'
            };
        });
    } catch (error) {
        console.error('USGS fetch error:', error);
        return [];
    }
}

function filterEarthquakes() {
    console.log('Filtering earthquakes...');

    let filtered = [...allEarthquakeData];

    if (dateFilterActive && dateRangePicker.selectedDates.length === 2) {
        const startDate = dateRangePicker.selectedDates[0];
        const endDate = dateRangePicker.selectedDates[1];
        endDate.setHours(23, 59, 59, 999);

        filtered = filtered.filter(eq => {
            return eq.time >= startDate && eq.time <= endDate;
        });

        console.log(`Date filter applied: ${filtered.length} earthquakes`);
    }

    filteredEarthquakeData = filtered;

    displayEarthquakes();
    updateStatistics();
    createCharts();
    populateTable();
}

function getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
}

function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

// ========================================
// MAP DISPLAY
// ========================================

function flyToLocation(lat, lng) {
    map.flyTo([lat, lng], 11, { duration: 1.5 });

    setTimeout(() => {
        earthquakesLayer.eachLayer(layer => {
            if (layer.getLatLng && layer.getLatLng().lat === lat && layer.getLatLng().lng === lng) {
                layer.openPopup();
            }
        });
        pinsLayer.eachLayer(layer => {
            if (layer.getLatLng && layer.getLatLng().lat === lat && layer.getLatLng().lng === lng) {
                layer.openPopup();
            }
        });
    }, 1600);
}

window.flyToLocation = flyToLocation;

function displayEarthquakes() {
    console.log('Adding earthquake markers to map...');

    earthquakesLayer.clearLayers();
    pinsLayer.clearLayers();

    const displayData = filterByMagnitude(filteredEarthquakeData);

    displayData.forEach(eq => {
        // Calculate radius based on depth (deeper earthquakes get larger circles)
        const radiusInMeters = eq.depth * 1.5 * 1000;
        const markerColor = getMagnitudeColor(eq.magnitude);

        const depthMiles = (eq.depth * 0.621371).toFixed(1);
        const radiusKm = (radiusInMeters / 1000).toFixed(1);
        const radiusMiles = (radiusKm * 0.621371).toFixed(1);

        const popupContent = `
            <div style="min-width: 200px;">
                <h4 style="margin-bottom: 0.5rem; color: #ffffff;">Magnitude ${eq.magnitude.toFixed(1)}</h4>
                <p style="margin-bottom: 0.3rem;"><strong>Location:</strong> ${eq.location}</p>
                <p style="margin-bottom: 0.3rem;"><strong>Date:</strong> ${eq.time.toLocaleDateString()}</p>
                <p style="margin-bottom: 0.3rem;"><strong>Time:</strong> ${eq.time.toLocaleTimeString()}</p>
                <p style="margin-bottom: 0.3rem;"><strong>Depth:</strong> ${eq.depth.toFixed(1)} km | ${depthMiles} mi</p>
                <p style="margin-bottom: 0.3rem;"><strong>Radius:</strong> ${radiusKm} km | ${radiusMiles} mi</p>
                <p style="margin-bottom: 0.3rem;"><strong>Source:</strong>
                <a href="${eq.url}" target="_blank" style="color: #3498db;">USGS</a>
                </p>
            </div>
        `;

        const circle = L.circle([eq.latitude, eq.longitude], {
            radius: radiusInMeters,
            fillColor: markerColor,
            color: '#000',
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.5
        }).addTo(earthquakesLayer);

        circle.bindPopup(popupContent);

        const pinIcon = L.divIcon({
            className: 'custom-pin',
            html: `<i class="fas fa-map-marker-alt" style="color: ${markerColor}; font-size: 24px; text-shadow: 0 0 3px rgba(0,0,0,0.5);"></i>`,
            iconSize: [24, 24],
            iconAnchor: [12, 24],
            popupAnchor: [0, -24]
        });

        const pin = L.marker([eq.latitude, eq.longitude], { icon: pinIcon });
        pin.addTo(pinsLayer);
        pin.bindPopup(popupContent);
    });

    console.log(`Displayed ${displayData.length} earthquakes`);
}

// ========================================
// STATISTICS & CHARTS
// ========================================

function updateStatistics() {
    console.log('Updating statistics...');

    if (filteredEarthquakeData.length === 0) {
        document.getElementById('chart-max-mag').textContent = 'N/A';
        return;
    }

    const maxMag = Math.max(...filteredEarthquakeData.map(eq => eq.magnitude));
    document.getElementById('chart-max-mag').textContent = maxMag.toFixed(1);

    console.log('Statistics updated!');
}

function createCharts() {
    console.log('Creating charts...');
    createMagnitudeChart();
    createTimelineChart(currentTimelinePeriod);
    createRegionChart();
    console.log('All charts created!');
}

function createMagnitudeChart() {
    const chartData = filterByMagnitude(filteredEarthquakeData);

    // Group earthquakes by magnitude ranges
    const ranges = {
        '2.5-3.0': 0,
        '3.0-3.5': 0,
        '3.5-4.0': 0,
        '4.0-4.5': 0,
        '4.5-5.0': 0,
        '5.0+': 0
    };

    chartData.forEach(eq => {
        if (eq.magnitude < 3.0) ranges['2.5-3.0']++;
        else if (eq.magnitude < 3.5) ranges['3.0-3.5']++;
        else if (eq.magnitude < 4.0) ranges['3.5-4.0']++;
        else if (eq.magnitude < 4.5) ranges['4.0-4.5']++;
        else if (eq.magnitude < 5.0) ranges['4.5-5.0']++;
        else ranges['5.0+']++;
    });

    const ctx = document.getElementById('magnitude-chart').getContext('2d');

    destroyChart(magnitudeChartInstance);

    magnitudeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(ranges),
            datasets: [{
                label: 'Number of Earthquakes',
                data: Object.values(ranges),
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(250, 204, 21, 0.8)',
                    'rgba(250, 204, 21, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderColor: [
                    'rgba(16, 185, 129, 1)',
                    'rgba(16, 185, 129, 1)',
                    'rgba(16, 185, 129, 1)',
                    'rgba(250, 204, 21, 1)',
                    'rgba(250, 204, 21, 1)',
                    'rgba(239, 68, 68, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { 
                        precision: 0,
                        color: '#ffffff'
                    },
                    grid: {
                        color: '#ffffff',
                        lineWidth: 0.5
                    }
                },
                x: {
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// This groups earthquakes by time period and calculates averages
function createTimelineChart(period) {
    const timelineData = filterByMagnitude(filteredEarthquakeData);
    let groupedData = {};

    timelineData.forEach(eq => {
        let dateKey;
        if (period === 'day') {
            dateKey = eq.time.toLocaleDateString();
        } else if (period === 'month') {
            dateKey = `${eq.time.getFullYear()}-${String(eq.time.getMonth() + 1).padStart(2, '0')}`;
        } else if (period === 'year') {
            dateKey = eq.time.getFullYear().toString();
        }
        groupedData[dateKey] = (groupedData[dateKey] || 0) + 1;
    });

    const sortedDates = Object.keys(groupedData).sort();
    const counts = sortedDates.map(date => groupedData[date]);

    let average;
    let avgLabel;

    if (period === 'day') {
        average = sortedDates.length > 0 ? (timelineData.length / sortedDates.length).toFixed(1) : '0';
        avgLabel = 'Average Per Day:';
    } else if (period === 'month') {
        average = sortedDates.length > 0 ? (timelineData.length / sortedDates.length).toFixed(1) : '0';
        avgLabel = 'Average Per Month:';
    } else if (period === 'year') {
        average = sortedDates.length > 0 ? (timelineData.length / sortedDates.length).toFixed(1) : '0';
        avgLabel = 'Average Per Year:';
    }

    document.getElementById('timeline-avg').textContent = average;
    document.getElementById('timeline-avg-label').textContent = avgLabel;

    const ctx = document.getElementById('timeline-chart').getContext('2d');

    destroyChart(timelineChartInstance);

    timelineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: `Earthquakes per ${period}`,
                data: counts,
                borderColor: 'rgba(52, 152, 219, 1)',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { 
                        precision: 0,
                        color: '#ffffff'
                    },
                    grid: {
                        color: '#ffffff',
                        lineWidth: 0.5
                    }
                },
                x: { 
                    display: false 
                }
            }
        }
    });
}

function createRegionChart() {
    const regionData = filterByMagnitude(filteredEarthquakeData);

    document.getElementById('total-earthquakes').textContent = regionData.length;

    const cityProvinceCounts = {};

    // List of Turkish cities to look for in location strings
    const turkishCities = [
        'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya',
        'gaziantep', 'mersin', 'diyarbakir', 'kayseri', 'eskisehir', 'urfa',
        'malatya', 'erzurum', 'van', 'batman', 'elazig', 'manisa', 'sivas',
        'gebze', 'balikesir', 'kahramanmaras', 'aydin', 'denizli',
        'sakarya', 'tekirdag', 'kocaeli', 'hatay', 'trabzon', 'ordu',
        'samsun', 'adapazari', 'canakkale', 'kutahya', 'afyon', 'edirne',
        'mugla', 'bolu', 'tokat', 'corum', 'kirikkale', 'aksaray', 'nigde',
        'nevsehir', 'karaman', 'osmaniye', 'kilis', 'sanliurfa', 'mardin',
        'siirt', 'sirnak', 'bitlis', 'mus', 'agri', 'igdir', 'kars',
        'ardahan', 'artvin', 'rize', 'giresun', 'gumushane', 'bayburt',
        'erzincan', 'tunceli', 'bingol', 'hakkari', 'yozgat', 'kirsehir',
        'usak', 'isparta', 'burdur', 'kastamonu', 'cankiri',
        'sinop', 'amasya', 'zonguldak', 'karabuk', 'bartin', 'duzce',
        'yalova', 'bilecik', 'sindirgi', 'iznik', 'gemlik', 'bigadic',
        'bandirma', 'soma', 'akhisar', 'tire', 'kusadasi', 'didim',
        'bodrum', 'marmaris', 'fethiye', 'kas', 'alanya', 'manavgat',
        'silifke', 'tarsus', 'iskenderun', 'dortyol', 'bafra', 'carsamba',
        'terme', 'fatsa', 'unye', 'golcuk', 'corlu', 'cerkezkoy', 'sarigerme'
    ];

    regionData.forEach(eq => {
        const location = eq.location.toLowerCase();
        let city = null;

        // Check if location contains any Turkish city name
        for (let turkishCity of turkishCities) {
            if (location.includes(turkishCity)) {
                city = capitalizeWords(turkishCity);
                break;
            }
        }

        // Try pattern matching: "X km direction of CityName, Turkey"
        if (!city) {
            const pattern1 = /\d+\s*km\s+[a-z\-]+\s+of\s+([^,]+),?\s*turkey/i;
            const match1 = location.match(pattern1);
            if (match1 && match1[1]) {
                city = capitalizeWords(match1[1].trim());
            }
        }

        // Another pattern to try
        if (!city) {
            const pattern2 = /of\s+([a-z\s]+?)(?:,|\s+turkey|$)/i;
            const match2 = location.match(pattern2);
            if (match2 && match2[1]) {
                let extractedName = match2[1].trim();
                if (extractedName.length > 1 && extractedName.length < 30) {
                    city = capitalizeWords(extractedName);
                }
            }
        }

        // Last resort: extract the last meaningful part before "Turkey"
        if (!city) {
            let cleanLocation = location.replace(/,?\s*turkey\s*$/i, '').trim();
            const parts = cleanLocation.split(/\s+of\s+/i);

            if (parts.length > 1) {
                city = parts[parts.length - 1].trim();
            } else {
                city = cleanLocation;
            }

            if (city && city.length > 0) {
                city = capitalizeWords(city);
            }
        }

        if (city && city.length >= 2) {
            cityProvinceCounts[city] = (cityProvinceCounts[city] || 0) + 1;
        }
    });

    // Sort cities by earthquake count to show all the cities
    const sortedCities = Object.entries(cityProvinceCounts)
        .sort((a, b) => b[1] - a[1]);

    const ctx = document.getElementById('region-chart').getContext('2d');

    destroyChart(regionChartInstance);

    const colors = generateColors(sortedCities.length);

    regionChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: sortedCities.map(r => `${r[0]}: ${r[1]}`),
            datasets: [{
                label: 'Earthquakes by Region',
                data: sortedCities.map(r => r[1]),
                backgroundColor: colors,
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: 15,
                        padding: 10,
                        font: {
                            size: 11
                        },
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${percentage}%`;
                        }
                    }
                }
            }
        }
    });
}

// ========================================
// TABLE POPULATION
// ========================================

function populateTable() {
    console.log('Populating earthquake table...');

    const tbody = document.getElementById('earthquakes-tbody');
    const tableData = filterByMagnitude(filteredEarthquakeData);
    const sortedEarthquakes = [...tableData].sort((a, b) => b.time - a.time);

    tbody.innerHTML = '';

    if (sortedEarthquakes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No earthquakes found for the selected filters.</td></tr>';
        return;
    }

    const totalPages = Math.ceil(sortedEarthquakes.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, sortedEarthquakes.length);
    const paginatedData = sortedEarthquakes.slice(startIndex, endIndex);

    paginatedData.forEach(eq => {
        const row = document.createElement('tr');

        let badgeClass;
        if (eq.magnitude >= 5.0) badgeClass = 'magnitude-high';
        else if (eq.magnitude >= 4.0) badgeClass = 'magnitude-moderate';
        else badgeClass = 'magnitude-low';

        const depthMiles = (eq.depth * 0.621371).toFixed(1);
        
        // Calculate radius based on depth
        const radiusKm = (eq.depth * 1.5).toFixed(1);
        const radiusMiles = (radiusKm * 0.621371).toFixed(1);
        
        const locationLink = `<a href="#where" onclick="setTimeout(function() { flyToLocation(${eq.latitude}, ${eq.longitude}); }, 500); return true;" style="color: #3498db; text-decoration: none; cursor: pointer;">${eq.location}</a>`;
        const sourceButtons = `<a href="${eq.url}" target="_blank" class="btn btn-sm btn-outline-primary">USGS</a>`;

        row.innerHTML = `
            <td>${eq.time.toLocaleString()}</td>
            <td>${locationLink}</td>
            <td>${eq.latitude.toFixed(4)}</td>
            <td>${eq.longitude.toFixed(4)}</td>
            <td><span class="magnitude-badge ${badgeClass}">${eq.magnitude.toFixed(1)}</span></td>
            <td>${eq.depth.toFixed(1)} km | ${depthMiles} mi</td>
            <td>${radiusKm} km | ${radiusMiles} mi</td>
            <td>${sourceButtons}</td>
        `;

        tbody.appendChild(row);
    });

    if (totalPages > 1) {
        const paginationRow = document.createElement('tr');
        paginationRow.innerHTML = `
            <td colspan="8" class="text-center">
                <div class="pagination-controls">
                    <button class="btn btn-sm btn-outline-secondary" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">Previous</button>
                    <span class="mx-3">Page ${currentPage} of ${totalPages} (${sortedEarthquakes.length} total)</span>
                    <button class="btn btn-sm btn-outline-secondary" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">Next</button>
                </div>
            </td>
        `;
        tbody.appendChild(paginationRow);
    }

    console.log(`Table populated with ${paginatedData.length} earthquakes (page ${currentPage} of ${totalPages})!`);
}

function changePage(page) {
    currentPage = page;
    populateTable();
    document.getElementById('recent').scrollIntoView({ behavior: 'smooth' });
}

window.changePage = changePage;

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
    document.querySelectorAll('.timeline-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.timeline-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const period = this.getAttribute('data-period');
            currentTimelinePeriod = period;
            createTimelineChart(period);
        });
    });

    document.addEventListener('click', function(e) {
        const isControlClick = e.target.closest('.magnitude-control, .base-layer-control, .date-range-control, .days-control, .magnitude-popup, .layer-menu, .date-picker-popup, .days-popup');
        if (!isControlClick) {
            closeAllPopups();
        }
    });
}

console.log('Script.js loaded successfully!');
