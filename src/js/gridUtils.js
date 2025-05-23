import { GridPoint } from "./gridPoint.js";

function generateRandomGridData(points) {//console.log("Generating random grid data...");
  const baseTemperature = (Math.random() * 20) + 5; // temperature between 5º y 25º
  const baseWindSpeed = (Math.random() * 10) + 5; // wind speed between 5 and 15 m/s
  const baseWindDirection = Math.random() * 360; // wind direction between 0 and 360 degrees
  const basePrecipitation = Math.random() * 5; // precipitation between 0 and 5 mm

  // Check if points is a Map and convert to array if necessary
  const pointsArray = points instanceof Map ? Array.from(points.values()) : points;

  pointsArray.forEach(point => {
    const randomTemperature = (baseTemperature + (Math.random() * 10 - 5)).toFixed(2); // variance of ±5
    const randomWindSpeed = (baseWindSpeed + (Math.random() * 5 - 2.5)).toFixed(2); // variance of ±2.5
    const randomWindDirection = (baseWindDirection + (Math.random() * 180 - 45)).toFixed(2); // variance of ±45
    const randomPrecipitation = (basePrecipitation + (Math.random() * 2 - 1)).toFixed(2); // variance of ±1

    const weatherData = {
      weather_units: {
        temperature: '°C',
        wind_speed: 'm/s',
        wind_direction: '°',
        precipitation: 'mm'
      },
      temperature: parseFloat(randomTemperature),
      wind: {
        speed: parseFloat(randomWindSpeed),
        direction: parseFloat(randomWindDirection)
      },
      precipitation: parseFloat(randomPrecipitation),
      timestamp: new Date().toISOString(), // Format: yyyy-mm-ddTHH:MM:SS.000Z
      rawData: null
    };

    point.setWeatherData(weatherData);
  });
}

// convert wind speed and direction to u and v components
function convertWindDirection(speed, direction) {
  const rad = direction * (Math.PI / 180);

  // negative sign because in meteorology, wind direction is given as the direction from which the wind is coming
  const u = - speed * Math.sin(rad); // east-west component
  const v = - speed * Math.cos(rad); // north-south component
  return { u, v };
}

function getBoundsAtZoom(map, zoomLevel) {
  const center = map.getCenter();
  const bounds = map.getPixelBounds(center, zoomLevel);

  // Convertir los límites a coordenadas geográficas
  const southWest = map.unproject(bounds.getBottomLeft(), zoomLevel); //L.marker(southWest).addTo(map);
  const northEast = map.unproject(bounds.getTopRight(), zoomLevel);   //L.marker(northEast).addTo(map);
  
  return L.latLngBounds(southWest, northEast);
}

function adjustAndCount(rawBounds, distance, mapAdjustment = 0) {
  const mult = distance > 0.5 ? distance : 0.5;
  const { lat: swLat0, lng: swLng0 } = rawBounds.getSouthWest();
  const { lat: neLat0, lng: neLng0 } = rawBounds.getNorthEast();

  const roundTo = (v, up) =>
    up ? Math.ceil(v / mult) * mult : Math.floor(v / mult) * mult;

  const swLat = roundTo(swLat0, false) - mapAdjustment;
  const swLng = roundTo(swLng0, false) - mapAdjustment;
  const neLat = roundTo(neLat0, true)  + mapAdjustment;
  const neLng = roundTo(neLng0, true)  + mapAdjustment;

  const bounds = L.latLngBounds(
    L.latLng(swLat, swLng),
    L.latLng(neLat, neLng)
  );

  const lonRange = bounds.getEast()  - bounds.getWest();
  const latRange = bounds.getNorth() - bounds.getSouth();
  const cols = Math.round(lonRange / distance) + 1;
  const rows = Math.round(latRange / distance) + 1;
  const total = cols * rows;

  return { bounds, cols, rows, total };
}

