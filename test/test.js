const { MapManager } = window.Windelsis;

const randomDataCheckbox = document.getElementById('randomData');

const demoWindyParams = {
  lineWidth: 2.5,
  particleMultiplier: 0.00075,
  frameRate: 20,
};

const testOptions = {
  maxBounds: [[43.98, -9.41],[42.95, -7.59]], // Need 2 corners
  //maxGridPoints: 100,
  //pointDistance: 1, // Will ignore maxGridPoints if set
  demoMode: true,
}

/**
 * Madrid: 40.4167, -3.7033
 * Coruña: 43.3623, -8.4104
 * Vigo: 42.2406, -8.7207
 * SdC: 42.8769, -8.5442
 * Pamplona: 42.8169, -1.6458
 * Lisboa: 38.7223, -9.1393
 * Tavira: 37.1318, -7.6430
 */
let mapManager = new MapManager('map', null, {
  ...testOptions,
  center: [43.3623, -8.4104],
  zoom: 10,
  randomData: randomDataCheckbox.checked,
  windyParams: demoWindyParams,
});

const map = mapManager.map;

// Añadir capa base de OpenStreetMap
if(!testOptions.demoMode)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

await mapManager.getCurrentData();
mapManager.velocityLayer.addTo(map);

document.getElementById('testCurrent').addEventListener('click', async () => {
  await mapManager.getCurrentData();
  console.log('Current data loaded');
  console.log(mapManager.currentGrid);
  console.log(mapManager.gridsMap);
  }
);
document.getElementById('testForecast').addEventListener('click', async () => {
  const forecastDate = document.getElementById('forecastDate').value;
  if (!forecastDate) {
    alert('Please select a date before continuing');
    return;
  }
  await mapManager.getWeatherData(forecastDate);
  console.log('Forecast data loaded');
  console.log(mapManager.currentGrid);
  console.log(mapManager.gridsMap);
});
document.getElementById('testForecastHour').addEventListener('click', async () => {
  const forecastDate = document.getElementById('forecastDate').value;
  const forecastTime = document.getElementById('forecastTime').value;
  if(!forecastDate || !forecastTime || forecastTime < 0 || forecastTime > 23) {
    alert('Please select a date and an valid hour (0-23) before continuing');
    return;
  }
  await mapManager.getHourlyWeatherData(forecastDate,forecastTime);
  console.log('Hourly Forecast data loaded');
  console.log(mapManager.currentGrid);
  console.log(mapManager.gridsMap);
});

document.getElementById('testRecreate').addEventListener('click', async () => {
  // recreate the object
  let currentCenter = mapManager.map.getCenter();
  let currentZoom = mapManager.map.getZoom();
  mapManager.destroy();
  mapManager = new MapManager(map, null, {
    ...testOptions,
    center: currentCenter,   
    zoom: currentZoom,
    randomData: randomDataCheckbox.checked,
    windyParams: demoWindyParams
  });
});

document.getElementById('updateWindyParams').addEventListener('click', () => {
  console.log('Updating windy parameters');
  mapManager.setWindyParameters({
    maxVelocity: parseFloat(document.getElementById('maxVelocity').value),
    velocityScale: parseFloat(document.getElementById('velocityScale').value),
    particleAge: parseInt(document.getElementById('particleAge').value),
    lineWidth: parseFloat(document.getElementById('lineWidth').value),
    particleMultiplier: parseFloat(document.getElementById('particleMultiplier').value),
    frameRate: parseInt(document.getElementById('frameRate').value)
  });
});

document.getElementById('toggleUpdates').addEventListener('click', () => {
  console.log('Toggling updates');
  const button = document.getElementById('toggleUpdates');
  const isPaused = mapManager.toggleUpdates();
  button.textContent = isPaused ? 'Resume Updates' : 'Pause Updates';
});

