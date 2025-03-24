import { MapManager } from "../src/js/mapManager.js";

/**
 * Madrid: 40.4167, -3.7033
 * Coruña: 43.3623, -8.4104
 * Vigo: 42.2406, -8.7207
 * SdC: 42.8769, -8.5442
 * Pamplona: 42.8169, -1.6458
 * Lisboa: 38.7223, -9.1393
 * Tavira: 37.1318, -7.6430
 */
let mapManager = new MapManager('map', {
  center: [37.1318, -7.6430],
  zoom: 11,
  updateDelay: 500,
});

await mapManager.getCurrentData();

document.getElementById('testMapManager').addEventListener('click', async () => {
  //get map data to destroy and recreate the object
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

  let dateType;
  if(forecastTime && forecastDate) dateType = 'forecast_hourly';
  else if (forecastDate) dateType = 'forecast';

  await mapManager.getCurrentData();
});

document.getElementById('fetchWindDataButton').addEventListener('click', () => {
    const pointDistance = parseFloat(document.getElementById('pointDistance').value) || 1;
    const forecastDate = document.getElementById('forecastDate').value;
    const forecastTime = parseInt(document.getElementById('forecastTime').value);
    const adjustment = parseInt(document.getElementById('mapAdjustment').value);
    const windyParameters = {
      maxVelocity: parseFloat(document.getElementById('maxVelocity').value),
      minVelocity: parseFloat(document.getElementById('minVelocity').value),
      velocityScale: parseFloat(document.getElementById('velocityScale').value),
      particleAge: parseInt(document.getElementById('particleAge').value),
      lineWidth: parseFloat(document.getElementById('lineWidth').value),
      particleMultiplier: parseFloat(document.getElementById('particleMultiplier').value),
      frameRate: parseInt(document.getElementById('frameRate').value)
    };

    console.log(forecastTime);
    let dateType;
    if(forecastTime && forecastDate) dateType = 'forecast_hourly';
    else if (forecastDate) dateType = 'forecast';
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