import { MapManager } from "../src/js/mapManager.js";
import { openMeteoApiCaller } from "../src/js/apiService.js";

/**
 * Madrid: 40.4167, -3.7033
 * Coruña: 43.3623, -8.4104
 * Vigo: 42.2406, -8.7207
 * SdC: 42.8769, -8.5442
 * Pamplona: 42.8169, -1.6458
 * Lisboa: 38.7223, -9.1393
 * Tavira: 37.1318, -7.6430
 */
let mapManager = new MapManager('map', openMeteoApiCaller,{
  center: [43.3623, -8.4104],
  zoom: 11,
  updateDelay: 500,
});

document.getElementById('testCurrent').addEventListener('click', async () => mapManager.getCurrentData());
document.getElementById('testForecast').addEventListener('click', async () => {
  const forecastDate = document.getElementById('forecastDate').value;
  if (!forecastDate) {
    alert('Please select a date before continuing');
    return;
  }
  mapManager.getForecastData(forecastDate, forecastDate);
});
document.getElementById('testForecastHour').addEventListener('click', async () => {
  const forecastDate = document.getElementById('forecastDate').value;
  const forecastTime = document.getElementById('forecastTime').value;
  if(!forecastDate || !forecastTime) {
    alert('Please select a date and an hour before continuing');
    return;
  }
  mapManager.getHourlyForecast(
    forecastDate, forecastDate,
    forecastTime
  );
});

document.getElementById('testDestroy').addEventListener('click', async () => {
  // recreate the object
  let currentCenter = mapManager.map.getCenter();
  let currentZoom = mapManager.map.getZoom();
  mapManager.destroy();
  mapManager = new MapManager('map', {
    center: currentCenter,   
    zoom: currentZoom,
    updateDelay: 500,
    pointDistance: parseFloat(document.getElementById('pointDistance').value) || undefined,
    windyParameters: {
        maxVelocity: 15,
        velocityScale: 0.008
    }
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