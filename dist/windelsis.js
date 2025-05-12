(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["Windelsis"] = factory();
	else
		root["Windelsis"] = factory();
})(this, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/js/DataRenderer.js":
/*!********************************!*\
  !*** ./src/js/DataRenderer.js ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   COLOR_SCALES: () => (/* binding */ COLOR_SCALES),
/* harmony export */   DataRenderer: () => (/* binding */ DataRenderer)
/* harmony export */ });
function getColorForValue(value, colorScale) {
  // if value is less than the first value in the scale, return the first color
  if (value <= colorScale[0].value) {
    const [r, g, b] = colorScale[0].color;
    return {
      r,
      g,
      b
    };
  }
  if (value >= colorScale[colorScale.length - 1].value) {
    const [r, g, b] = colorScale[colorScale.length - 1].color;
    return {
      r,
      g,
      b
    };
  }

  // find the two colors that the value is between
  for (let i = 0; i < colorScale.length - 1; i++) {
    const current = colorScale[i];
    const next = colorScale[i + 1];
    if (value >= current.value && value <= next.value) {
      const factor = (value - current.value) / (next.value - current.value);
      const r = Math.round(current.color[0] + factor * (next.color[0] - current.color[0]));
      const g = Math.round(current.color[1] + factor * (next.color[1] - current.color[1]));
      const b = Math.round(current.color[2] + factor * (next.color[2] - current.color[2]));
      return {
        r,
        g,
        b
      };
    }
  }

  // fallback
  const lastColor = colorScale[colorScale.length - 1].color;
  return {
    r: lastColor[0],
    g: lastColor[1],
    b: lastColor[2]
  };
}
const COLOR_SCALES = {
  temperature: [{
    value: -15,
    color: [113, 190, 207]
  },
  // Azul claro
  {
    value: -8,
    color: [137, 204, 197]
  },
  // Verde azulado
  {
    value: -4,
    color: [120, 184, 206]
  },
  // Azul medio
  {
    value: 0,
    color: [98, 129, 207]
  },
  // Azul más oscuro
  {
    value: 1,
    color: [128, 167, 132]
  },
  // Verde grisáceo
  {
    value: 10,
    color: [181, 202, 96]
  },
  // Verde amarillento
  {
    value: 21,
    color: [242, 177, 59]
  },
  // Amarillo anaranjado
  {
    value: 30,
    color: [235, 96, 49]
  },
  // Naranja rojizo
  {
    value: 47,
    color: [112, 45, 21]
  } // Marrón oscuro
  ],
  precipitation: [{
    value: 0,
    color: [255, 255, 255]
  },
  // Blanco
  {
    value: 1,
    color: [200, 255, 255]
  },
  // Azul muy claro
  {
    value: 5,
    color: [100, 200, 255]
  },
  // Azul claro
  {
    value: 10,
    color: [0, 100, 255]
  },
  // Azul
  {
    value: 25,
    color: [0, 0, 255]
  },
  // Azul oscuro
  {
    value: 50,
    color: [128, 0, 255]
  } // Violeta
  ]
};

/**
 * Use of the canvasLayer plugin for Leaflet to render data on a map
 * https://github.com/Sumbera/gLayers.Leaflet
 */
class DataRenderer {
  constructor(map, data, options = {}) {
    this.map = map;
    this.data = data;
    this.canvasLayer = null;
    this._timer = null;
    this.options = Object.assign({
      pixelSize: 5,
      opacity: 0.3,
      controlName: 'Data Layer',
      layerControl: map.layerControl,
      colorScale: COLOR_SCALES.temperature,
      demoMode: false
    }, options);
  }
  init() {
    this._paneName = this.options.paneName || "overlayPane"; // for leaflet < 1

    var pane = this.map._panes.overlayPane;
    if (this.map.getPane) {
      pane = this.map.getPane(this._paneName);
      if (!pane) {
        pane = this.map.createPane(this._paneName);
      }
    }
    this.canvasLayer = L.canvasLayer({
      pane: pane
    }).delegate(this);
    this.options.layerControl.addOverlay(this.canvasLayer, this.options.controlName);
    return this.canvasLayer;
  }
  onDrawLayer(info) {
    if (!this.data || !this.data.data || this.data.data.length === 0) {
      console.log(this.data, 'No available data to draw');
      return;
    }
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      const ctx = info.canvas.getContext('2d', {
        willReadFrequently: true
      });
      ctx.clearRect(0, 0, info.canvas.width, info.canvas.height);
      ctx.globalAlpha = this.options.opacity;
      ctx.globalCompositeOperation = 'multiply';
      const width = info.canvas.width;
      const height = info.canvas.height;
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const latLng = this.map.containerPointToLatLng([x, y]);
          const value = this.interpolateValue(latLng.lat, latLng.lng);
          if (value == null || Number.isNaN(value)) continue;
          const {
            r,
            g,
            b
          } = getColorForValue(value, this.options.colorScale);
          const a = Math.floor(this.options.opacity * 255);
          ;
          const index = (y * width + x) * 4;
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = a;
        }
      }
      if (this.options.demoMode) {
        const header = this.data.header;
        const nx = header.nx;
        const ny = header.ny;
        const dx = header.dx;
        const dy = header.dy;
        const lo1 = header.lo1;
        const la1 = header.la1;
        for (let i = 0; i < ny; i++) {
          for (let j = 0; j < nx; j++) {
            const lat = la1 - i * dy;
            const lng = lo1 + j * dx;
            const containerPoint = this.map.latLngToContainerPoint([lat, lng]);
            const px = Math.round(containerPoint.x);
            const py = Math.round(containerPoint.y);
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const index = (py * width + px) * 4;
              data[index] = 0;
              data[index + 1] = 0;
              data[index + 2] = 0;
              data[index + 3] = 255;
            }
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }, 100);
  }
  interpolateValue(lat, lng) {
    const {
      header,
      data
    } = this.data;
    const {
      lo1,
      lo2,
      la1,
      la2,
      nx,
      ny,
      dx,
      dy
    } = header;
    const i = Math.floor((la1 - lat) / dy);
    const j = Math.floor((lng - lo1) / dx);
    if (i < 0 || i >= ny - 1 || j < 0 || j >= nx - 1) {
      return null;
    }
    const t1 = data[i * nx + j];
    const t2 = data[i * nx + (j + 1)];
    const t3 = data[(i + 1) * nx + j];
    const t4 = data[(i + 1) * nx + (j + 1)];
    const x1 = lo1 + j * dx;
    const x2 = lo1 + (j + 1) * dx;
    const y1 = la1 - i * dy;
    const y2 = la1 - (i + 1) * dy;
    const t12 = t1 + (t2 - t1) * (lng - x1) / (x2 - x1);
    const t34 = t3 + (t4 - t3) * (lng - x1) / (x2 - x1);
    const t = t12 + (t34 - t12) * (lat - y1) / (y2 - y1);
    return t;
  }
  update(data) {
    this.data = data;
    if (this.canvasLayer && this.map.hasLayer(this.canvasLayer)) {
      this.canvasLayer.needRedraw();
    }
  }
  _clearTemperature() {
    if (this.canvasLayer && this.canvasLayer._canvas) {
      const ctx = this.canvasLayer._canvas.getContext('2d');
      ctx.clearRect(0, 0, this.canvasLayer._canvas.width, this.canvasLayer._canvas.height);
    }
  }
  _destroyTemperatureLayer() {
    if (this._timer) clearTimeout(this._timer);
    this._clearTemperature();
    if (this.canvasLayer) {
      this.map.removeLayer(this.canvasLayer);
      this.canvasLayer = null;
    }
  }
}


/***/ }),

/***/ "./src/js/apiService.js":
/*!******************************!*\
  !*** ./src/js/apiService.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   openMeteoApiCaller: () => (/* binding */ openMeteoApiCaller),
/* harmony export */   parseOpenMeteo: () => (/* binding */ parseOpenMeteo)
/* harmony export */ });
async function openMeteoApiCaller(points, options) {
  const standardizedDataArray = new Array(points.length);
  const promises = [];
  const batchSize = 100; // OpenMeteo API limit
  for (let i = 0; i < points.length; i += batchSize) {
    const batchPoints = points.slice(i, i + batchSize);
    const latParams = batchPoints.map(p => p.latitude).join(',');
    const lonParams = batchPoints.map(p => p.longitude).join(',');
    const baseUrl = 'https://api.open-meteo.com/v1/forecast';
    let url = '';
    switch (options.dateType) {
      case 'current':
        url = `${baseUrl}?latitude=${latParams}&longitude=${lonParams}` + `&current=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,` + `precipitation_probability&wind_speed_unit=ms`;
        break;
      case 'forecast':
        url = `${baseUrl}?latitude=${latParams}&longitude=${lonParams}` + `&start_date=${options.start_date}&end_date=${options.end_date}` + `&daily=temperature_2m_max,precipitation_sum,` + `wind_speed_10m_max,wind_direction_10m_dominant,` + `precipitation_probability_max&wind_speed_unit=ms`;
        break;
      case 'forecast_hourly':
        url = `${baseUrl}?latitude=${latParams}&longitude=${lonParams}` + `&start_date=${options.start_date}&end_date=${options.end_date}` + `&hourly=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,` + `precipitation_probability&wind_speed_unit=ms`;
        break;
      default:
        throw new Error('Invalid date type');
    }
    console.log("Calling URL:", url);
    promises.push(fetch(url).then(response => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    }).then(data => ({
      data,
      startIndex: i
    })));
  }
  const results = await Promise.all(promises);
  results.forEach(({
    data,
    startIndex
  }) => {
    const weatherDataArray = Array.isArray(data) ? data : [data];
    weatherDataArray.forEach((weatherData, index) => {
      standardizedDataArray[startIndex + index] = parseOpenMeteo(weatherData, options);
    });
  });
  return standardizedDataArray;
}
function parseOpenMeteo(data, options) {
  if (!data || !data.current && !data.hourly && !data.daily) {
    throw new Error('Invalid data format');
  }
  const getWeatherData = (dataType, index = 0) => {
    const weatherData = data[dataType];
    const weatherUnits = data[`${dataType}_units`];
    return {
      temperature: weatherData.temperature_2m_max?.[index] ?? weatherData.temperature_2m?.[index] ?? weatherData.temperature_2m,
      wind: {
        speed: weatherData.wind_speed_10m_max?.[index] ?? weatherData.wind_speed_10m?.[index] ?? weatherData.wind_speed_10m,
        direction: weatherData.wind_direction_10m_dominant?.[index] ?? weatherData.wind_direction_10m?.[index] ?? weatherData.wind_direction_10m
      },
      precipitation: weatherData.precipitation_sum?.[index] ?? weatherData.precipitation?.[index] ?? weatherData.precipitation,
      precipitation_prob: weatherData.precipitation_probability_max?.[index] ?? weatherData.precipitation_probability?.[index] ?? weatherData.precipitation_probability,
      weatherUnits: {
        temperature: weatherUnits.temperature_2m_max ?? weatherUnits.temperature_2m,
        windSpeed: weatherUnits.wind_speed_10m_max ?? weatherUnits.wind_speed_10m,
        windDirection: weatherUnits.wind_direction_10m_dominant ?? weatherUnits.wind_direction_10m,
        precipitation: weatherUnits.precipitation_sum ?? weatherUnits.precipitation,
        precipitationProb: weatherUnits.precipitation_probability_max ?? weatherUnits.precipitation_probability ?? '%'
      },
      timestamp: weatherData.time?.[index] ?? weatherData.time,
      rawData: data
    };
  };
  switch (options.dateType) {
    case 'current':
      return getWeatherData('current');
    case 'forecast':
      return getWeatherData('daily', 0);
    case 'forecast_hourly':
      if (options.hour_index == null) {
        throw new Error('hour_index is required for forecast_hourly');
      }
      return getWeatherData('hourly', options.hour_index);
    default:
      throw new Error('Invalid date type');
  }
}

