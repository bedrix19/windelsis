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
/*
  L.marker([42, -8]).addTo(map).bindPopup("42, -8");
  L.marker([42, -9]).addTo(map).bindPopup("42, -9");
  L.marker([43, -8]).addTo(map).bindPopup("43, -8");
  L.marker([43, -9]).addTo(map).bindPopup("43, -9");
*/
  var layerControl = L.control.layers(baseLayers);
  layerControl.addTo(map);
  map.setView([42.8, -8.5], 10);

  // pop up with coordinates on click
  map.on("click", function(e) {
    alert("Coordinates: " + e.latlng.lat + ", " + e.latlng.lng);
  });

  return {
    map: map,
    layerControl: layerControl
  };
}

// Ejemplo de resutlado de API Open-Meteo
const exampleData = [
  {
    latitude: 42,
    longitude: -8,
    current_weather_units: {
      temperature: "°C",
      windspeed: "km/h",
      windDirection: "°"
    },
    current_weather: {
      temperature: 15,
      windspeed: 10,
      winddirection: 180,
      is_day: 1
    }
  }
];

// Convertir velocidad del viento de km/h a m/s
function convertWindSpeed(speed) {
  return speed * 0.27778;
}

// Convertir dirección del viento a componentes u y v
function convertWindDirection(speed, direction) {
  const rad = direction * (Math.PI / 180);

  // El signo es negativo porque la direccion del viento indica de donde viene
  const u = - speed * Math.sin(rad); // Componente U (este-oeste)
  const v = - speed * Math.cos(rad); // Componente V (norte-sur)
  return { u, v };
}

// Obtener las coordenadas de los límites del mapa
function getMapBoundsCoordinates(map) {
  const bounds = map.getBounds();
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();
  const northWest = L.latLng(northEast.lat, southWest.lng);
  const southEast = L.latLng(southWest.lat, northEast.lng);

  return {
    northWest: northWest,
    northEast: northEast,
    southWest: southWest,
    southEast: southEast
  };
}

// Logica para construir el json para usar con leaflet-velocity
function dataBuilder(uComponent, vComponent, nx, ny, dx, dy, boundaries) {
  // Comprobar que tenemos la cantidad de datos correcta
  

  const windData = [
    {
      header: {
        parameterUnit: "m.s-1",
        parameterNumberName: "eastward_wind",
        parameterCategory: 2,
        parameterNumber: 2,
        lo1: boundaries.northWest.lng,
        lo2: boundaries.southWest.lng,
        la1: boundaries.northEast.lat,
        la2: boundaries.southEast.lat,
        nx: nx,
        ny: ny,
        dx: dx,
        dy: dy
      },
      data: uComponent
    },
    {
      header: {
        parameterUnit: "m.s-1",
        parameterNumberName: "northward_wind",
        parameterCategory: 2,
        parameterNumber: 3,
        lo1: boundaries.northWest.lng,
        lo2: boundaries.southWest.lng,
        la1: boundaries.northEast.lat,
        la2: boundaries.southEast.lat,
        nx: nx,
        ny: ny,
        dx: dx,
        dy: dy
      },
      data: vComponent
    }
  ];

  console.log("windData", JSON.stringify(windData, null, 2));
  return windData;
}

/**
 * Los puntos de latitud de la API son multiplos de .0625 (Si mandamos uno distinto los redondea)
 * Se actualizan cada hora y cuarto
 */
