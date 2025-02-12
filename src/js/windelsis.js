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
function getMapBoundsCoordinates(map, adjustment = 0) {
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
      roundToMultiple(northWest.lat, 0.0625, true) + adjustment,
      roundToMultiple(northWest.lng, 0.0625, false) - adjustment
    ),
    northEast: L.latLng(
      roundToMultiple(northEast.lat, 0.0625, true) + adjustment,
      roundToMultiple(northEast.lng, 0.0625, true) + adjustment
    ),
    southWest: L.latLng(
      roundToMultiple(southWest.lat, 0.0625, false) - adjustment,
      roundToMultiple(southWest.lng, 0.0625, false) - adjustment
    ),
    southEast: L.latLng(
      roundToMultiple(southEast.lat, 0.0625, false) - adjustment,
      roundToMultiple(southEast.lng, 0.0625, true) + adjustment
    )
  };
}

// Logica para construir el json para usar con leaflet-velocity
function dataBuilder(data, nx, ny, dx, dy, boundaries, dateType = 'current', hour_index) {
  var u_component = [], v_component = [];
  if(dateType == 'forecast_hourly') {
    for (let i = 0; i < data.length; i++) { // data.length should be equal to nx * ny
      var windSpeedMs;
      if(data[i].hourly_units.wind_speed_10m == "km/h") {
        windSpeedMs = data[i].hourly.wind_speed_10m[hour_index] * 0.27778;
      }else if(data[i].hourly_units.wind_speed_10m == "m/s") {
        windSpeedMs = data[i].hourly.wind_speed_10m[hour_index];
      }else console.error("Unrecognized wind speed unit");
  
      var windDirection = data[i].hourly.wind_direction_10m[hour_index];
      const { u, v } = convertWindDirection(windSpeedMs, windDirection);
      u_component.push(u);
      v_component.push(v);
    }
  }
  else if (dateType == 'forecast') {
    for (let i = 0; i < data.length; i++) {
      var windSpeedMs;
      if(data[i].daily_units.wind_speed_10m_max == "km/h") {
        windSpeedMs = data[i].daily.wind_speed_10m_max[0] * 0.27778;
      }else if(data[i].daily_units.wind_speed_10m_max == "m/s") {
        windSpeedMs = data[i].daily.wind_speed_10m_max[0];
      }else console.error("Unrecognized wind speed unit");
  
      var windDirection = data[i].daily.wind_direction_10m_dominant[0];
      const { u, v } = convertWindDirection(windSpeedMs, windDirection);
      u_component.push(u);
      v_component.push(v);
    }
  }
  else if(dateType == 'current') {
    for (let i = 0; i < data.length; i++) {
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
  }
  else console.error("Unrecognized data type");

  const windData = [
    {
      header: {
        parameterUnit: "m.s-1",
        parameterNumberName: "eastward_wind",
        parameterCategory: 2,
        parameterNumber: 2,
        lo1: boundaries.northWest.lng,
        lo2: boundaries.southEast.lng,
        la1: boundaries.northWest.lat,
        la2: boundaries.southEast.lat,
        nx: nx,
        ny: ny,
        dx: dx,
        dy: dy
      },
      data: u_component
    },
    {
      header: {
        parameterUnit: "m.s-1",
        parameterNumberName: "northward_wind",
        parameterCategory: 2,
        parameterNumber: 3,
        lo1: boundaries.northWest.lng,
        lo2: boundaries.southEast.lng,
        la1: boundaries.northWest.lat,
        la2: boundaries.southEast.lat,
        nx: nx,
        ny: ny,
        dx: dx,
        dy: dy
      },
      data: v_component
    }
  ];

  console.log("windData", JSON.stringify(windData, null, 2));
  return windData;
}

/**
 * Los puntos de latitud de la API son multiplos de .0625 (Si mandamos uno distinto los redondea)
 * Se actualizan cada hora y cuarto
 */
async function fetchWeatherData(latitudes, longitudes, nx, ny, dateType = 'current', start_date = null, end_date = null) {
  const fetchPromises = []; // Array to store all fetch promises
  const orderedResults = Array(ny).fill().map(() => Array(nx).fill(null)); // creates 2D array to store data
  
  for (let rowIndex = 0; rowIndex < latitudes.length; rowIndex++) {
    const lat = latitudes[rowIndex];
    // Para esta fila, repetir la misma latitud para cada longitud
    const latParams = new Array(nx).fill(lat).join(',');
    // Obtener las longitudes para esta fila
    const lonParams = longitudes.join(',');
    
    let url;
    switch(dateType) {
      case 'current':
        url = `https://api.open-meteo.com/v1/forecast?latitude=${latParams}&longitude=${lonParams}&current=temperature_2m,relative_humidity_2m,is_day,precipitation,rain,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`;
        break;
      case 'forecast':
        url = `https://api.open-meteo.com/v1/forecast?latitude=${latParams}&longitude=${lonParams}&start_date=${start_date}&end_date=${end_date}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant&wind_speed_unit=ms&timezone=auto`;
        break;
      case 'forecast_hourly':
        url = `https://api.open-meteo.com/v1/forecast?latitude=${latParams}&longitude=${lonParams}&start_date=${start_date}&end_date=${end_date}&hourly=temperature_2m,is_day,precipitation,rain,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=auto`;
        break;
      default:
        console.error("Unrecognized data type");
    }

    // Store promise with its row index for ordering later
    fetchPromises.push(
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          return response.json();
        })
        .then(data => ({data, rowIndex}))
    );
  }

  try {
    // Wait for all fetches to complete
    const results = await Promise.all(fetchPromises);
    
    // Order results into grid
    results.forEach(({data, rowIndex}) => {
      data.forEach((point, colIndex) => {
        orderedResults[rowIndex][colIndex] = point;
      });
    });

    // Convert 2D array to 1D array ordered from NW to SE
    const finalResults = orderedResults.flat();
    return finalResults;
    
  } catch (error) {
    console.error('Fetching weather data failed:', error);
    throw error;
  }
}