/***/ }),

/***/ "./src/js/gridPoint.js":
/*!*****************************!*\
  !*** ./src/js/gridPoint.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GridPoint: () => (/* binding */ GridPoint)
/* harmony export */ });
/* harmony import */ var _gridUtils_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./gridUtils.js */ "./src/js/gridUtils.js");

class GridPoint {
  constructor(latitude, longitude) {
    this.latitude = latitude;
    this.longitude = longitude;
    this.id = _gridUtils_js__WEBPACK_IMPORTED_MODULE_0__["default"].generatePointKey(latitude, longitude);
    this.weatherData = {
      weather_units: {
        // data format that we use
        temperature: '°C',
        wind_speed: 'm/s',
        wind_direction: '°',
        precipitation: 'mm',
        precipitation_prob: '%'
      },
      temperature: null,
      wind: {
        speed: null,
        direction: null
      },
      precipitation: null,
      precipitation_prob: null,
      timestamp: null,
      rawData: null
    };
    this.windComponents = {
      u: null,
      v: null
    };
  }
  setWeatherData(data) {
    this.weatherData = {
      ...data,
      temperature: data.temperature ?? 0,
      wind: {
        speed: data.wind?.speed ?? 0,
        direction: data.wind?.direction ?? 0
      },
      precipitation: data.precipitation ?? 0,
      precipitation_prob: data.precipitation_prob ?? 0,
      timestamp: data.timestamp ?? null,
      rawData: data.rawData ?? null
    };
    if (this.weatherData.wind.speed !== null && this.weatherData.wind.direction !== null) {
      const {
        u,
        v
      } = _gridUtils_js__WEBPACK_IMPORTED_MODULE_0__["default"].convertWindDirection(this.weatherData.wind.speed, this.weatherData.wind.direction);
      this.windComponents.u = u;
      this.windComponents.v = v;
    }
  }
  convertSpeed(speed, unit) {
    return unit === 'km/h' ? speed * 0.27778 : speed;
  }
  getTemperature() {
    return this.weatherData.temperature;
  }
  getPrecipitation() {
    return this.weatherData.precipitation;
  }
  getWindSpeed() {
    return this.weatherData.wind?.speed;
  }
  getWindDirection() {
    return this.weatherData.wind?.direction;
  }
  getWindComponents() {
    return this.windComponents;
  }

  // Method to check if data is stale (older than 1 hour)
  isStale() {
    if (!this.weatherData.timestamp) return true;
    const oneHourAgo = new Date(Date.now() - 3600000);
    return this.weatherData.timestamp < oneHourAgo;
  }
  toString() {
    return `la:${this.latitude}, lo:${this.longitude}\nTemperature: ${this.weatherData.temperature}°C\nWind: speed ${this.weatherData.wind.speed}m/s | direction ${this.weatherData.wind.direction}°\nComponents: u ${this.u}m/s | v ${this.v}m/s)`;
  }
}

/***/ }),

/***/ "./src/js/gridUtils.js":
/*!*****************************!*\
  !*** ./src/js/gridUtils.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _gridPoint_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./gridPoint.js */ "./src/js/gridPoint.js");

function generateRandomGridData(points) {
  //console.log("Generating random grid data...");
  const baseTemperature = Math.random() * 20 + 5; // temperature between 5º y 25º
  const baseWindSpeed = Math.random() * 10 + 5; // wind speed between 5 and 15 m/s
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
      timestamp: new Date().toISOString(),
      // Format: yyyy-mm-ddTHH:MM:SS.000Z
      rawData: null
    };
    point.setWeatherData(weatherData);
  });
}