function calculateOptimalPointDistance(rawBounds, options) {
  const candidates = [0.0625, 0.125, 0.25, 0.5, 1];
  const maxPts = options.maxGridPoints;
  const adj = options.mapAdjustment ?? 0;

  if (options.pointDistance != null) {
    const { bounds, cols, rows, total } = adjustAndCount(rawBounds, options.pointDistance, adj);
    if(options.demoMode) console.log(`Selected point distance: ${options.pointDistance}° (${rows}x${cols}=${total} points)`);
    return { pointDistance: options.pointDistance, bounds, ny: cols, nx: rows };
  }

  for (const d of candidates) {
    const { bounds, cols, rows, total } = adjustAndCount(rawBounds, d, adj);
    if (total <= maxPts) {
      if(options.demoMode) console.log(`Selected point distance: ${d}° (${rows}x${cols}=${total} points)`);
      return { pointDistance: d, bounds, ny: cols, nx: rows };
    }
    if(options.demoMode) console.log(`Distance: ${d}° would exceed maxPoints (${total}>${maxPts})`);
  }

  // Fallback
  const last = candidates[candidates.length - 1];
  const { bounds, cols, rows, total } = adjustAndCount(rawBounds, last, adj);
  if(options.demoMode) console.log(`Fallback point distance: ${last}° (${rows}x${cols}=${total} points)`);
  return { pointDistance: last, bounds, ny: cols, nx: rows };
}

function weatherDataBuilder(grid, dataType = 'temperature') {
  const { bounds, dx, dy, nx, ny, gridPointsMap } = grid;
  
  let latMin = bounds.getSouthWest().lat;
  let latMax = bounds.getNorthWest().lat;
  let lonMin = bounds.getSouthWest().lng;
  let lonMax = bounds.getSouthEast().lng;
  
  let weatherGrid = [];
  
  for (let j = 0; j < ny; j++) {
    let latitude = latMax - j * dy;
    for (let i = 0; i < nx; i++) {
      let longitude = lonMin + i * dx;
      if (latitude < latMin || longitude > lonMax) continue;
      const pointKey = generatePointKey(latitude, longitude);
      let gridPoint = gridPointsMap.has(pointKey)
        ? gridPointsMap.get(pointKey)
        : new GridPoint(latitude, longitude);
      weatherGrid.push(gridPoint);
    }
  }

  var weatherValues = [];
  for (let i = 0; i < weatherGrid.length; i++) {
    const value = dataType === 'temperature' 
      ? weatherGrid[i].getTemperature()
      : weatherGrid[i].getPrecipitation(); 
    weatherValues.push(value);
  }

  const weatherData = {
    header: {
      lo1: bounds.getNorthWest().lng,
      lo2: bounds.getSouthEast().lng,
      la1: bounds.getNorthWest().lat,
      la2: bounds.getSouthEast().lat,
      nx: nx,
      ny: ny,
      dx: dx,
      dy: dy
    },
    data: weatherValues
  };

  //console.log("Datos:", dataType, weatherData);
  return weatherData;
}

// Helper functions to maintain backwards compatibility
function tempDataBuilder(grid) {
  return weatherDataBuilder(grid, 'temperature');
}

function precipDataBuilder(grid) {
  return weatherDataBuilder(grid, 'precipitation'); 
}

function windyDataBuilder(Grid, options) {
  const { bounds, dx, dy, nx, ny, gridPointsMap } = Grid;
  const dateType = options.dateType;
  const hour_index = options.hour_index;
  
  let latMin = bounds.getSouthWest().lat;
  let latMax = bounds.getNorthWest().lat;
  let lonMin = bounds.getSouthWest().lng;
  let lonMax = bounds.getSouthEast().lng;
  
  let grid = [];
  
  for (let j = 0; j < ny; j++) {
    let latitude = latMax - j * dy;
    for (let i = 0; i < nx; i++) {
      let longitude = lonMin + i * dx;
      if (latitude < latMin || longitude > lonMax) continue;
      const pointKey = generatePointKey(latitude, longitude);
      //if(gridPointsMap.has(pointKey)) console.log("windyDataBuilder");
      let gridPoint = gridPointsMap.has(pointKey)
        ? gridPointsMap.get(pointKey)
        : new GridPoint(latitude, longitude);
      grid.push(gridPoint);
    }
  }

  var u_component = [], v_component = [];
  for (let i = 0; i < grid.length; i++) { // grid.length should be equal to nx * ny
    const { u, v } = grid[i].getWindComponents(); // console.log("u", u, "v", v);
    u_component.push(u);
    v_component.push(v);
  }

  const windData = [
    {
      header: {
        parameterUnit: "m.s-1",
        parameterNumberName: "eastward_wind",
        parameterCategory: 2,
        parameterNumber: 2,
        lo1: bounds.getNorthWest().lng,
        lo2: bounds.getSouthEast().lng,
        la1: bounds.getNorthWest().lat,
        la2: bounds.getSouthEast().lat,
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
        lo1: bounds.getNorthWest().lng,
        lo2: bounds.getSouthEast().lng,
        la1: bounds.getNorthWest().lat,
        la2: bounds.getSouthEast().lat,
        nx: nx,
        ny: ny,
        dx: dx,
        dy: dy
      },
      data: v_component
    }
  ];

  //console.log(windData); //console.log("windData", JSON.stringify(windData, null, 2));
  return windData;
}

