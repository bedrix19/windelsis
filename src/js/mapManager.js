import { parseOpenMeteo, parseMeteoSIX } from "./apiService.js";
import { DataRenderer, COLOR_SCALES } from "./DataRenderer.js"; './DataRenderer.js';

export class MapManager {
  constructor(mapId, apiCaller, options = {}) {
    this.apiCaller = apiCaller;
    this.map = null;
    this.heatmapLayer = null;
    this.velocityLayer = null;
    this.temperatureRenderer = null;
    this.precipitationRenderer = null;
    this.layerControl = null;
    this.isUpdating = false;
    this.lastZoom = null;
    this.updateTimeout = null;
    this.currentGrid = {
      bounds: null,
      grid: [],
      gridPointsMap: null,
      dx: null,
      dy: null,
      nx: null,
      ny: null
    };
    this.gridsMap = null;
    this.options = {
      randomData: options.randomData || true,
      demoMode: options.demoMode || true,
      center: options.center || [42.8, -8],
      zoom: options.zoom || 8,
      minZoom: options.minZoom || 3,
      maxZoom: options.maxZoom || 18,
      updateDelay: options.updateDelay || 500,
      pointDistance:  options.pointDistance || null,
      maxGridPoints: options.maxGridPoints || 600,
      mapAdjustment: options.mapAdjustment || 0,
      windyParameters: options.windyParams || this.getDefaultWindyParameters(),
      dateType: options.dateType || 'current',
      start_date: options.start_date || null,
      end_date: options.end_date || null,
      hour_index: options.hour_index || null
    };
    
    this.initialize(mapId);
  }