// convert wind speed and direction to u and v components
function convertWindDirection(speed, direction) {
  const rad = direction * (Math.PI / 180);

  // negative sign because in meteorology, wind direction is given as the direction from which the wind is coming
  const u = -speed * Math.sin(rad); // east-west component
  const v = -speed * Math.cos(rad); // north-south component
  return {
    u,
    v
  };
}
function getBoundsAtZoom(map, zoomLevel) {
  const center = map.getCenter();
  const bounds = map.getPixelBounds(center, zoomLevel);

  // Convertir los límites a coordenadas geográficas
  const southWest = map.unproject(bounds.getBottomLeft(), zoomLevel); //L.marker(southWest).addTo(map);
  const northEast = map.unproject(bounds.getTopRight(), zoomLevel); //L.marker(northEast).addTo(map);

  return L.latLngBounds(southWest, northEast);
}
function adjustAndCount(rawBounds, distance, mapAdjustment = 0) {
  const mult = distance > 0.5 ? distance : 0.5;
  const {
    lat: swLat0,
    lng: swLng0
  } = rawBounds.getSouthWest();
  const {
    lat: neLat0,
    lng: neLng0
  } = rawBounds.getNorthEast();
  const roundTo = (v, up) => up ? Math.ceil(v / mult) * mult : Math.floor(v / mult) * mult;
  const swLat = roundTo(swLat0, false) - mapAdjustment;
  const swLng = roundTo(swLng0, false) - mapAdjustment;
  const neLat = roundTo(neLat0, true) + mapAdjustment;
  const neLng = roundTo(neLng0, true) + mapAdjustment;
  const bounds = L.latLngBounds(L.latLng(swLat, swLng), L.latLng(neLat, neLng));
  const lonRange = bounds.getEast() - bounds.getWest();
  const latRange = bounds.getNorth() - bounds.getSouth();
  const cols = Math.round(lonRange / distance) + 1;
  const rows = Math.round(latRange / distance) + 1;
  const total = cols * rows;
  return {
    bounds,
    cols,
    rows,
    total
  };
}
function calculateOptimalPointDistance(rawBounds, options) {
  const candidates = [0.0625, 0.125, 0.25, 0.5, 1];
  const maxPts = options.maxGridPoints;
  const adj = options.mapAdjustment ?? 0;
  if (options.pointDistance != null) {
    const {
      bounds,
      cols,
      rows,
      total
    } = adjustAndCount(rawBounds, options.pointDistance, adj);
    if (options.demoMode) console.log(`Selected point distance: ${options.pointDistance}° (${rows}x${cols}=${total} points)`);
    return {
      pointDistance: options.pointDistance,
      bounds,
      ny: cols,
      nx: rows
    };
  }
  for (const d of candidates) {
    const {
      bounds,
      cols,
      rows,
      total
    } = adjustAndCount(rawBounds, d, adj);
    if (total <= maxPts) {
      if (options.demoMode) console.log(`Selected point distance: ${d}° (${rows}x${cols}=${total} points)`);
      return {
        pointDistance: d,
        bounds,
        ny: cols,
        nx: rows
      };
    }
    if (options.demoMode) console.log(`Distance: ${d}° would exceed maxPoints (${total}>${maxPts})`);
  }

  // Fallback
  const last = candidates[candidates.length - 1];
  const {
    bounds,
    cols,
    rows,
    total
  } = adjustAndCount(rawBounds, last, adj);
  if (options.demoMode) console.log(`Fallback point distance: ${last}° (${rows}x${cols}=${total} points)`);
  return {
    pointDistance: last,
    bounds,
    ny: cols,
    nx: rows
  };
}
function weatherDataBuilder(grid, dataType = 'temperature') {
  const {
    bounds,
    dx,
    dy,
    nx,
    ny,
    gridPointsMap
  } = grid;
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
      let gridPoint = gridPointsMap.has(pointKey) ? gridPointsMap.get(pointKey) : new _gridPoint_js__WEBPACK_IMPORTED_MODULE_0__.GridPoint(latitude, longitude);
      weatherGrid.push(gridPoint);
    }
  }
  var weatherValues = [];
  for (let i = 0; i < weatherGrid.length; i++) {
    const value = dataType === 'temperature' ? weatherGrid[i].getTemperature() : weatherGrid[i].getPrecipitation();
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
  const {
    bounds,
    dx,
    dy,
    nx,
    ny,
    gridPointsMap
  } = Grid;
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
      let gridPoint = gridPointsMap.has(pointKey) ? gridPointsMap.get(pointKey) : new _gridPoint_js__WEBPACK_IMPORTED_MODULE_0__.GridPoint(latitude, longitude);
      grid.push(gridPoint);
    }
  }
  var u_component = [],
    v_component = [];
  for (let i = 0; i < grid.length; i++) {
    // grid.length should be equal to nx * ny
    const {
      u,
      v
    } = grid[i].getWindComponents(); // console.log("u", u, "v", v);
    u_component.push(u);
    v_component.push(v);
  }
  const windData = [{
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
  }, {
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
  }];

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
function calculateGridParameters(bounds, pointDistance = 0.0625) {
  const lonRange = Math.abs(bounds.getNorthEast().lng - bounds.getSouthWest().lng);
  const latRange = Math.abs(bounds.getNorthEast().lat - bounds.getSouthWest().lat);
  //console.log("lonRange", lonRange, "latRange", latRange);

  let auxDistance = 0;
  for (let i = 0; i < 16; i++) {
    if (latRange <= 0.0625 * i || lonRange <= 0.0625 * i) {
      //auxDistance = 0.0625 * i;
      break;
    }
  }
  if (auxDistance != 0 && auxDistance < pointDistance) pointDistance = auxDistance;
  const nx = Math.ceil(lonRange / pointDistance) + 1;
  const ny = Math.ceil(latRange / pointDistance) + 1;
  const dx = pointDistance;
  const dy = pointDistance;
  return {
    nx,
    ny,
    dx,
    dy
  };
}
function gridBuilder(map, pointDistance, gridLimits, gridPointsMap, options) {
  //gridLimits=mapBounds => _northEast y _southWest
  if (options.demoMode) {
    map.eachLayer(function (layer) {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });
    console.log("northWest", gridLimits.getNorthWest());
    L.marker(gridLimits.getNorthWest()).addTo(map);
    console.log("northEast", gridLimits.getNorthEast());
    L.marker(gridLimits.getNorthEast()).addTo(map);
    console.log("southWest", gridLimits.getSouthWest());
    L.marker(gridLimits.getSouthWest()).addTo(map);
    console.log("southEast", gridLimits.getSouthEast());
    L.marker(gridLimits.getSouthEast()).addTo(map);
  }

  // Datos para la cuadricula
  const {
    nx,
    ny,
    dx,
    dy
  } = calculateGridParameters(gridLimits, pointDistance);
  if (options.demoMode) console.log("nx:", nx, "ny:", ny, "dx:", dx, "dy:", dy);

  // Generar las coordenadas de los puntos
  const points = [];
  let count = 0,
    count1 = 0;
  //console.log(gridPointsMap);
  for (let i = 0; i < ny; i++) {
    const latitude = gridLimits.getNorthWest().lat - i * dy;
    for (let j = 0; j < nx; j++) {
      const longitude = gridLimits.getNorthWest().lng + j * dx;
      const pointKey = generatePointKey(latitude, longitude);
      let gp = gridPointsMap.get(pointKey);
      if (!gp) {
        gp = new _gridPoint_js__WEBPACK_IMPORTED_MODULE_0__.GridPoint(latitude, longitude);
        gridPointsMap.set(pointKey, gp);
        points.push(gp);
        count++;
      }
      count1++;
    }
  }
  if (options.demoMode) {
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
    ny: ny
  };
}
function updateWindyParameters(velocityLayer = null, windyParameters) {
  if (velocityLayer) velocityLayer.setOptions(windyParameters);
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
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
});

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other entry modules.
(() => {
/*!****************************************!*\
  !*** ./src/vendor/leaflet-velocity.js ***!
  \****************************************/


/*
 Generic  Canvas Layer for leaflet 0.7 and 1.0-rc,
 copyright Stanislav Sumbera,  2016 , sumbera.com , license MIT
 originally created and motivated by L.CanvasOverlay  available here: https://gist.github.com/Sumbera/11114288

 */
// -- L.DomUtil.setTransform from leaflet 1.0.0 to work on 0.0.7
//------------------------------------------------------------------------------
if (!L.DomUtil.setTransform) {
  L.DomUtil.setTransform = function (el, offset, scale) {
    var pos = offset || new L.Point(0, 0);
    el.style[L.DomUtil.TRANSFORM] = (L.Browser.ie3d ? "translate(" + pos.x + "px," + pos.y + "px)" : "translate3d(" + pos.x + "px," + pos.y + "px,0)") + (scale ? " scale(" + scale + ")" : "");
  };
} // -- support for both  0.0.7 and 1.0.0 rc2 leaflet

L.CanvasLayer = (L.Layer ? L.Layer : L.Class).extend({
  // -- initialized is called on prototype
  initialize: function initialize(options) {
    this._map = null;
    this._canvas = null;
    this._frame = null;
    this._delegate = null;
    L.setOptions(this, options);
  },
  delegate: function delegate(del) {
    this._delegate = del;
    return this;
  },
  needRedraw: function needRedraw() {
    if (!this._frame) {
      this._frame = L.Util.requestAnimFrame(this.drawLayer, this);
    }
    return this;
  },
  //-------------------------------------------------------------
  _onLayerDidResize: function _onLayerDidResize(resizeEvent) {
    this._canvas.width = resizeEvent.newSize.x;
    this._canvas.height = resizeEvent.newSize.y;
  },
  //-------------------------------------------------------------
  _onLayerDidMove: function _onLayerDidMove() {
    var topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);
    this.drawLayer();
  },
  //-------------------------------------------------------------
  getEvents: function getEvents() {
    var events = {
      resize: this._onLayerDidResize,
      moveend: this._onLayerDidMove
      // drag: this._onLayerDidMove
    };
    if (this._map.options.zoomAnimation && L.Browser.any3d) {
      events.zoomanim = this._animateZoom;
    }
    return events;
  },
  //-------------------------------------------------------------
  onAdd: function onAdd(map) {
    this._map = map;
    this._canvas = L.DomUtil.create("canvas", "leaflet-layer");
    this.tiles = {};
    var size = this._map.getSize();
    this._canvas.width = size.x;
    this._canvas.height = size.y;
    var animated = this._map.options.zoomAnimation && L.Browser.any3d;
    L.DomUtil.addClass(this._canvas, "leaflet-zoom-" + (animated ? "animated" : "hide"));
    this.options.pane.appendChild(this._canvas);
    map.on(this.getEvents(), this);
    var del = this._delegate || this;
    del.onLayerDidMount && del.onLayerDidMount(); // -- callback

    this.needRedraw();
    var self = this;
    setTimeout(function () {
      self._onLayerDidMove();
    }, 0);
  },
  //-------------------------------------------------------------
  onRemove: function onRemove(map) {
    var del = this._delegate || this;
    del.onLayerWillUnmount && del.onLayerWillUnmount(); // -- callback

    this.options.pane.removeChild(this._canvas);
    map.off(this.getEvents(), this);
    this._canvas = null;
  },
  //------------------------------------------------------------
  addTo: function addTo(map) {
    map.addLayer(this);
    return this;
  },
  //------------------------------------------------------------------------------
  drawLayer: function drawLayer() {
    // -- todo make the viewInfo properties  flat objects.
    var size = this._map.getSize();
    var bounds = this._map.getBounds();
    var zoom = this._map.getZoom();
    var center = this._map.options.crs.project(this._map.getCenter());
    var corner = this._map.options.crs.project(this._map.containerPointToLatLng(this._map.getSize()));
    var del = this._delegate || this;
    del.onDrawLayer && del.onDrawLayer({
      layer: this,
      canvas: this._canvas,
      bounds: bounds,
      size: size,
      zoom: zoom,
      center: center,
      corner: corner
    });
    this._frame = null;
  },
  // -- L.DomUtil.setTransform from leaflet 1.0.0 to work on 0.0.7
  //------------------------------------------------------------------------------
  _setTransform: function _setTransform(el, offset, scale) {
    var pos = offset || new L.Point(0, 0);
    el.style[L.DomUtil.TRANSFORM] = (L.Browser.ie3d ? "translate(" + pos.x + "px," + pos.y + "px)" : "translate3d(" + pos.x + "px," + pos.y + "px,0)") + (scale ? " scale(" + scale + ")" : "");
  },
  //------------------------------------------------------------------------------
  _animateZoom: function _animateZoom(e) {
    var scale = this._map.getZoomScale(e.zoom); // -- different calc of offset in leaflet 1.0.0 and 0.0.7 thanks for 1.0.0-rc2 calc @jduggan1

    var offset = L.Layer ? this._map._latLngToNewLayerPoint(this._map.getBounds().getNorthWest(), e.zoom, e.center) : this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());
    L.DomUtil.setTransform(this._canvas, offset, scale);
  }
});
L.canvasLayer = function (pane) {
  return new L.CanvasLayer(pane);
};
L.Control.Velocity = L.Control.extend({
  options: {
    position: "bottomleft",
    emptyString: "Unavailable",
    // Could be any combination of 'bearing' (angle toward which the flow goes) or 'meteo' (angle from which the flow comes)
    // and 'CW' (angle value increases clock-wise) or 'CCW' (angle value increases counter clock-wise)
    angleConvention: "bearingCCW",
    showCardinal: false,
    // Could be 'm/s' for meter per second, 'k/h' for kilometer per hour, 'mph' for miles per hour or 'kt' for knots
    speedUnit: "m/s",
    directionString: "Direction",
    speedString: "Speed",
    onAdd: null,
    onRemove: null
  },
  onAdd: function onAdd(map) {
    this._container = L.DomUtil.create("div", "leaflet-control-velocity");
    L.DomEvent.disableClickPropagation(this._container);
    map.on("mousemove", this._onMouseMove, this);
    //this._container.innerHTML = this.options.emptyString;
    if (this.options.leafletVelocity.options.onAdd) this.options.leafletVelocity.options.onAdd();
    return this._container;
  },
  onRemove: function onRemove(map) {
    map.off("mousemove", this._onMouseMove, this);
    if (this.options.leafletVelocity.options.onRemove) this.options.leafletVelocity.options.onRemove();
  },
  vectorToSpeed: function vectorToSpeed(uMs, vMs, unit) {
    var velocityAbs = Math.sqrt(Math.pow(uMs, 2) + Math.pow(vMs, 2)); // Default is m/s

    if (unit === "k/h") {
      return this.meterSec2kilometerHour(velocityAbs);
    } else if (unit === "kt") {
      return this.meterSec2Knots(velocityAbs);
    } else if (unit === "mph") {
      return this.meterSec2milesHour(velocityAbs);
    } else {
      return velocityAbs;
    }
  },
  vectorToDegrees: function vectorToDegrees(uMs, vMs, angleConvention) {
    // Default angle convention is CW
    if (angleConvention.endsWith("CCW")) {
      // vMs comes out upside-down..
      vMs = vMs > 0 ? vMs = -vMs : Math.abs(vMs);
    }
    var velocityAbs = Math.sqrt(Math.pow(uMs, 2) + Math.pow(vMs, 2));
    var velocityDir = Math.atan2(uMs / velocityAbs, vMs / velocityAbs);
    var velocityDirToDegrees = velocityDir * 180 / Math.PI + 180;
    if (angleConvention === "bearingCW" || angleConvention === "meteoCCW") {
      velocityDirToDegrees += 180;
      if (velocityDirToDegrees >= 360) velocityDirToDegrees -= 360;
    }
    return velocityDirToDegrees;
  },
  degreesToCardinalDirection: function degreesToCardinalDirection(deg) {
    var cardinalDirection = '';
    if (deg >= 0 && deg < 11.25 || deg >= 348.75) {
      cardinalDirection = 'N';
    } else if (deg >= 11.25 && deg < 33.75) {
      cardinalDirection = 'NNW';
    } else if (deg >= 33.75 && deg < 56.25) {
      cardinalDirection = 'NW';
    } else if (deg >= 56.25 && deg < 78.75) {
      cardinalDirection = 'WNW';
    } else if (deg >= 78.25 && deg < 101.25) {
      cardinalDirection = 'W';
    } else if (deg >= 101.25 && deg < 123.75) {
      cardinalDirection = 'WSW';
    } else if (deg >= 123.75 && deg < 146.25) {
      cardinalDirection = 'SW';
    } else if (deg >= 146.25 && deg < 168.75) {
      cardinalDirection = 'SSW';
    } else if (deg >= 168.75 && deg < 191.25) {
      cardinalDirection = 'S';
    } else if (deg >= 191.25 && deg < 213.75) {
      cardinalDirection = 'SSE';
    } else if (deg >= 213.75 && deg < 236.25) {
      cardinalDirection = 'SE';
    } else if (deg >= 236.25 && deg < 258.75) {
      cardinalDirection = 'ESE';
    } else if (deg >= 258.75 && deg < 281.25) {
      cardinalDirection = 'E';
    } else if (deg >= 281.25 && deg < 303.75) {
      cardinalDirection = 'ENE';
    } else if (deg >= 303.75 && deg < 326.25) {
      cardinalDirection = 'NE';
    } else if (deg >= 326.25 && deg < 348.75) {
      cardinalDirection = 'NNE';
    }
    return cardinalDirection;
  },
  meterSec2Knots: function meterSec2Knots(meters) {
    return meters / 0.514;
  },
  meterSec2kilometerHour: function meterSec2kilometerHour(meters) {
    return meters * 3.6;
  },
  meterSec2milesHour: function meterSec2milesHour(meters) {
    return meters * 2.23694;
  },
  _onMouseMove: function _onMouseMove(e) {
    var self = this;
    var pos = this.options.leafletVelocity._map.containerPointToLatLng(L.point(e.containerPoint.x, e.containerPoint.y));
    var gridValue = this.options.leafletVelocity._windy.interpolatePoint(pos.lng, pos.lat);
    var htmlOut = "";
    /*
        if (gridValue && !isNaN(gridValue[0]) && !isNaN(gridValue[1]) && gridValue[2]) {
          var deg = self.vectorToDegrees(gridValue[0], gridValue[1], this.options.angleConvention);
          var cardinal = this.options.showCardinal ? " (".concat(self.degreesToCardinalDirection(deg), ") ") : '';
          htmlOut = "<strong> ".concat(this.options.velocityType, " ").concat(this.options.directionString, ": </strong> ").concat(deg.toFixed(2), "\xB0").concat(cardinal, ", <strong> ").concat(this.options.velocityType, " ").concat(this.options.speedString, ": </strong> ").concat(self.vectorToSpeed(gridValue[0], gridValue[1], this.options.speedUnit).toFixed(2), " ").concat(this.options.speedUnit);
        } else {
          htmlOut = this.options.emptyString;
        }
    */
    self._container.innerHTML = htmlOut;
  }
});
L.Map.mergeOptions({
  positionControl: false
});
L.Map.addInitHook(function () {
  if (this.options.positionControl) {
    this.positionControl = new L.Control.MousePosition();
    this.addControl(this.positionControl);
  }
});
L.control.velocity = function (options) {
  return new L.Control.Velocity(options);
};
L.VelocityLayer = (L.Layer ? L.Layer : L.Class).extend({
  options: {
    displayValues: true,
    displayOptions: {
      velocityType: "Velocity",
      position: "bottomleft",
      emptyString: "No velocity data"
    },
    maxVelocity: 10,
    // used to align color scale
    colorScale: null,
    data: null
  },
  _map: null,
  _canvasLayer: null,
  _windy: null,
  _context: null,
  _timer: 0,
  _mouseControl: null,
  initialize: function initialize(options) {
    L.setOptions(this, options);
  },
  onAdd: function onAdd(map) {
    // determine where to add the layer
    this._paneName = this.options.paneName || "overlayPane"; // fall back to overlayPane for leaflet < 1

    var pane = map._panes.overlayPane;
    if (map.getPane) {
      // attempt to get pane first to preserve parent (createPane voids this)
      pane = map.getPane(this._paneName);
      if (!pane) {
        pane = map.createPane(this._paneName);
      }
    } // create canvas, add to map pane

    this._canvasLayer = L.canvasLayer({
      pane: pane
    }).delegate(this);
    this._canvasLayer.addTo(map);
    this._map = map;
  },
  onRemove: function onRemove(map) {
    this._destroyWind();
  },
  setData: function setData(data) {
    this.options.data = data;
    if (this._windy) {
      this._windy.setData(data);
      this._clearAndRestart();
    }
    this.fire("load");
  },
  setOpacity: function setOpacity(opacity) {
    this._canvasLayer.setOpacity(opacity);
  },
  setOptions: function setOptions(options) {
    this.options = Object.assign(this.options, options);
    if (options.hasOwnProperty("displayOptions")) {
      this.options.displayOptions = Object.assign(this.options.displayOptions, options.displayOptions);
      this._initMouseHandler(true);
    }
    if (options.hasOwnProperty("data")) this.options.data = options.data;
    if (this._windy) {
      //console.log('windy options update', options);
      this._windy.setOptions(options);
      if (options.hasOwnProperty("data")) this._windy.setData(options.data);
      this._clearAndRestart();
    }
    this.fire("load");
  },
  /*------------------------------------ PRIVATE ------------------------------------------*/
  onDrawLayer: function onDrawLayer(overlay, params) {
    var self = this;
    if (!this._windy) {
      this._initWindy(this);
      return;
    }
    if (!this.options.data) {
      return;
    }
    if (this._timer) clearTimeout(self._timer);
    this._timer = setTimeout(function () {
      self._startWindy();
    }, 750); // showing velocity is delayed
  },
  _startWindy: function _startWindy() {
    var bounds = this._map.getBounds();
    var size = this._map.getSize(); // bounds, width, height, extent

    let la1 = this.options.data[0].header.la1;
    let la2 = this.options.data[0].header.la2;
    let lo1 = this.options.data[0].header.lo1;
    let lo2 = this.options.data[0].header.lo2;

    //this._windy.start([[0, 0], [size.x, size.y]], size.x, size.y, [[lo1, lo2], [lo2, la1]]);
    this._windy.start([[0, 0], [size.x, size.y]], size.x, size.y, [[bounds._southWest.lng, bounds._southWest.lat], [bounds._northEast.lng, bounds._northEast.lat]]);
  },
  // Nueva función para actualizar la animación durante el arrastre  
  _updateWindDuringDrag: function () {
    if (this._dragTimer) clearTimeout(this._dragTimer);
    // Se usa un debounce de 200ms para no saturar el proceso durante arrastres muy rápidos.
    this._dragTimer = setTimeout(() => {
      this._clearAndRestart(); //console.log('updateWindDuringDrag');
    }, 200);
  },
  _initWindy: function _initWindy(self) {
    // windy object, copy options
    var options = Object.assign({
      canvas: self._canvasLayer._canvas,
      map: this._map
    }, self.options);
    this._windy = new Windy(options); // prepare context global var, start drawing

    this._context = this._canvasLayer._canvas.getContext("2d");
    this._canvasLayer._canvas.classList.add("velocity-overlay");
    this.onDrawLayer();

    //this._map.on("dragstart", self._windy.stop);

    // this._map.on("dragend", self._clearAndRestart);
    //console.log("zoom activated");
    this._map.on('drag', event => self._updateWindDuringDrag());
    this._map.on("zoomstart", self._windy.stop);
    this._map.on("zoomend", self._clearAndRestart);
    this._map.on("resize", self._clearWind);
    this._initMouseHandler(false);
  },
  _initMouseHandler: function _initMouseHandler(voidPrevious) {
    if (voidPrevious) {
      this._map.removeControl(this._mouseControl);
      this._mouseControl = false;
    }
    if (!this._mouseControl && this.options.displayValues) {
      var options = this.options.displayOptions || {};
      options["leafletVelocity"] = this;
      this._mouseControl = L.control.velocity(options).addTo(this._map);
    }
  },
  _clearAndRestart: function _clearAndRestart() {
    //console.log("clear and restart");
    if (this._context) this._context.clearRect(0, 0, 3000, 3000);
    if (this._windy) this._startWindy();
  },
  _clearWind: function _clearWind() {
    if (this._windy) this._windy.stop();
    if (this._context) this._context.clearRect(0, 0, 3000, 3000);
  },
  _destroyWind: function _destroyWind() {
    if (this._timer) clearTimeout(this._timer);
    if (this._windy) this._windy.stop();
    if (this._context) this._context.clearRect(0, 0, 3000, 3000);
    if (this._mouseControl) this._map.removeControl(this._mouseControl);
    this._mouseControl = null;
    this._windy = null;
    this._map.removeLayer(this._canvasLayer);
  }
});
L.velocityLayer = function (options) {
  return new L.VelocityLayer(options);
};
/*  Global class for simulating the movement of particle through a 1km wind grid

 credit: All the credit for this work goes to: https://github.com/cambecc for creating the repo:
 https://github.com/cambecc/earth. The majority of this code is directly take nfrom there, since its awesome.

 This class takes a canvas element and an array of data (1km GFS from http://www.emc.ncep.noaa.gov/index.php?branch=GFS)
 and then uses a mercator (forward/reverse) projection to correctly map wind vectors in "map space".

 The "start" method takes the bounds of the map at its current extent and starts the whole gridding,
 interpolation and animation process.
 */