function generatePointKey(latitude, longitude, decimals = 4) {
  return `${latitude.toFixed(decimals)}_${longitude.toFixed(decimals)}`;
}

function buildPointsLookup(points) {
  const lookup = new Map();
  points.forEach(point => {
    const key = generatePointKey(point.latitude, point.longitude);
    lookup.set(key, point);
  });
  return lookup;
}

// calculate nx, ny, dx y dy
function calculateGridParameters(bounds, pointDistance=0.0625) {
  const lonRange = Math.abs(bounds.getNorthEast().lng - bounds.getSouthWest().lng);
  const latRange = Math.abs(bounds.getNorthEast().lat - bounds.getSouthWest().lat);
  //console.log("lonRange", lonRange, "latRange", latRange);

  let auxDistance = 0;
  for(let i = 0; i < 16; i++) {
    if(latRange <= 0.0625 * i || lonRange <= 0.0625 * i) {
      //auxDistance = 0.0625 * i;
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

function gridBuilder(map, pointDistance, gridLimits, gridPointsMap, options) {//gridLimits=mapBounds => _northEast y _southWest
  if(options.demoMode){
    map.eachLayer(function(layer) {if (layer instanceof L.Marker) {map.removeLayer(layer);}});
    console.log("northWest", gridLimits.getNorthWest());L.marker(gridLimits.getNorthWest()).addTo(map);
    console.log("northEast", gridLimits.getNorthEast());L.marker(gridLimits.getNorthEast()).addTo(map);
    console.log("southWest", gridLimits.getSouthWest());L.marker(gridLimits.getSouthWest()).addTo(map);
    console.log("southEast", gridLimits.getSouthEast());L.marker(gridLimits.getSouthEast()).addTo(map);
  }

  // Datos para la cuadricula
  const { nx, ny, dx, dy } = calculateGridParameters(gridLimits, pointDistance);
  if(options.demoMode) console.log("nx:", nx, "ny:", ny, "dx:", dx, "dy:", dy);

  // Generar las coordenadas de los puntos
  const points = [];
  let count = 0, count1 = 0;
  //console.log(gridPointsMap);
  for (let i = 0; i < ny; i++) {
    const latitude = gridLimits.getNorthWest().lat - i * dy;
    for (let j = 0; j < nx; j++) {
      const longitude = gridLimits.getNorthWest().lng + j * dx;
      const pointKey = generatePointKey(latitude, longitude);
      let gp = gridPointsMap.get(pointKey);
      if (!gp) {
        gp = new GridPoint(latitude, longitude);
        gridPointsMap.set(pointKey, gp);
        points.push(gp);
        count++;
      }
      count1++;
    }
  }
  if(options.demoMode){
    console.log("Puntos generados:", count);
    console.log("Puntos obviados:", count1 - count);
  }

  return {
    bounds: gridLimits,
    pointDistance: pointDistance,
    grid: points,
    gridPointsMap: gridPointsMap,
    dx: dx,
    dy: dy,
    nx: nx,
    ny: ny,
  }
}

function updateWindyParameters(velocityLayer = null, windyParameters) {
  if (velocityLayer) velocityLayer.setOptions(windyParameters);
}

export default {
  generateRandomGridData,
  convertWindDirection,
  getBoundsAtZoom,
  calculateOptimalPointDistance,
  weatherDataBuilder,
  tempDataBuilder,
  precipDataBuilder,
  windyDataBuilder,
  generatePointKey,
  buildPointsLookup,
  calculateGridParameters,
  gridBuilder,
  updateWindyParameters,
  adjustAndCount
};