document.getElementById('changeGridOptions').addEventListener('click', () => {
  console.log('Changing area options');
  const lat0 = parseFloat(document.getElementById('minLat').value);
  const lat1 = parseFloat(document.getElementById('maxLat').value);
  const lng0 = parseFloat(document.getElementById('minLon').value);
  const lng1 = parseFloat(document.getElementById('maxLon').value);
  mapManager.options.maxBounds = [
    [lat0, lng0],
    [lat1, lng1]
  ];
});

document.getElementById('applyConfig').addEventListener('click', () => {
  const pd = parseFloat(document.getElementById('pointDistance').value);
  const mg = parseInt(document.getElementById('maxGridPoints').value, 10);
  const lat1 = parseFloat(document.getElementById('boundsLat1').value);
  const lng1 = parseFloat(document.getElementById('boundsLng1').value);
  const lat2 = parseFloat(document.getElementById('boundsLat2').value);
  const lng2 = parseFloat(document.getElementById('boundsLng2').value);

  const config = {};
  if (!isNaN(pd)) config.pointDistance = pd;
  if (!isNaN(mg)) config.maxGridPoints = mg;
  if (![lat1, lng1, lat2, lng2].some(isNaN)) {
    config.maxBounds = [[lat1, lng1], [lat2, lng2]];
  }

  // Aplicar nueva configuración
  mapManager.updateConfig(config);
});

/**************************
 * Test color scales/opacity
 *************************/
function testColorScales() {
    // Test different color scales for temperature
    const customTempScale = [
        { value: -10, color: [0, 0, 255] },
        { value: 0,   color: [255, 255, 255] },
        { value: 10,  color: [0, 255, 0] },  
        { value: 20,  color: [255, 255, 0] },
        { value: 30,  color: [255, 0, 0] }
    ];

    // Test different color scales for precipitation
    const customPrecScale = [
        { value: 0,  color: [0, 0, 0] },
        { value: 10, color: [0, 191, 255] },
        { value: 20, color: [0, 0, 255] },
        { value: 30, color: [138, 43, 226] },
        { value: 50, color: [75, 0, 130] }
    ];

    // Apply new scales
    mapManager.updateConfig({
        temperatureColorScale: customTempScale,
        precipitationColorScale: customPrecScale
    });

    console.log('Custom color scales applied');
}
function testOpacityLevels() {
    // Test sequence of different opacity levels
    const opacityLevels = [0.2, 0.4, 0.6, 0.8];
    let currentIndex = 0;

    const opacityInterval = setInterval(() => {
        if (currentIndex >= opacityLevels.length) {
            clearInterval(opacityInterval);
            return;
        }

        const opacity = opacityLevels[currentIndex];
        mapManager.updateConfig({
            temperatureOpacity: opacity,
            precipitationOpacity: opacity
        });

        console.log(`Opacity set to: ${opacity}`);
        currentIndex++;
    }, 2000); // Change every 2 seconds
}
//testColorScales();
//testOpacityLevels();
// Add to your HTML
/*
document.getElementById('mapControls').innerHTML += `
    <button id="testColors" class="button-style">Test Colors</button>
    <button id="testOpacity" class="button-style">Test Opacity</button>
`;

// Add event listeners
document.getElementById('testColors').addEventListener('click', testColorScales);
document.getElementById('testOpacity').addEventListener('click', testOpacityLevels);
*/
/**************************
 * Toggle show/hide controls
 *************************/
document.getElementById('toggleButton').addEventListener('click', function() {
  const mapControls = document.getElementById('mapControls');
  if (mapControls.style.display === 'none' || mapControls.style.display === '') {
    mapControls.style.display = 'flex'; // Show the controls
  } else {
    mapControls.style.display = 'none'; // Hide the controls
  }
});
function positionToggleButton() {
    const toggleButton = document.getElementById('toggleButton');
    const leafletControl = document.querySelector('.leaflet-control-layers');
    if (leafletControl) {
        const rect = leafletControl.getBoundingClientRect();
        toggleButton.style.top = `${rect.bottom + window.scrollY + 10}px`; // 10px below the control
        toggleButton.style.left = `${rect.left}px`; // Align with the left of the control
    }
}
positionToggleButton();