function initializeWindLayer(map, windData) {
  var velocityLayer = L.velocityLayer({
    displayValues: true,
    displayOptions: {
      velocityType: "Wind data",
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
  const longitudes = [], latitudes = [];

  for (let i=0;i<ny;i++) latitudes.push(bounds.northWest.lat - i * dy);
  for (let j=0;j<nx;j++) longitudes.push(bounds.northWest.lng + j * dx);

  return { latitudes, longitudes };
}

export async function fetchAndDrawWindData({map, layerControl, pointDistance = 1, velocityLayer = null, dateType, start_date = null, end_date = null, hour_index = null, adjustment = 0}) {
  console.log("Tipo de datos: ",dateType)

  // Obtener los límites del mapa
  var gridLimits = getMapBoundsCoordinates(map, adjustment);

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

  // Obtener los datos del API
  const data = await fetchWeatherData(latitudes, longitudes, nx, ny, dateType, start_date, end_date);
  console.log("...", ...data);
  console.log("data.length", data.length);

  // Construir los datos para leaflet-velocity
  const windData = dataBuilder(data, nx, ny, dx, dy, gridLimits, dateType, hour_index);

  if (velocityLayer) {
    velocityLayer.setData(windData); // Actualizar los datos de la capa existente
  } else {
    // Crear una nueva capa si no existe
    velocityLayer = L.velocityLayer({
      displayValues: true,
      displayOptions: {
        velocityType: "Global Wind",
        emptyString: "No velocity data"
      },
      // windy parameters
      data: windData,
      maxVelocity: 10,
      minVelocity: 0,
      velocityScale: 0.005,
      particleAge: 90,
      lineWidth: 1,
      particleMultiplier: 1 / 300,
      frameRate: 15,
    });

    layerControl.addOverlay(velocityLayer, "API Wind Data"); // Añadir la capa
    velocityLayer.addTo(map); // Mostrar la capa
    map.addLayer(velocityLayer); // Añadirla al campo de control
  }
  //map.setZoom(map.getZoom() - 1); // Ajustar el zoom para que se vea la capa

  // Retornar la capa para poder actualizarla
  return velocityLayer;
}