var Windy = function Windy(params) {
  var MIN_VELOCITY_INTENSITY = params.minVelocity || 0; // velocity at which particle intensity is minimum (m/s)

  var MAX_VELOCITY_INTENSITY = params.maxVelocity || 10; // velocity at which particle intensity is maximum (m/s)

  var VELOCITY_SCALE = (params.velocityScale || 0.005) * (Math.pow(window.devicePixelRatio, 1 / 3) || 1); // scale for wind velocity (completely arbitrary--this value looks nice)

  var MAX_PARTICLE_AGE = params.particleAge || 90; // max number of frames a particle is drawn before regeneration

  var PARTICLE_LINE_WIDTH = params.lineWidth || 1; // line width of a drawn particle

  var PARTICLE_MULTIPLIER = params.particleMultiplier || 1 / 300; // particle count scalar (completely arbitrary--this values looks nice)

  var PARTICLE_REDUCTION = Math.pow(window.devicePixelRatio, 1 / 3) || 1.6; // multiply particle count for mobiles by this amount

  var FRAME_RATE = params.frameRate || 15;
  var FRAME_TIME = 1000 / FRAME_RATE; // desired frames per second

  var OPACITY = 0.97;
  var defaulColorScale = ["rgb(36,104, 180)", "rgb(60,157, 194)", "rgb(128,205,193 )", "rgb(151,218,168 )", "rgb(198,231,181)", "rgb(238,247,217)", "rgb(255,238,159)", "rgb(252,217,125)", "rgb(255,182,100)", "rgb(252,150,75)", "rgb(250,112,52)", "rgb(245,64,32)", "rgb(237,45,28)", "rgb(220,24,32)", "rgb(180,0,35)"];
  var colorScale = params.colorScale || defaulColorScale;
  var NULL_WIND_VECTOR = [NaN, NaN, null]; // singleton for no wind in the form: [u, v, magnitude]

  var builder;
  var grid;
  var gridData = params.data;
  var date;
  var λ0, φ0, Δλ, Δφ, ni, nj;
  var setData = function setData(data) {
    gridData = data;
  };
  var setOptions = function setOptions(options) {
    if (options.hasOwnProperty("minVelocity")) MIN_VELOCITY_INTENSITY = options.minVelocity;
    if (options.hasOwnProperty("maxVelocity")) MAX_VELOCITY_INTENSITY = options.maxVelocity;
    if (options.hasOwnProperty("velocityScale")) VELOCITY_SCALE = (options.velocityScale || 0.005) * (Math.pow(window.devicePixelRatio, 1 / 3) || 1);
    if (options.hasOwnProperty("particleAge")) MAX_PARTICLE_AGE = options.particleAge;
    if (options.hasOwnProperty("lineWidth")) PARTICLE_LINE_WIDTH = options.lineWidth;
    if (options.hasOwnProperty("particleMultiplier")) PARTICLE_MULTIPLIER = options.particleMultiplier;
    if (options.hasOwnProperty("opacity")) OPACITY = +options.opacity;
    if (options.hasOwnProperty("frameRate")) FRAME_RATE = options.frameRate;
    FRAME_TIME = 1000 / FRAME_RATE;
  }; // interpolation for vectors like wind (u,v,m)

  var bilinearInterpolateVector = function bilinearInterpolateVector(x, y, g00, g10, g01, g11) {
    var rx = 1 - x;
    var ry = 1 - y;
    var a = rx * ry,
      b = x * ry,
      c = rx * y,
      d = x * y;
    var u = g00[0] * a + g10[0] * b + g01[0] * c + g11[0] * d;
    var v = g00[1] * a + g10[1] * b + g01[1] * c + g11[1] * d;
    return [u, v, Math.sqrt(u * u + v * v)];
  };
  var createWindBuilder = function createWindBuilder(uComp, vComp) {
    var uData = uComp.data,
      vData = vComp.data;
    return {
      header: uComp.header,
      //recipe: recipeFor("wind-" + uComp.header.surface1Value),
      data: function data(i) {
        return [uData[i], vData[i]];
      },
      interpolate: bilinearInterpolateVector
    };
  };
  var createBuilder = function createBuilder(data) {
    var uComp = null,
      vComp = null,
      scalar = null;
    data.forEach(function (record) {
      switch (record.header.parameterCategory + "," + record.header.parameterNumber) {
        case "1,2":
        case "2,2":
          uComp = record;
          break;
        case "1,3":
        case "2,3":
          vComp = record;
          break;
        default:
          scalar = record;
      }
    });
    return createWindBuilder(uComp, vComp);
  };
  var buildGrid = function buildGrid(data, callback) {
    var supported = true;
    if (data.length < 2) supported = false;
    if (!supported) console.log("Windy Error: data must have at least two components (u,v)");
    builder = createBuilder(data);
    var header = builder.header;
    if (header.hasOwnProperty("gridDefinitionTemplate") && header.gridDefinitionTemplate != 0) supported = false;
    if (!supported) {
      console.log("Windy Error: Only data with Latitude_Longitude coordinates is supported");
    }
    supported = true; // reset for futher checks

    λ0 = header.lo1;
    φ0 = header.la1; // the grid's origin (e.g., 0.0E, 90.0N)

    Δλ = header.dx;
    Δφ = header.dy; // distance between grid points (e.g., 2.5 deg lon, 2.5 deg lat)

    ni = header.nx;
    nj = header.ny; // number of grid points W-E and N-S (e.g., 144 x 73)

    if (header.hasOwnProperty("scanMode")) {
      var scanModeMask = header.scanMode.toString(2);
      scanModeMask = ('0' + scanModeMask).slice(-8);
      var scanModeMaskArray = scanModeMask.split('').map(Number).map(Boolean);
      if (scanModeMaskArray[0]) Δλ = -Δλ;
      if (scanModeMaskArray[1]) Δφ = -Δφ;
      if (scanModeMaskArray[2]) supported = false;
      if (scanModeMaskArray[3]) supported = false;
      if (scanModeMaskArray[4]) supported = false;
      if (scanModeMaskArray[5]) supported = false;
      if (scanModeMaskArray[6]) supported = false;
      if (scanModeMaskArray[7]) supported = false;
      if (!supported) console.log("Windy Error: Data with scanMode: " + header.scanMode + " is not supported.");
    }
    date = new Date(header.refTime);
    date.setHours(date.getHours() + header.forecastTime); // Scan modes 0, 64 allowed.
    // http://www.nco.ncep.noaa.gov/pmb/docs/grib2/grib2_table3-4.shtml

    grid = [];
    var p = 0;
    var isContinuous = Math.floor(ni * Δλ) >= 360;
    for (var j = 0; j < nj; j++) {
      var row = [];
      for (var i = 0; i < ni; i++, p++) {
        row[i] = builder.data(p);
      }
      if (isContinuous) {
        // For wrapped grids, duplicate first column as last column to simplify interpolation logic
        row.push(row[0]);
      }
      grid[j] = row;
    }
    callback({
      date: date,
      interpolate: interpolate
    });
  };
  /**
   * Get interpolated grid value from Lon/Lat position
   * @param λ {Float} Longitude
   * @param φ {Float} Latitude
   * @returns {Object}
   */

  var interpolate = function interpolate(λ, φ) {
    if (!grid) return null;
    var i = floorMod(λ - λ0, 360) / Δλ; // calculate longitude index in wrapped range [0, 360)

    var j = (φ0 - φ) / Δφ; // calculate latitude index in direction +90 to -90

    var fi = Math.floor(i),
      ci = fi + 1;
    var fj = Math.floor(j),
      cj = fj + 1;
    var row;
    if (row = grid[fj]) {
      var g00 = row[fi];
      var g10 = row[ci];
      if (isValue(g00) && isValue(g10) && (row = grid[cj])) {
        var g01 = row[fi];
        var g11 = row[ci];
        if (isValue(g01) && isValue(g11)) {
          // All four points found, so interpolate the value.
          return builder.interpolate(i - fi, j - fj, g00, g10, g01, g11);
        }
      }
    }
    return null;
  };
  /**
   * @returns {Boolean} true if the specified value is not null and not undefined.
   */

  var isValue = function isValue(x) {
    return x !== null && x !== undefined;
  };
  /**
   * @returns {Number} returns remainder of floored division, i.e., floor(a / n). Useful for consistent modulo
   *          of negative numbers. See http://en.wikipedia.org/wiki/Modulo_operation.
   */

  var floorMod = function floorMod(a, n) {
    return a - n * Math.floor(a / n);
  };
  /**
   * @returns {Number} the value x clamped to the range [low, high].
   */

  var clamp = function clamp(x, range) {
    return Math.max(range[0], Math.min(x, range[1]));
  };
  /**
   * @returns {Boolean} true if agent is probably a mobile device. Don't really care if this is accurate.
   */

  var isMobile = function isMobile() {
    return /android|blackberry|iemobile|ipad|iphone|ipod|opera mini|webos/i.test(navigator.userAgent);
  };
  /**
   * Calculate distortion of the wind vector caused by the shape of the projection at point (x, y). The wind
   * vector is modified in place and returned by this function.
   */

  var distort = function distort(projection, λ, φ, x, y, scale, wind) {
    var u = wind[0] * scale;
    var v = wind[1] * scale;
    var d = distortion(projection, λ, φ, x, y); // Scale distortion vectors by u and v, then add.

    wind[0] = d[0] * u + d[2] * v;
    wind[1] = d[1] * u + d[3] * v;
    return wind;
  };
  var distortion = function distortion(projection, λ, φ, x, y) {
    var τ = 2 * Math.PI; //    var H = Math.pow(10, -5.2); // 0.00000630957344480193
    //    var H = 0.0000360;          // 0.0000360°φ ~= 4m  (from https://github.com/cambecc/earth/blob/master/public/libs/earth/1.0.0/micro.js#L13)

    var H = 5; // ToDo:   Why does this work?

    var hλ = λ < 0 ? H : -H;
    var hφ = φ < 0 ? H : -H;
    var pλ = project(φ, λ + hλ);
    var pφ = project(φ + hφ, λ); // Meridian scale factor (see Snyder, equation 4-3), where R = 1. This handles issue where length of 1º λ
    // changes depending on φ. Without this, there is a pinching effect at the poles.

    var k = Math.cos(φ / 360 * τ);
    return [(pλ[0] - x) / hλ / k, (pλ[1] - y) / hλ / k, (pφ[0] - x) / hφ, (pφ[1] - y) / hφ];
  };
  var createField = function createField(columns, bounds, callback) {
    /**
     * @returns {Array} wind vector [u, v, magnitude] at the point (x, y), or [NaN, NaN, null] if wind
     *          is undefined at that point.
     */
    function field(x, y) {
      var column = columns[Math.round(x)];
      return column && column[Math.round(y)] || NULL_WIND_VECTOR;
    } // Frees the massive "columns" array for GC. Without this, the array is leaked (in Chrome) each time a new
    // field is interpolated because the field closure's context is leaked, for reasons that defy explanation.

    field.release = function () {
      columns = [];
    };
    field.randomize = function (o) {
      // UNDONE: this method is terrible
      var x, y;
      var safetyNet = 0;
      do {
        x = Math.round(Math.floor(Math.random() * bounds.width) + bounds.x);
        y = Math.round(Math.floor(Math.random() * bounds.height) + bounds.y);
      } while (field(x, y)[2] === null && safetyNet++ < 30);
      o.x = x;
      o.y = y;
      return o;
    };
    callback(bounds, field);
  };
  var buildBounds = function buildBounds(bounds, width, height) {
    var upperLeft = bounds[0];
    var lowerRight = bounds[1];
    var x = Math.round(upperLeft[0]); //Math.max(Math.floor(upperLeft[0], 0), 0);

    var y = Math.max(Math.floor(upperLeft[1], 0), 0);
    var xMax = Math.min(Math.ceil(lowerRight[0], width), width - 1);
    var yMax = Math.min(Math.ceil(lowerRight[1], height), height - 1);
    return {
      x: x,
      y: y,
      xMax: width,
      yMax: yMax,
      width: width,
      height: height
    };
  };
  var deg2rad = function deg2rad(deg) {
    return deg / 180 * Math.PI;
  };
  var invert = function invert(x, y, windy) {
    var latlon = params.map.containerPointToLatLng(L.point(x, y));
    return [latlon.lng, latlon.lat];
  };
  var project = function project(lat, lon, windy) {
    var xy = params.map.latLngToContainerPoint(L.latLng(lat, lon));
    return [xy.x, xy.y];
  };
  var interpolateField = function interpolateField(grid, bounds, extent, callback) {
    var projection = {}; // map.crs used instead

    var mapArea = (extent.south - extent.north) * (extent.west - extent.east);
    var velocityScale = VELOCITY_SCALE * Math.pow(mapArea, 0.4);
    var columns = [];
    var x = bounds.x;
    function interpolateColumn(x) {
      var column = [];
      for (var y = bounds.y; y <= bounds.yMax; y += 2) {
        var coord = invert(x, y);
        if (coord) {
          var λ = coord[0],
            φ = coord[1];
          if (isFinite(λ)) {
            var wind = grid.interpolate(λ, φ);
            if (wind) {
              wind = distort(projection, λ, φ, x, y, velocityScale, wind);
              column[y + 1] = column[y] = wind;
            }
          }
        }
      }
      columns[x + 1] = columns[x] = column;
    }
    (function batchInterpolate() {
      var start = Date.now();
      while (x < bounds.width) {
        interpolateColumn(x);
        x += 2;
        if (Date.now() - start > 1000) {
          //MAX_TASK_TIME) {
          setTimeout(batchInterpolate, 25);
          return;
        }
      }
      createField(columns, bounds, callback);
    })();
  };
  var animationLoop;
  var animate = function animate(bounds, field) {
    function windIntensityColorScale(min, max) {
      colorScale.indexFor = function (m) {
        // map velocity speed to a style
        return Math.max(0, Math.min(colorScale.length - 1, Math.round((m - min) / (max - min) * (colorScale.length - 1))));
      };
      return colorScale;
    }
    var colorStyles = windIntensityColorScale(MIN_VELOCITY_INTENSITY, MAX_VELOCITY_INTENSITY);
    var buckets = colorStyles.map(function () {
      return [];
    });
    var particleCount = Math.round(bounds.width * bounds.height * PARTICLE_MULTIPLIER);
    if (isMobile()) {
      particleCount *= PARTICLE_REDUCTION;
    }
    var fadeFillStyle = "rgba(0, 0, 0, ".concat(OPACITY, ")");
    var particles = [];
    for (var i = 0; i < particleCount; i++) {
      particles.push(field.randomize({
        age: Math.floor(Math.random() * MAX_PARTICLE_AGE) + 0
      }));
    }
    function evolve() {
      buckets.forEach(function (bucket) {
        bucket.length = 0;
      });
      particles.forEach(function (particle) {
        if (particle.age > MAX_PARTICLE_AGE) {
          field.randomize(particle).age = 0;
        }
        var x = particle.x;
        var y = particle.y;
        var v = field(x, y); // vector at current position

        var m = v[2];
        if (m === null) {
          particle.age = MAX_PARTICLE_AGE; // particle has escaped the grid, never to return...
        } else {
          var xt = x + v[0];
          var yt = y + v[1];
          if (field(xt, yt)[2] !== null) {
            // Path from (x,y) to (xt,yt) is visible, so add this particle to the appropriate draw bucket.
            particle.xt = xt;
            particle.yt = yt;
            buckets[colorStyles.indexFor(m)].push(particle);
          } else {
            // Particle isn't visible, but it still moves through the field.
            particle.x = xt;
            particle.y = yt;
          }
        }
        particle.age += 1;
      });
    }
    var g = params.canvas.getContext("2d");
    g.lineWidth = PARTICLE_LINE_WIDTH;
    g.fillStyle = fadeFillStyle;
    g.globalAlpha = 0.6;
    function draw() {
      // Fade existing particle trails.
      var prev = "lighter";
      g.globalCompositeOperation = "destination-in";
      g.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      g.globalCompositeOperation = prev;
      g.globalAlpha = OPACITY === 0 ? 0 : OPACITY * 0.9; // Draw new particle trails.

      buckets.forEach(function (bucket, i) {
        if (bucket.length > 0) {
          g.beginPath();
          g.strokeStyle = colorStyles[i];
          bucket.forEach(function (particle) {
            g.moveTo(particle.x, particle.y);
            g.lineTo(particle.xt, particle.yt);
            particle.x = particle.xt;
            particle.y = particle.yt;
          });
          g.stroke();
        }
      });
    }
    var then = Date.now();
    (function frame() {
      animationLoop = requestAnimationFrame(frame);
      var now = Date.now();
      var delta = now - then;
      if (delta > FRAME_TIME) {
        then = now - delta % FRAME_TIME;
        evolve();
        draw();
      }
    })();
  };
  var start = function start(bounds, width, height, extent) {
    var mapBounds = {
      south: deg2rad(extent[0][1]),
      north: deg2rad(extent[1][1]),
      east: deg2rad(extent[1][0]),
      west: deg2rad(extent[0][0]),
      width: width,
      height: height
    };
    stop(); // build grid

    buildGrid(gridData, function (grid) {
      // interpolateField
      interpolateField(grid, buildBounds(bounds, width, height), mapBounds, function (bounds, field) {
        // animate the canvas with random points
        windy.field = field;
        animate(bounds, field);
      });
    });
  };
  var stop = function stop() {
    if (windy.field) windy.field.release();
    if (animationLoop) cancelAnimationFrame(animationLoop);
  };
  var windy = {
    params: params,
    start: start,
    stop: stop,
    createField: createField,
    interpolatePoint: interpolate,
    setData: setData,
    setOptions: setOptions
  };
  return windy;
};
if (!window.cancelAnimationFrame) {
  window.cancelAnimationFrame = function (id) {
    clearTimeout(id);
  };
}
})();

