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

  console.log("Puntos de los límites del mapa NW:", northWest," NE:", northEast," SW:", southWest," SE:", southEast);

  function roundToMultiple(value, multiple, roundUp) {
    return roundUp
      ? Math.ceil(value / multiple) * multiple
      : Math.floor(value / multiple) * multiple;
  }

  return {
    northWest: L.latLng(
      roundToMultiple(northWest.lat, 0.0625, true),
      roundToMultiple(northWest.lng, 0.0625, false)
    ),
    northEast: L.latLng(
      roundToMultiple(northEast.lat, 0.0625, true),
      roundToMultiple(northEast.lng, 0.0625, true)
    ),
    southWest: L.latLng(
      roundToMultiple(southWest.lat, 0.0625, false),
      roundToMultiple(southWest.lng, 0.0625, false)
    ),
    southEast: L.latLng(
      roundToMultiple(southEast.lat, 0.0625, false),
      roundToMultiple(southEast.lng, 0.0625, true)
    )
  };
}

// Logica para construir el json para usar con leaflet-velocity
function dataBuilder(uComponent, vComponent, nx, ny, dx, dy, boundaries) {
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
async function fetchWeatherData(latitudes, longitudes) {
  const latString = latitudes.join(',');
  const lonString = longitudes.join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latString}&longitude=${lonString}&current=temperature_2m,relative_humidity_2m,is_day,precipitation,rain,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`;
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
function calculateGridParameters(bounds, pointDistance=0.0625) {
  const lonRange = Math.abs(bounds.northEast.lng - bounds.southWest.lng);
  const latRange = Math.abs(bounds.northEast.lat - bounds.southWest.lat);
  console.log("lonRange", lonRange, "latRange", latRange);

  let auxDistance = 0;
  for(let i = 0; i < 16; i++) {
    if(latRange <= 0.0625 * i || lonRange <= 0.0625 * i) {
      auxDistance = 0.0625 * i;
      console.log("Se ajusta a", auxDistance * i);
      break;
    }
  }

  if(auxDistance != 0 && auxDistance < pointDistance) pointDistance = auxDistance;

  const nx = Math.ceil(lonRange / pointDistance) + 1;
  const ny = Math.ceil(latRange / pointDistance) + 1;

  const dx = pointDistance;
  const dy = pointDistance;

  return { nx, ny, dx, dy };
}

// Generar las coordenadas de los puntos
function generateGridCoordinates(map, bounds, nx, ny, dx, dy) {
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

export function fetchAndDrawWindData(map, layerControl, pointDistance = 1) {
  // Obtener los límites del mapa
  var gridLimits = getMapBoundsCoordinates(map);

  console.log("northWest", gridLimits.northWest);
  console.log("northEast", gridLimits.northEast);
  console.log("southWest", gridLimits.southWest);
  console.log("southEast", gridLimits.southEast);

  // Datos para la cuadricula
  const { nx, ny, dx, dy } = calculateGridParameters(gridLimits, pointDistance);

  console.log("nx:", nx, "ny:", ny, "dx:", dx, "dy:", dy);

  var la1 = gridLimits.northEast.lat, la2 = gridLimits.southEast.lat;
  var lo1 = gridLimits.northWest.lng, lo2 = gridLimits.southWest.lng;
  console.log("Primer punto", lo1, la1);
  console.log("Segundo punto", lo2, la2);

  // Generar las coordenadas de los puntos
  const { latitudes, longitudes } = generateGridCoordinates(map, gridLimits, nx, ny, dx, dy);

  var u_component = [], v_component = [];

  fetchWeatherData(latitudes, longitudes).then(data => {
    console.log("...", ...data);
    console.log("data.length", data.length);

    for (let i = 0; i < data.length; i++) { // data.length should be equal to nx * ny
      var windSpeedMs;
      if(data[i].current_units.wind_speed_10m == "km/h") {
        windSpeedMs = data[i].current.wind_speed_10m * 0.27778;
      }else if(data[i].current_units.wind_speed_10m == "m/s") {
        windSpeedMs = data[i].current.wind_speed_10m;
      }else console.error("Unrecognized wind speed unit");

      var windDirection = data[i].current.wind_direction_10m;
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
        // ... otros parámetros ...
      },
      data: windData,
      maxVelocity: 15
    });

    layerControl.addOverlay(velocityLayer, "API Wind Data"); // Añadir la capa al control de capas
    velocityLayer.addTo(map); // Añadir la capa al mapa 'por defecto'
    map.setZoom(map.getZoom() - 1); // Ajustar el zoom para que se vea la capa
    map.addLayer(velocityLayer);
  });
}