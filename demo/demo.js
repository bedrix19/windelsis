import { fetchAndDrawWindData } from "../src/js/windelsis.js";

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
    map.setView([42.8024, -1.7516], 7);
  
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
var mapStuff = initDemoMap();
var map = mapStuff.map;
var layerControl = mapStuff.layerControl;
var velocityLayer = null;

document.getElementById('fetchWindDataButton').addEventListener('click', () => {
    const pointDistance = parseFloat(document.getElementById('pointDistance').value) || 1;
    const forecastDate = document.getElementById('forecastDate').value;
    const forecastTime = parseInt(document.getElementById('forecastTime').value);
    const adjustment = parseInt(document.getElementById('mapAdjustment').value);
    console.log(forecastTime);
    let dateType;
    if(forecastTime && forecastDate) dateType = 'forecast_hourly';
    else if (forecastDate) dateType = 'forecast';
    fetchAndDrawWindData({
      map:map,
      layerControl:layerControl,
      pointDistance:pointDistance,
      velocityLayer:velocityLayer,
      dateType:dateType || 'current',
      start_date:forecastDate,
      end_date:forecastDate,
      hour_index:forecastTime,
      adjustment:adjustment || 0
    }).then(newLayer => {
        velocityLayer = newLayer;
    });
});