  initialize(mapId) {//console.log("######## initialize ########");
    this.map = L.map(mapId, {
      center: this.options.center,
      zoom: this.options.zoom
    });

    // Add base layers
    this.setupBaseLayers();
    
    // Setup grid points
    this.currentGrid.gridPointsMap = new Map();
    this.gridsMap = new Map();

    // Initialize weather layers
    this.initializeTemperatureLayer();
    this.initializePrecipitationLayer();
    this.initializeWindLayer();

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
      particleMultiplier: 1/300,
      frameRate: 15,
      colorScale: [
        "rgb(0, 0, 128)",
        "rgb(0, 0, 255)",
        "rgb(75, 0, 130)",
        "rgb(138, 43, 226)",
        "rgb(255, 0, 255)",
        "rgb(255, 0, 200)",
        "rgb(255, 0, 150)",
        "rgb(255, 0, 100)",
        "rgb(255, 0, 50)", 
        "rgb(255, 0, 0)"   
      ]
    };
  }

  getPointDistanceFromBounds(bounds) {
    return calculateOptimalPointDistance(bounds, this.options.maxGridPoints);
  }

  getPointDistanceFromZoom(zoom) {
    console.log("getPointDistanceFromZoom", zoom);
    if (zoom <= 7) return 1;
    else if (zoom > 7 && zoom <= 8) return 0.5;
    else if (zoom > 8 && zoom <= 9) return 0.25;
    else if (zoom > 9 && zoom < 11) return 0.125;
    else return 0.0625;
  }

  getWeatherDataAt(lat, lng) {
    const { gridPointsMap, dx, dy, nx, ny, bounds } = this.currentGrid;

    const latNW = bounds.getNorthWest().lat;
    const lonSW = bounds.getSouthWest().lng;

    // Get grid cell indices
    const i = Math.floor((latNW - lat) / dy);
    const j = Math.floor((lng - lonSW) / dx);

    if (i < 0 || i >= ny - 1 || j < 0 || j >= nx - 1) {
      throw new Error('Coordinates outside grid bounds');
    }

    // Calculate corner coordinates and retrieve grid points
    const corners = [
      { lat: latNW - i * dy, lng: lonSW + j * dx },
      { lat: latNW - i * dy, lng: lonSW + (j + 1) * dx },
      { lat: latNW - (i + 1) * dy, lng: lonSW + j * dx },
      { lat: latNW - (i + 1) * dy, lng: lonSW + (j + 1) * dx }
    ];

    const points = corners.map(({ lat, lng }) => gridPointsMap.get(generatePointKey(lat, lng)));
    if (points.some(p => !p)) {
      throw new Error('Missing grid points for interpolation');
    }

    const [p1, p2, p3, p4] = points;
    const [x1, x2] = [p1.longitude, p2.longitude];
    const [y1, y2] = [p1.latitude, p3.latitude];

    // Draw interpolation area
    if(this.options.demoMode) {
      const rectangle = L.rectangle([[y1, x1], [y2, x2]], { color: 'red', weight: 1 }).addTo(this.map);
      this.map.once('click', () => this.map.removeLayer(rectangle));
    }

    const interpolate = (v11, v21, v12, v22) => {
      const R1 = ((x2 - lng) / (x2 - x1)) * v11 + ((lng - x1) / (x2 - x1)) * v21;
      const R2 = ((x2 - lng) / (x2 - x1)) * v12 + ((lng - x1) / (x2 - x1)) * v22;
      return ((y2 - lat) / (y2 - y1)) * R1 + ((lat - y1) / (y2 - y1)) * R2;
    };

    const temperature = interpolate(p1.weatherData.temperature, p2.weatherData.temperature, p3.weatherData.temperature, p4.weatherData.temperature);
    const precipitation = interpolate(p1.weatherData.precipitation, p2.weatherData.precipitation, p3.weatherData.precipitation, p4.weatherData.precipitation);
    const windSpeed = interpolate(p1.weatherData.wind.speed, p2.weatherData.wind.speed, p3.weatherData.wind.speed, p4.weatherData.wind.speed);
    const windDirection = interpolate(p1.weatherData.wind.direction, p2.weatherData.wind.direction, p3.weatherData.wind.direction, p4.weatherData.wind.direction);

    return {
      temperature,
      precipitation,
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
      'cartoDbLight': cartoDbLight,
    }).addTo(this.map);

    cartoDbDark.addTo(this.map);
  }

  destroy() {
    // Remove all layers and clear renderers
    if (this.velocityLayer) {
      this.map.removeLayer(this.velocityLayer);
      this.velocityLayer = null;
    }

    if (this.temperatureRenderer) {
      if (this.temperatureRenderer.canvasLayer) {
        this.map.removeLayer(this.temperatureRenderer.canvasLayer);
      }
      this.temperatureRenderer = null;
    }

    if (this.precipitationRenderer) {
      if (this.precipitationRenderer.canvasLayer) {
        this.map.removeLayer(this.precipitationRenderer.canvasLayer);
      }
      this.precipitationRenderer = null; 
    }

    if (this.layerControl) {
      this.map.removeControl(this.layerControl);
      this.layerControl = null;
    }

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
      dx: null,
      dy: null, 
      nx: null,
      ny: null
    };
    this.gridsMap = null;

    // Remove map and reset state
    if (this.map) {
      this.map.off();
      this.map.remove();
      this.map = null;
    }

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

  initializeEventHandlers() {//console.log("######## initializeEventHandlers ########");
    const map = this.map;

    const handleMoveEnd = this.debounce(() => {//console.log("Procesando 'moveend'...");
      if(this.gridsMap.size === 0) return;
      var mapBounds = map.getBounds();
      const gridBounds = this.currentGrid.bounds;
      const isInside = gridBounds.contains(mapBounds.getNorthEast()) && gridBounds.contains(mapBounds.getSouthWest());

      if (!isInside) {//console.log("Hole map is not in the grid");
        const dataBounds = getMapBoundsCoordinates(map, this.options.mapAdjustment);
        this.currentGrid = gridBuilder(map, this.options.pointDistance, dataBounds, this.currentGrid.gridPointsMap, this.options.demoMode);
        this.forceUpdate();
      }
    }, 300);

    const handleZoomEnd = this.debounce(async () => {//console.log("Procesando 'zoomend'...");
      if(this.gridsMap.size === 0) return;
      const mapBounds = map.getBounds();
      console.log("mapBounds", mapBounds);

      const gridBounds = this.currentGrid.bounds;
      const isInside = gridBounds.contains(mapBounds.getNorthEast()) && gridBounds.contains(mapBounds.getSouthWest());

      const dataBounds = getMapBoundsCoordinates(map, this.options.mapAdjustment);
      console.log("dataBounds", dataBounds);

      const pointDistance = this.getPointDistanceFromBounds(dataBounds);
      console.log("pointDistance", pointDistance);

      const pointChanged = pointDistance !== this.options.pointDistance;
      if (!isInside || pointChanged) {//console.log("Hole map is not in the grid");
        this.options.pointDistance = pointDistance;
        this.currentGrid = gridBuilder(map, this.options.pointDistance, dataBounds, this.currentGrid.gridPointsMap, this.options.demoMode);
        this.forceUpdate();
      }
    }, 300);

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleZoomEnd);

    map.on('click', (e) => {
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;
    
      // Call the API to fetch weather data for the clicked point
      const grid = {
        grid: [new GridPoint(lat, lng)],
      };
      const options = {
        randomData: this.options.randomData,
        dateType: this.options.dateType,
      };

      const pointData = this.fetchWeatherData(grid, options);
      console.log('API data:\n', pointData);

      const weatherData = this.getWeatherDataAt(lat, lng);
      var popup = L.popup({
        closeOnClick: true,
        className: 'own-popup' // CSS class
      })
      .setLatLng(e.latlng)
      .setContent(
        `<b>Coordinates:</b><br>` +
        `Lat: ${lat.toFixed(5)}<br>` +
        `Lng: ${lng.toFixed(5)}<br>` +
        `<b>Temperature:</b> ${weatherData.temperature.toFixed(2)}°C<br>` +
        `<b>Precipitation:</b> ${weatherData.precipitation.toFixed(2)} mm<br>` +
        `<b>Wind:</b> ${weatherData.wind.speed.toFixed(2)} m/s, ${weatherData.wind.direction.toFixed(0)}°`
      )
      .openOn(map);
    });
  }
  
  addLayerControlListeners(){
    this.map.on("overlayadd", (e) => {
        if(e.layer === this.temperatureRenderer.canvasLayer) {
          if(this.map.hasLayer(this.precipitationRenderer.canvasLayer))
            this.map.removeLayer(this.precipitationRenderer.canvasLayer);
          this.setWindyParameters(["rgb(255, 255, 255)"]);
          if (this.map.hasLayer(this.velocityLayer)) {
              this.velocityLayer.remove();
              this.velocityLayer.setOptions({ colorScale: ["rgb(255, 255, 255)"] });
              this.velocityLayer.addTo(this.map);
          }
        }else if(e.layer === this.precipitationRenderer.canvasLayer) {
          if(this.map.hasLayer(this.temperatureRenderer.canvasLayer))
            this.map.removeLayer(this.temperatureRenderer.canvasLayer);
          this.setWindyParameters(["rgb(255, 255, 255)"]);
          if (this.map.hasLayer(this.velocityLayer)) {
              this.velocityLayer.remove();
              this.velocityLayer.setOptions({ colorScale: ["rgb(255, 255, 255)"] });
              this.velocityLayer.addTo(this.map);
          }
        }/*else if (e.layer === this.velocityLayer) {
          if (!this.map.hasLayer(this.temperatureRenderer.canvasLayer) || !this.map.hasLayer(this.precipitationRenderer.canvasLayer)) {
            this.setWindyParameters(this.options.windyParameters);
          }
        }When adding any of the temp or prec layers, windy is added again and the ‘if’ is read.*/
    });

    this.map.on("overlayremove", (e) => {
        console.log("overlayremove", e.layer);
        // Cuando se remueve la capa de temperatura
        if(e.layer === this.temperatureRenderer.canvasLayer || e.layer === this.precipitationRenderer.canvasLayer) {
          this.setWindyParameters(this.options.windyParameters);
          if (this.map.hasLayer(this.velocityLayer)) {
                this.velocityLayer.remove();
                this.velocityLayer.addTo(this.map);
            }
        }
    });
  }

  initializeTemperatureLayer() {//console.log("######## initializeTemperatureLayer ########");
    this.temperatureRenderer = new DataRenderer(this.map, [], {
      pixelSize: 5,
      opacity: 0.3,
      controlName: 'Temperature Layer',
      colorScale: COLOR_SCALES.temperature,
      layerControl: this.layerControl,
      demoMode: this.options.demoMode
    });
  
    this.temperatureRenderer.canvasLayer = this.temperatureRenderer.init();
  }

  initializePrecipitationLayer() {//console.log("######## initializePrecipitationLayer ########");
    this.precipitationRenderer = new DataRenderer(this.map, [], {
      pixelSize: 5,
      opacity: 0.3,
      controlName: 'Precipitation Layer',
      colorScale: COLOR_SCALES.precipitation,
      layerControl: this.layerControl,
      demoMode: this.options.demoMode
    });
  
    this.precipitationRenderer.canvasLayer = this.precipitationRenderer.init();
  }

  initializeWindLayer() {//console.log("######## initializeWindLayer ########");
    this.velocityLayer = L.velocityLayer({
      displayValues: true,
      displayOptions: {
        velocityType: "Global Wind",
        emptyString: "No velocity data"
      },
    });

    this.layerControl.addOverlay(this.velocityLayer, "Wind Layer"); // Añadir la capa
    this.velocityLayer.setOptions(this.options.windyParameters);
  }

  forceUpdate() {
    // Check if the is new points in this.currentGrid.grid
    this.updateWeatherData().then(() => {
      this.updateTemperatureData();
      this.updatePrecipitationData();
      this.updateWindData();
      this.currentGrid.grid = []; // Reset the grid new GridPoints array for the next update
      this.gridsMap.set(this.gridKey, this.currentGrid);
    });
  }

  async updateWeatherData(){
    // Logica para actualizar la grilla de datos meteorológicos
    const standardizedData = await this.fetchWeatherData(this.currentGrid, this.options);

    // Iterate over each point and assign the corresponding weather data.
    if(!this.options.randomData)
      standardizedData.forEach((weatherData, index) => this.currentGrid.grid[index].setWeatherData(weatherData));
  }

  updateTemperatureData() {
    console.log("######## updateTemperatureData ########");
    this.temperatureRenderer.update(tempDataBuilder(this.currentGrid));
  }

  updatePrecipitationData() {
    console.log("######## updatePrecipitationData ########");
    this.precipitationRenderer.update(precipDataBuilder(this.currentGrid));
  }

  updateWindData() {
    console.log("######## updateWindData ########");
    this.velocityLayer.setData(windyDataBuilder(this.currentGrid, this.options));
  }

  getMap() {
    return this.map;
  }

  getVelocityLayer() {
    return this.velocityLayer;
  }

  getCurrentGrid() {
    return this.currentGrid;
  }

  getCurrentData() {
    const key = 'current';

    if (this.gridsMap.has(key)) {
      this.currentGrid = this.gridsMap.get(key);//console.log("Exists", this.currentGrid);
    } else {
      const mapBounds = getMapBoundsCoordinates(this.map, this.options.mapAdjustment);
      this.options.pointDistance = this.getPointDistanceFromBounds(mapBounds);
      let auxGrid = gridBuilder(
        this.map,
        this.options.pointDistance,
        getMapBoundsCoordinates(this.map, this.options.mapAdjustment),
        new Map(),
        this.options.demoMode
      );
      this.gridsMap.set(key, auxGrid);
      this.currentGrid = this.gridsMap.get(key);
    }
    return this.setDateType('current', { key });
  }

  getForecastData(start_date, end_date) {
    const key = `forecast_${start_date}_${end_date}`;

    if (this.gridsMap.has(key)) {
      this.currentGrid = this.gridsMap.get(key);//console.log("Exists", this.currentGrid);
    } else {
      const mapBounds = getMapBoundsCoordinates(this.map, this.options.mapAdjustment);
      this.options.pointDistance = this.getPointDistanceFromBounds(mapBounds);
      const auxGrid = gridBuilder(
        this.map,
        this.options.pointDistance,
        getMapBoundsCoordinates(this.map, this.options.mapAdjustment),
        new Map(),
        this.options.demoMode
      );
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
      const mapBounds = getMapBoundsCoordinates(this.map, this.options.mapAdjustment);
      this.options.pointDistance = this.getPointDistanceFromBounds(mapBounds);
      const auxGrid = gridBuilder(
        this.map,
        this.options.pointDistance,
        getMapBoundsCoordinates(this.map, this.options.mapAdjustment),
        new Map(),
        this.options.demoMode
      );
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
    console.log("######## setWindyParameters ########", parameters);
    this.options.windyParameters = { ...this.options.windyParameters, ...parameters };
    if (this.velocityLayer) {//console.log("Seteando parametros de windy");
      this.velocityLayer.setOptions(this.options.windyParameters);
    }
  }

  showWeatherPopup(lat, lng) {
    const pointKey = generatePointKey(lat, lng);
    const gridPoint = this.currentGrid.gridPointsMap.get(pointKey);
    
    if (!gridPoint) {
      console.error("no gridPoint found for the given coordinates:", lat, lng);
      return;
    }
    
    const { temperature, wind, timestamp } = gridPoint.weatherData;
    
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
      autoClose: false,
    }).setLatLng([lat, lng])
      .setContent(popupContent)
      .openOn(this.map);
  }
  
  async fetchWeatherData(grid, options) {
    const points = grid.grid || grid; // Use grid.grid if available; otherwise, use grid directly
  
    if (options.randomData) {
      generateRandomGridData(points);
      return;
    }
  
    try {
      const standardizedDataArray = await this.apiCaller(points, options);

      return standardizedDataArray;
    } catch (error) {
      console.error('Fetching weather data failed:', error);
      throw error;
    }
  }
}