// This entry needs to be wrapped in an IIFE because it needs to be isolated against other entry modules.
(() => {
/*!******************************!*\
  !*** ./src/js/mapManager.js ***!
  \******************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MapManager: () => (/* binding */ MapManager)
/* harmony export */ });
/* harmony import */ var _DataRenderer_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./DataRenderer.js */ "./src/js/DataRenderer.js");
/* harmony import */ var _gridUtils_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./gridUtils.js */ "./src/js/gridUtils.js");
/* harmony import */ var _gridPoint_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./gridPoint.js */ "./src/js/gridPoint.js");
/* harmony import */ var _apiService_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./apiService.js */ "./src/js/apiService.js");

'./DataRenderer.js';



class MapManager {
  constructor(mapId, apiCaller, options = {}) {
    this.apiCaller = apiCaller ?? _apiService_js__WEBPACK_IMPORTED_MODULE_3__.openMeteoApiCaller;
    this.map = null;
    this.velocityLayer = null;
    this.temperatureRenderer = null;
    this.precipitationRenderer = null;
    this.layerControl = null;
    this.isUpdating = false;
    this.lastZoom = null;
    this.updateTimeout = null;
    this.currentGrid = {
      bounds: null,
      pointDistance: null,
      grid: [],
      gridPointsMap: null,
      dx: null,
      dy: null,
      nx: null,
      ny: null
    };
    this.gridsMap = null;
    this.eventHandlers = {
      moveend: null,
      zoomend: null,
      click: null
    };
    this.handlersPaused = false;
    this.options = {
      randomData: options.randomData ?? true,
      demoMode: options.demoMode ?? true,
      // for debug
      center: options.center || [42.8, -8],
      zoom: options.zoom || 8,
      minZoom: options.minZoom || 3,
      maxZoom: options.maxZoom || 18,
      pointDistance: options.pointDistance ?? null,
      maxGridPoints: options.maxGridPoints ?? 600,
      maxBounds: options.maxBounds || null,
      mapAdjustment: options.mapAdjustment || 0,
      windyParameters: {
        ...this.getDefaultWindyParameters(),
        ...options.windyParams
      },
      dateType: options.dateType || 'current',
      start_date: options.start_date || null,
      end_date: options.end_date || null,
      hour_index: options.hour_index || null,
      // to-do: just use daily data and store it
      layerControlPosition: options.layerControlPosition ?? 'topleft'
    };
    this.initialize(mapId);
  }
  initialize(mapId) {
    //console.log("######## initialize ########");
    if (typeof mapId === 'string') {
      this.map = L.map(mapId, {
        center: this.options.center,
        zoom: this.options.zoom
      });
    } else if (mapId instanceof L.Map) {
      this.map = mapId; // if map id is a map instance, use it directly
    } else {
      throw new Error('Invalid mapId. It should be a string or an instance of L.Map');
    }

    // Add base layers
    this.setupBaseLayers();

    // Setup grid points
    this.currentGrid.gridPointsMap = new Map();
    this.gridsMap = new Map();

    // Initialize weather layers
    this.initializeWindLayer();
    this.initializeTemperatureLayer();
    this.initializePrecipitationLayer();

    // Initialize event handlers
    this.initializeEventHandlers();

    // Initialize event listeners for layer control
    this.addLayerControlListeners();
  }
  getDefaultWindyParameters() {
    return {
      minVelocity: 0,
      maxVelocity: 10,
      velocityScale: 0.005,
      particleAge: 90,
      lineWidth: 1,
      particleMultiplier: 1 / 300,
      frameRate: 15,
      colorScale: ["rgb(0, 0, 128)", "rgb(0, 0, 255)", "rgb(75, 0, 130)", "rgb(138, 43, 226)", "rgb(255, 0, 255)", "rgb(255, 0, 200)", "rgb(255, 0, 150)", "rgb(255, 0, 100)", "rgb(255, 0, 50)", "rgb(255, 0, 0)"]
    };
  }
  getPointDistanceFromBounds(bounds) {
    return _gridUtils_js__WEBPACK_IMPORTED_MODULE_1__["default"].calculateOptimalPointDistance(bounds, this.options);
  }