async function fetchWindData(latitudes, longitudes) {
  const latString = latitudes.join(',');
  const lonString = longitudes.join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latString}&longitude=${lonString}&current_weather=true`;
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

function initializeWindLayer(map, windData) {
  var velocityLayer = L.velocityLayer({
    displayValues: true,
    displayOptions: {
      velocityType: "Global Wind",
      position: "bottomleft",
      emptyString: "No wind data"
    },
    data: windData,
    maxVelocity: 15,
  });

  velocityLayer.addTo(map);
  // Añadir la capa al control de capas
  layerControl.addOverlay(velocityLayerAPI, "API Wind Data");
}

// Calcular nx, ny, dx y dy
function calculateGridParameters(bounds, resolution) {
  const lonRange = Math.abs(bounds.northEast.lng - bounds.southWest.lng);
  const latRange = Math.abs(bounds.northEast.lat - bounds.southWest.lat);

  const nx = Math.ceil(lonRange * resolution) + 1;
  const ny = Math.ceil(latRange * resolution) + 1;

  const dx = lonRange / (nx-1);
  const dy = latRange / (ny-1);
  // Si quisiéramos que el grid sea cuadrado, podríamos hacer dx = dy = Math.max(dx, dy); y
  // para multiplos de .0 y .5, podríamos hacer dx = dy = Math.ceil(Math.max(dx, dy) * 2) / 2;
  // y multiplos de .0

  return { nx, ny, dx, dy };
}

// Generar las coordenadas de los puntos
function generateGridCoordinates(bounds, nx, ny, dx, dy) {
  const longitudes = [];
  const latitudes = [];

  for (let i = 0; i < ny; i++) {
    for (let j = 0; j < nx; j++) {
      longitudes.push(bounds.northWest.lng + j * dx);
      latitudes.push(bounds.northWest.lat - i * dy);

      console.log(`Lng: ${bounds.northWest.lng + j * dx}, Lat: ${bounds.northWest.lat - i * dy}`);

      // Añadir los puntos al mapa
      L.marker([bounds.northWest.lat - i * dy, bounds.northWest.lng + j * dx]).addTo(map)
        .bindPopup(
          `Lat: ${bounds.northWest.lat - i * dy}, Lng: ${bounds.northWest.lng + j * dx}`
        );
    }
  }

  return { latitudes, longitudes };
}

// Inicializar el mapa de demostración
var mapStuff = initDemoMap();
var map = mapStuff.map;
var layerControl = mapStuff.layerControl;

// Obtener los límites del mapa
var gridLimits = getMapBoundsCoordinates(map);

console.log("northWest", gridLimits.northWest);
console.log("northEast", gridLimits.northEast);
console.log("southWest", gridLimits.southWest);
console.log("southEast", gridLimits.southEast);

// Datos para la cuadricula
const resolution = 3;
const { nx, ny, dx, dy } = calculateGridParameters(gridLimits, resolution);

console.log("nx:", nx, "ny:", ny, "dx:", dx, "dy:", dy);

var la1 = gridLimits.northEast.lat, la2 = gridLimits.southEast.lat;
var lo1 = gridLimits.northWest.lng, lo2 = gridLimits.southWest.lng;
console.log("Primer punto", lo1, la1);
console.log("Segundo punto", lo2, la2);

// Generar las coordenadas de los puntos
const { latitudes, longitudes } = generateGridCoordinates(gridLimits, nx, ny, dx, dy);

var u_component = [], v_component = [];

fetchWindData(latitudes, longitudes).then(data => {
  console.log("...", ...data);
  console.log("data", data);
  console.log("data", data[0].current_weather);
  console.log(JSON.stringify(data[0], null, 2));

  console.log("data.length", data.length);
  for (let i = 0; i < data.length; i++) { // data.length should be equal to nx * ny
    const windSpeedMs = convertWindSpeed(data[i].current_weather.windspeed);
    const windDirection = data[i].current_weather.winddirection;
    const { u, v } = convertWindDirection(windSpeedMs, windDirection);
    u_component.push(u);
    v_component.push(v);
  }
  
  // Construir los datos para leaflet-velocity
  var windData = dataBuilder(u_component, v_component, nx, ny, dx, dy, gridLimits);
  
  // initializeWindLayer(map, windData);
  var velocityLayer = L.velocityLayer({
    displayValues: true,
    displayOptions: {
      velocityType: "Global Wind",
      position: "bottomleft",
      emptyString: "No wind data",
      showCardinal: true
    },
    data: windData,
    maxVelocity: 10,
  });

  // Añadir la capa al control de capas
  layerControl.addOverlay(velocityLayer, "API Wind Data");
});