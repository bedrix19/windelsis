const { MapManager } = window.Windelsis;

const randomDataCheckbox = document.getElementById('randomData');
const demoModeCheckbox = false;

const demoWindyParams = {
  lineWidth: 2.5,
  particleMultiplier: 0.00075,
  frameRate: 20,
};

const testOptions = {
  //maxBounds: [[43.98, -9.41],[42.95, -7.59]], // Need 2 corners
  //maxGridPoints: 100,
  //pointDistance: 0.0625, // Will ignore maxGridPoints if set
}

let mapManager = new MapManager('map', null, {
  ...testOptions,
  center: [43.3623, -8.4104],
  zoom: 10,
  randomData: randomDataCheckbox.checked,
  demoMode: demoModeCheckbox,
  windyParams: demoWindyParams,
});

const map = mapManager.map;

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
    demoMode: demoModeCheckbox,
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