  // Useless
  getPointDistanceFromZoom(zoom) {
    //console.log("getPointDistanceFromZoom", zoom);
    if (zoom <= 7) return 1;else if (zoom > 7 && zoom <= 8) return 0.5;else if (zoom > 8 && zoom <= 9) return 0.25;else if (zoom > 9 && zoom < 11) return 0.125;else return 0.0625;
  }
  getWeatherDataAt(lat, lng) {
    const {
      gridPointsMap,
      dx,
      dy,
      nx,
      ny,
      bounds
    } = this.currentGrid;
    if (!bounds) return null; // No bounds available
    const latNW = bounds.getNorthWest().lat;
    const lonSW = bounds.getSouthWest().lng;

    // Get grid cell indices
    const i = Math.floor((latNW - lat) / dy);
    const j = Math.floor((lng - lonSW) / dx);
    if (i < 0 || i >= ny - 1 || j < 0 || j >= nx - 1) return null; // Out of bounds

    // Calculate corner coordinates and retrieve grid points
    const corners = [{
      lat: latNW - i * dy,
      lng: lonSW + j * dx
    }, {
      lat: latNW - i * dy,
      lng: lonSW + (j + 1) * dx
    }, {
      lat: latNW - (i + 1) * dy,
      lng: lonSW + j * dx
    }, {
      lat: latNW - (i + 1) * dy,
      lng: lonSW + (j + 1) * dx
    }];
    const points = corners.map(({
      lat,
      lng
    }) => gridPointsMap.get(_gridUtils_js__WEBPACK_IMPORTED_MODULE_1__["default"].generatePointKey(lat, lng)));
    if (points.some(p => !p)) {
      throw new Error('Missing grid points for interpolation');
    }
    const [p1, p2, p3, p4] = points;
    const [x1, x2] = [p1.longitude, p2.longitude];
    const [y1, y2] = [p1.latitude, p3.latitude];

    // Draw interpolation area
    if (this.options.demoMode) {
      const rectangle = L.rectangle([[y1, x1], [y2, x2]], {
        color: 'red',
        weight: 1
      }).addTo(this.map);
      this.map.once('click', () => this.map.removeLayer(rectangle));
    }
    const interpolate = (v11, v21, v12, v22) => {
      const R1 = (x2 - lng) / (x2 - x1) * v11 + (lng - x1) / (x2 - x1) * v21;
      const R2 = (x2 - lng) / (x2 - x1) * v12 + (lng - x1) / (x2 - x1) * v22;
      return (y2 - lat) / (y2 - y1) * R1 + (lat - y1) / (y2 - y1) * R2;
    };
    const temperature = interpolate(p1.weatherData.temperature, p2.weatherData.temperature, p3.weatherData.temperature, p4.weatherData.temperature);
    const precipitation = interpolate(p1.weatherData.precipitation, p2.weatherData.precipitation, p3.weatherData.precipitation, p4.weatherData.precipitation);
    const windSpeed = interpolate(p1.weatherData.wind.speed, p2.weatherData.wind.speed, p3.weatherData.wind.speed, p4.weatherData.wind.speed);
    const windDirection = interpolate(p1.weatherData.wind.direction, p2.weatherData.wind.direction, p3.weatherData.wind.direction, p4.weatherData.wind.direction);
    const precipitationProb = interpolate(p1.weatherData.precipitation_prob, p2.weatherData.precipitation_prob, p3.weatherData.precipitation_prob, p4.weatherData.precipitation_prob);
    return {
      temperature,
      precipitation,
      precipitationProb,
      wind: {
        speed: windSpeed,
        direction: windDirection
      }
    };
  }
  setupBaseLayers() {
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    const Esri_WorldImagery = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
    const cartoDbDark = L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png');
    const cartoDbLight = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png');
    this.layerControl = L.control.layers({
      Satellite: Esri_WorldImagery,
      'OpenStreetMap': osm,
      'Carto Db Dark': cartoDbDark,
      'cartoDbLight': cartoDbLight
    }, null, {
      position: this.options.layerControlPosition
    }).addTo(this.map);
    cartoDbDark.addTo(this.map);
  }
  destroy() {
    // Remove all layers and clear renderers
    if (this.layerControl && this.layerControl._layers) {
      // Iterar sobre cada capa registrada en el control
      for (let key in this.layerControl._layers) {
        const layerInfo = this.layerControl._layers[key];
        if (this.map.hasLayer(layerInfo.layer)) this.map.removeLayer(layerInfo.layer);
      }
    }
    if (this.layerControl) {
      this.map.removeControl(this.layerControl);
      this.layerControl = null;
    }

    // Clear event handlers
    this.map.off('moveend', this.eventHandlers.moveend);
    this.map.off('zoomend', this.eventHandlers.zoomend);
    this.map.off('click', this.eventHandlers.click);

    // Clear timeouts and data
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }

