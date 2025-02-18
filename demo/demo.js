import { MapManager } from "../src/js/windelsis.js";

function initDemoMap() {
    var Esri_WorldImagery = L.tileLayer(
      "http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, " +
          "AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
      }
    );
  
    var Esri_DarkGreyCanvas = L.tileLayer(
      "http://{s}.sm.mapstack.stamen.com/" +
        "(toner-lite,$fff[difference],$fff[@23],$fff[hsl-saturation@20])/" +
        "{z}/{x}/{y}.png",
      {
        attribution:
          "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, " +
          "NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community"
      }
    );
  
    var baseLayers = {
      Satellite: Esri_WorldImagery,
      "Grey Canvas": Esri_DarkGreyCanvas
    };
  
    var map = L.map("map", {
      layers: [Esri_WorldImagery]
    });

    var layerControl = L.control.layers(baseLayers);
    layerControl.addTo(map);
    map.setView([40.05, -4.16], 7);
  
    // pop up with coordinates on click
    map.on("click", function(e) {
      alert("Coordinates: " + e.latlng.lat + ", " + e.latlng.lng);
    });
  
    return {
      map: map,
      layerControl: layerControl
    };
}

// Inicializar el mapa de demostración
let mapManager = new MapManager('map', {
  center: [40.05, -4.16],
  zoom: 7,
  updateDelay: 500,
  windyParameters: {
      maxVelocity: 15,
      velocityScale: 0.008
  }
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
    windyParameters: {
        maxVelocity: 15,
        velocityScale: 0.008
    }
  });

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