class GridPoint {
  constructor(latitude, longitude) {
    this.latitude = latitude;
    this.longitude = longitude;
    this.id = generatePointKey(latitude,longitude);
    this.weatherData = {
      weather_units: {
        temperature: '°C',
        wind_speed: 'm/s',
        wind_direction: '°',
        precipitation: 'mm'
      },
      temperature: null,
      wind: {
        speed: null,
        direction: null,
      },
      precipitation: null,
      timestamp: null,
      rawData: null,
    };
    this.windComponents = {
      u: null,
      v: null
    }
  }

  setWeatherData(data) {
    this.weatherData = data;
    if (this.weatherData.wind.speed !== null && this.weatherData.wind.direction !== null) {
      const { u, v } = convertWindDirection(this.weatherData.wind.speed, this.weatherData.wind.direction);
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

function generateRandomGridData(points) {
  console.log("Generating random grid data...");
  const baseTemperature = (Math.random() * 20) + 5; // Temperatura entre 5º y 25º
  const baseWindSpeed = (Math.random() * 10) + 5; // Velocidad del viento entre 5 y 15 m/s
  const baseWindDirection = Math.random() * 360; // Dirección del viento entre 0 y 360 grados
  const basePrecipitation = Math.random() * 5; // Precipitación base entre 0 y 5 mm

  // Check if points is a Map and convert to array if necessary
  const pointsArray = points instanceof Map ? Array.from(points.values()) : points;

  pointsArray.forEach(point => {
    const randomTemperature = (baseTemperature + (Math.random() * 10 - 5)).toFixed(2); // Varianza de ±5
    const randomWindSpeed = (baseWindSpeed + (Math.random() * 5 - 2.5)).toFixed(2); // Varianza de ±2.5
    const randomWindDirection = (baseWindDirection + (Math.random() * 180 - 45)).toFixed(2); // Varianza de ±45
    const randomPrecipitation = (basePrecipitation + (Math.random() * 2 - 1)).toFixed(2); // Varianza de ±1

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
      timestamp: new Date().toISOString(), // Format: 2025-02-24T09:19:57.000Z
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

function calculateOptimalPointDistance(bounds, maxPoints = 150) {
  const possibleDistances = [0.0625, 0.125, 0.25, 0.5, 1];
  const lonRange = Math.abs(bounds.getNorthEast().lng - bounds.getSouthWest().lng);
  const latRange = Math.abs(bounds.getNorthEast().lat - bounds.getSouthWest().lat);

  // Calculate points needed for each distance
  for (const distance of possibleDistances) {
    const nx = Math.ceil(lonRange / distance) + 1;
    const ny = Math.ceil(latRange / distance) + 1;
    const totalPoints = nx * ny;

    if (totalPoints <= maxPoints) {
      console.log(`Selected point distance: ${distance}° (${nx}x${ny}=${totalPoints} points)`);
      return distance;
    }
    console.log(`Distance ${distance}° would exceed maxPoints (${totalPoints} > ${maxPoints})`);
  }

  // If all distances would exceed maxPoints, return the largest distance
  console.log(`Using maximum distance: 1° due to area size`);
  return possibleDistances[possibleDistances.length - 1];
}

// get map bounds coordinates with a given adjustment (multiples of MULTIPLE)
function getMapBoundsCoordinates(map, adjustment = 0) {
  const MULTIPLE = 0.5;
  const bounds = map.getBounds();
  var southWest = bounds.getSouthWest();
  var northEast = bounds.getNorthEast();

  console.log("Map Bounds\nNW:", L.latLng(northEast.lat, southWest.lng), " NE:", northEast,
              " SW:", southWest, " SE:", L.latLng(southWest.lat, northEast.lng));

  function roundToMultiple(value, multiple, roundUp) {
    return roundUp
      ? Math.ceil(value / multiple) * multiple
      : Math.floor(value / multiple) * multiple;
  }

  southWest = L.latLng(
    roundToMultiple(southWest.lat, MULTIPLE, false) - adjustment,
    roundToMultiple(southWest.lng, MULTIPLE, false) - adjustment
  );
  northEast = L.latLng(
    roundToMultiple(northEast.lat, MULTIPLE, true) + adjustment,
    roundToMultiple(northEast.lng, MULTIPLE, true) + adjustment
  );

  return L.latLngBounds(southWest, northEast)
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

  console.log("Datos:", dataType, weatherData);
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

  console.log(windData); //console.log("windData", JSON.stringify(windData, null, 2));
  return windData;
}

/**
 * Generate a unique key for each point based on latitude and longitude.
 * the key is in the format "latitude_longitude" with 4 decimal places.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {string} - key in the format "latitude_longitude"
 */
function generatePointKey(latitude, longitude, decimals = 4) {
  return `${latitude.toFixed(decimals)}_${longitude.toFixed(decimals)}`;
}

/**
 * Build a lookup map for GridPoint objects using their latitude and longitude.
 *
 * @param {Array} points - Array of GridPoint objects.
 * @returns {Map} - Map with keys as "latitude_longitude" and values as GridPoint objects.
 */
function buildPointsLookup(points) {
  const lookup = new Map();
  points.forEach(point => {
    const key = generatePointKey(point.latitude, point.longitude);
    lookup.set(key, point);
  });
  return lookup;
}

// Calcular nx, ny, dx y dy
function calculateGridParameters(bounds, pointDistance=0.0625) {
  const lonRange = Math.abs(bounds.getNorthEast().lng - bounds.getSouthWest().lng);
  const latRange = Math.abs(bounds.getNorthEast().lat - bounds.getSouthWest().lat);
  console.log("lonRange", lonRange, "latRange", latRange);

  let auxDistance = 0;
  for(let i = 0; i < 16; i++) {
    if(latRange <= 0.0625 * i || lonRange <= 0.0625 * i) {
      // auxDistance = 0.0625 * i;
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

function gridBuilder(map, pointDistance, gridLimits, gridPointsMap, demoMode) {//gridLimits=mapBounds => _northEast y _southWest
  console.log("northWest", gridLimits.getNorthWest());
  console.log("northEast", gridLimits.getNorthEast());
  console.log("southWest", gridLimits.getSouthWest());
  console.log("southEast", gridLimits.getSouthEast());
  if(demoMode){
    L.marker(gridLimits.getNorthWest()).addTo(map);
    L.marker(gridLimits.getNorthEast()).addTo(map);
    L.marker(gridLimits.getSouthWest()).addTo(map);
    L.marker(gridLimits.getSouthEast()).addTo(map);
  }

  // Datos para la cuadricula
  const { nx, ny, dx, dy } = calculateGridParameters(gridLimits, pointDistance);
  if(demoMode) console.log("nx:", nx, "ny:", ny, "dx:", dx, "dy:", dy);

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
  if(demoMode){
    console.log("Puntos generados:", count);
    console.log("Puntos obviados:", count1 - count);
  }

  return {
    bounds: gridLimits,
    grid: points,
    gridPointsMap: gridPointsMap,
    dx: dx,
    dy: dy,
    nx: nx,
    ny: ny,
  }
}

export function updateWindyParameters(velocityLayer = null, windyParameters) {
  if (velocityLayer) velocityLayer.setOptions(windyParameters);
}