    // Clear grid data
    this.currentGrid = {
      bounds: null,
      grid: [],
      gridPointsMap: null,
      pointDistance: null,
      dx: null,
      dy: null,
      nx: null,
      ny: null
    };
    this.gridsMap = null;
    this.isUpdating = false;
    this.lastZoom = null;
  }
  debounce(func, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), delay);
    };
  }
  initializeEventHandlers() {
    //console.log("######## initializeEventHandlers ########");
    this.eventHandlers.moveend = this.debounce(() => {
      //console.log("Procesando 'moveend'...");
      if (this.gridsMap.size === 0) return;
      const mapBounds = this.map.getBounds();
      const gridBounds = this.currentGrid.bounds;
      const isInside = gridBounds.contains(mapBounds.getNorthEast()) && gridBounds.contains(mapBounds.getSouthWest());
      if (!isInside) {
        //console.log("Hole map is not in the grid");
        const {
          bounds
        } = _gridUtils_js__WEBPACK_IMPORTED_MODULE_1__["default"].adjustAndCount(mapBounds, this.currentGrid.pointDistance, this.options.mapAdjustment);
        this.currentGrid = _gridUtils_js__WEBPACK_IMPORTED_MODULE_1__["default"].gridBuilder(this.map, this.currentGrid.pointDistance, bounds, this.currentGrid.gridPointsMap, this.options);
        this.forceUpdate();
      }
    }, 300);
    this.eventHandlers.zoomend = this.debounce(async () => {
      //console.log("Procesando 'zoomend'...");
      if (this.gridsMap.size === 0) return;
      const mapBounds = this.map.getBounds();
      const gridBounds = this.currentGrid.bounds;
      const isInside = gridBounds.contains(mapBounds.getNorthEast()) && gridBounds.contains(mapBounds.getSouthWest());
      var {
        pointDistance,
        bounds
      } = this.getPointDistanceFromBounds(mapBounds);
      const pointChanged = pointDistance !== this.currentGrid.pointDistance;
      if (!isInside || pointChanged) {
        //console.log("Hole map is not in the grid");
        pointDistance = this.options.pointDistance ?? pointDistance;
        this.currentGrid = _gridUtils_js__WEBPACK_IMPORTED_MODULE_1__["default"].gridBuilder(this.map, pointDistance, bounds, this.currentGrid.gridPointsMap, this.options);
        this.forceUpdate();
      }
    }, 300);
    this.eventHandlers.click = this.debounce(e => {
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;

      // Call the API to fetch weather data for the clicked point
      const grid = {
        grid: [new _gridPoint_js__WEBPACK_IMPORTED_MODULE_2__.GridPoint(lat, lng)]
      };
      const options = {
        randomData: this.options.randomData,
        dateType: this.options.dateType
      };
      if (this.options.demoMode) {
        const pointData = this.fetchWeatherData(grid, options);
        console.log('API data:\n', pointData);
      }
      const weatherData = this.getWeatherDataAt(lat, lng);
      var popupContent = `<b>Coordinates:</b><br>` + `Lat: ${lat.toFixed(5)}<br>` + `Lng: ${lng.toFixed(5)}<br>`;
      if (weatherData) {
        popupContent += `<b>Temperature:</b> ${weatherData.temperature.toFixed(2)}°C<br>` + `<b>Precipitation:</b> ${weatherData.precipitation.toFixed(2)} mm<br>` + `<b>Wind:</b> ${weatherData.wind.speed.toFixed(2)} m/s, ${weatherData.wind.direction.toFixed(0)}°<br>` + `<b>Precipitation Probability:</b> ${weatherData.precipitationProb.toFixed(2)}%`;
      } else {
        popupContent += `<b>Warning:</b> The selected point is out of the bounds of the current grid.`;
      }
      var popup = L.popup({
        closeOnClick: true,
        className: 'windelsis-popup' // CSS class
      }).setLatLng(e.latlng).setContent(popupContent).openOn(this.map);
    }, 300);
    this.map.on('moveend', this.eventHandlers.moveend); // same handler cuz of calculateOptimalPointDistance implementation
    this.map.on('zoomend', this.eventHandlers.zoomend);
    this.map.on('click', this.eventHandlers.click);
  }
  pauseHandlers() {
    if (this.handlersPaused) return;
    this.map.off('moveend', this.eventHandlers.moveend);
    this.map.off('zoomend', this.eventHandlers.zoomend);
    this.handlersPaused = true;
    console.log('Handlers paused');
  }
  resumeHandlers() {
    if (!this.handlersPaused) return;
    this.map.on('moveend', this.eventHandlers.moveend);
    this.map.on('zoomend', this.eventHandlers.zoomend);
    this.handlersPaused = false;
    this.eventHandlers.zoomend();
    console.log('Handlers resumed');
  }
  toggleUpdates() {
    if (this.handlersPaused) this.resumeHandlers();else this.pauseHandlers();
    return this.handlersPaused;
  }
  addLayerControlListeners() {
    this.map.on("overlayadd", e => {
      //console.log("overlayadd", e.layer);
      if (e.layer === this.temperatureRenderer.canvasLayer) {
        if (this.map.hasLayer(this.precipitationRenderer.canvasLayer)) {
          //console.log("removing precipitation layer\n####");
          this.map.removeLayer(this.precipitationRenderer.canvasLayer);
        }
        this.velocityLayer.setOptions({
          colorScale: ["rgb(255, 255, 255)"]
        });
        if (this.map.hasLayer(this.velocityLayer)) {
          this.velocityLayer.remove();
          this.velocityLayer.addTo(this.map);
        }
      } else if (e.layer === this.precipitationRenderer.canvasLayer) {
        if (this.map.hasLayer(this.temperatureRenderer.canvasLayer)) {
          //console.log("removing temperature layer\n####");
          this.map.removeLayer(this.temperatureRenderer.canvasLayer);
        }
        this.velocityLayer.setOptions({
          colorScale: ["rgb(255, 255, 255)"]
        });
        if (this.map.hasLayer(this.velocityLayer)) {
          this.velocityLayer.remove();
          this.velocityLayer.addTo(this.map);
        }
      } /*else if (e.layer === this.velocityLayer) {
         if (!this.map.hasLayer(this.temperatureRenderer.canvasLayer) || !this.map.hasLayer(this.precipitationRenderer.canvasLayer)) {
           this.setWindyParameters(this.options.windyParameters);
         }
        }When adding any of the temp or prec layers, windy is added again and the ‘if’ is read.*/
    });
    this.map.on("overlayremove", e => {
      //console.log("overlayremove", e.layer);
      // Cuando se remueve la capa de temperatura
      if (e.layer === this.temperatureRenderer.canvasLayer || e.layer === this.precipitationRenderer.canvasLayer) {
        this.setWindyParameters(this.options.windyParameters);
        if (this.map.hasLayer(this.velocityLayer)) {
          this.velocityLayer.remove();
          this.velocityLayer.addTo(this.map);
        }
      }
    });
  }
  initializeTemperatureLayer() {
    //console.log("######## initializeTemperatureLayer ########");
    this.temperatureRenderer = new _DataRenderer_js__WEBPACK_IMPORTED_MODULE_0__.DataRenderer(this.map, [], {
      pixelSize: 5,
      opacity: 0.3,
      controlName: 'Temperature Layer',
      colorScale: _DataRenderer_js__WEBPACK_IMPORTED_MODULE_0__.COLOR_SCALES.temperature,
      layerControl: this.layerControl,
      demoMode: this.options.demoMode
    });
    this.temperatureRenderer.canvasLayer = this.temperatureRenderer.init();
  }
  initializePrecipitationLayer() {
    //console.log("######## initializePrecipitationLayer ########");
    this.precipitationRenderer = new _DataRenderer_js__WEBPACK_IMPORTED_MODULE_0__.DataRenderer(this.map, [], {
      pixelSize: 5,
      opacity: 0.3,
      controlName: 'Precipitation Layer',
      colorScale: _DataRenderer_js__WEBPACK_IMPORTED_MODULE_0__.COLOR_SCALES.precipitation,
      layerControl: this.layerControl,
      demoMode: this.options.demoMode
    });
    this.precipitationRenderer.canvasLayer = this.precipitationRenderer.init();
  }
  initializeWindLayer() {
    //console.log("######## initializeWindLayer ########");
    this.velocityLayer = L.velocityLayer({
      displayValues: true,
      displayOptions: {
        velocityType: "Global Wind",
        emptyString: "No velocity data"
      }
    });
    this.layerControl.addOverlay(this.velocityLayer, "Wind Layer"); // Add the layer
    this.velocityLayer.setOptions(this.options.windyParameters);
  }
  forceUpdate() {
    // (to-do) Check if the is new points in this.currentGrid.grid
    this.updateWeatherData().then(() => {
      //console.log(this.currentGrid);
      this.updateTemperatureData();
      this.updatePrecipitationData();
      this.updateWindData();
      this.currentGrid.grid = this.currentGrid.grid.filter(point => point.isStale());
      ; // Reset the grid new GridPoints array for the next update
      this.gridsMap.set(this.gridKey, this.currentGrid);
    });
  }
  async updateWeatherData() {
    const standardizedData = await this.fetchWeatherData(this.currentGrid, this.options);

    // Iterate over each point and assign the corresponding weather data.
    if (!this.options.randomData) standardizedData.forEach((weatherData, index) => this.currentGrid.grid[index].setWeatherData(weatherData));
  }
  updateTemperatureData() {
    //console.log("######## updateTemperatureData ########");
    this.temperatureRenderer.update(_gridUtils_js__WEBPACK_IMPORTED_MODULE_1__["default"].tempDataBuilder(this.currentGrid));
  }
  updatePrecipitationData() {
    //console.log("######## updatePrecipitationData ########");
    this.precipitationRenderer.update(_gridUtils_js__WEBPACK_IMPORTED_MODULE_1__["default"].precipDataBuilder(this.currentGrid));
  }
  updateWindData() {
    //console.log("######## updateWindData ########");
    this.velocityLayer.setData(_gridUtils_js__WEBPACK_IMPORTED_MODULE_1__["default"].windyDataBuilder(this.currentGrid, this.options));
  }
  getCurrentData() {
    const key = 'current';
    if (this.gridsMap.has(key)) {
      this.currentGrid = this.gridsMap.get(key); //console.log("Exists", this.currentGrid);
    } else {
      var {
        pointDistance,
        bounds
      } = this.getPointDistanceFromBounds(this.map.getBounds());
      let auxGrid = _gridUtils_js__WEBPACK_IMPORTED_MODULE_1__["default"].gridBuilder(this.map, pointDistance, bounds, new Map(), this.options);
      this.gridsMap.set(key, auxGrid);
      this.currentGrid = this.gridsMap.get(key);
    }
    return this.setDateType('current', {
      key
    });
  }
  getForecastData(start_date, end_date) {
    const key = `forecast_${start_date}_${end_date}`;
    if (this.gridsMap.has(key)) {
      this.currentGrid = this.gridsMap.get(key); //console.log("Exists", this.currentGrid);
    } else {
      var {
        pointDistance,
        bounds
      } = this.getPointDistanceFromBounds(this.map.getBounds());
      const auxGrid = _gridUtils_js__WEBPACK_IMPORTED_MODULE_1__["default"].gridBuilder(this.map, pointDistance, bounds, new Map(), this.options);
      this.gridsMap.set(key, auxGrid);
      this.currentGrid = auxGrid;
    }
    return this.setDateType('forecast', {
      key,
      start_date,
      end_date
    });
  }
  getHourlyForecast(start_date, end_date, hour_index) {
    const key = `forecast_hourly_${start_date}_${end_date}_${hour_index}`;
    if (this.gridsMap.has(key)) {
      this.currentGrid = this.gridsMap.get(key);
    } else {
      var {
        pointDistance,
        bounds
      } = this.getPointDistanceFromBounds(this.map.getBounds());
      const auxGrid = _gridUtils_js__WEBPACK_IMPORTED_MODULE_1__["default"].gridBuilder(this.map, pointDistance, bounds, new Map(), this.options);
      this.gridsMap.set(key, auxGrid);
      this.currentGrid = auxGrid;
    }
    return this.setDateType('forecast_hourly', {
      key,
      start_date,
      end_date,
      hour_index
    });
  }
  setDateType(dateType, options = {}) {
    this.options.dateType = dateType;
    if (dateType === 'forecast' || dateType === 'forecast_hourly') {
      this.options.start_date = options.start_date;
      this.options.end_date = options.end_date;
      this.options.hour_index = options.hour_index || null;
    } else {
      this.options.start_date = null;
      this.options.end_date = null;
      this.options.hour_index = null;
    }
    this.gridKey = options.key;
    return this.forceUpdate();
  }
  setWindyParameters(parameters) {
    //console.log("######## setWindyParameters ########",parameters);
    this.options.windyParameters = {
      ...this.options.windyParameters,
      ...parameters
    };
    if (this.velocityLayer) {
      this.velocityLayer.setOptions(this.options.windyParameters);
    }
  }
  showWeatherPopup(lat, lng) {
    const pointKey = _gridUtils_js__WEBPACK_IMPORTED_MODULE_1__["default"].generatePointKey(lat, lng);
    const gridPoint = this.currentGrid.gridPointsMap.get(pointKey);
    if (!gridPoint) {
      console.error("no gridPoint found for the given coordinates:", lat, lng);
      return;
    }
    const {
      temperature,
      wind,
      timestamp
    } = gridPoint.weatherData;
    const popupContent = `
      <div>
        <h4>Datos Meteorológicos</h4>
        <p><strong>Coordenadas:</strong> Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}</p>
        <p><strong>Temperatura:</strong> ${temperature !== null ? temperature + ' °C' : 'No disponible'}</p>
        <p><strong>Viento:</strong> ${wind.speed !== null ? wind.speed + ' m/s' : 'No disponible'} 
           ${wind.direction !== null ? ' - ' + wind.direction + '°' : ''}</p>
        ${timestamp ? `<p><strong>Actualizado:</strong> ${new Date(timestamp).toLocaleString()}</p>` : ''}
      </div>
    `;
    L.popup({
      closeOnClick: true,
      autoClose: false
    }).setLatLng([lat, lng]).setContent(popupContent).openOn(this.map);
  }
  async fetchWeatherData(grid, options) {
    const points = grid.grid || grid; // Use grid.grid if available; otherwise, use grid directly
    const apiOptions = {
      dateType: options.dateType,
      start_date: options.start_date,
      end_date: options.end_date,
      hour_index: options.hour_index
    };
    if (options.randomData) {
      _gridUtils_js__WEBPACK_IMPORTED_MODULE_1__["default"].generateRandomGridData(points);
      return;
    }
    try {
      let standardizedDataArray = [];
      if (points && points.length > 0) {
        standardizedDataArray = await this.apiCaller(points, apiOptions);
      }
      return standardizedDataArray;
    } catch (error) {
      console.error('Fetching weather data failed:', error);
      throw error;
    }
  }
}
})();

/******/ 	return __webpack_exports__;
/******/ })()
;
});