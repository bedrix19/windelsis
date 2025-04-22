import { DataRenderer, COLOR_SCALES } from "./DataRenderer.js"; './DataRenderer.js';
import GridUtils from './gridUtils.js';
import { GridPoint } from "./gridPoint.js";
import { openMeteoApiCaller } from './apiService.js';

export class MapManager {
  constructor(mapId, apiCaller, options = {}) {
    this.apiCaller = apiCaller ?? openMeteoApiCaller;
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
      click: null,
    },
    this.handlersPaused = false;
    this.options = {
      randomData: options.randomData ?? true,
      demoMode: options.demoMode ?? true,
      center: options.center || [42.8, -8],
      zoom: options.zoom || 8,
      minZoom: options.minZoom || 3,
      maxZoom: options.maxZoom || 18,
      pointDistance:  options.pointDistance || null,
      maxGridPoints: options.maxGridPoints || 600,
      mapAdjustment: options.mapAdjustment || 0,
      windyParameters: {...this.getDefaultWindyParameters(), ...options.windyParams},
      dateType: options.dateType || 'current',
      start_date: options.start_date || null,
      end_date: options.end_date || null,
      hour_index: options.hour_index || null
    };
    
    this.initialize(mapId);
  }

  initialize(mapId) {//console.log("######## initialize ########");
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
    this.initializeTemperatureLayer();
    this.initializePrecipitationLayer();
    this.initializeWindLayer();

    if(this.options.demoMode) {
      const weatherLayers = {
        "Temperature": this.temperatureRenderer.canvasLayer,
        "Precipitation": this.precipitationRenderer.canvasLayer,
        "Wind": this.velocityLayer
      }
      L.control.layers(null, weatherLayers, { position: 'topleft' }).addTo(this.map);
    }

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
    return GridUtils.calculateOptimalPointDistance(bounds, this.options.maxGridPoints);
  }

  getPointDistanceFromZoom(zoom) {//console.log("getPointDistanceFromZoom", zoom);
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

    const points = corners.map(({ lat, lng }) => gridPointsMap.get(GridUtils.generatePointKey(lat, lng)));
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
      'cartoDbLight': cartoDbLight,
    },null,{ position: 'topleft' }).addTo(this.map);

    cartoDbDark.addTo(this.map);
  }

  destroy() {
    // Remove all layers and clear renderers
    if (this.layerControl && this.layerControl._layers) {
      // Iterar sobre cada capa registrada en el control
      for (let key in this.layerControl._layers) {
        const layerInfo = this.layerControl._layers[key];
        if (this.map.hasLayer(layerInfo.layer))  this.map.removeLayer(layerInfo.layer);
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

  initializeEventHandlers() {//console.log("######## initializeEventHandlers ########");
    const map = this.map;

    this.eventHandlers.moveend = this.debounce(() => {//console.log("Procesando 'moveend'...");
      if(this.gridsMap.size === 0) return;
      var mapBounds = map.getBounds();
      const gridBounds = this.currentGrid.bounds;
      const isInside = gridBounds.contains(mapBounds.getNorthEast()) && gridBounds.contains(mapBounds.getSouthWest());

      if (!isInside) {//console.log("Hole map is not in the grid");
        const dataBounds = GridUtils.getMapBoundsCoordinates(map, this.options.mapAdjustment);
        this.currentGrid = GridUtils.gridBuilder(map, this.options.pointDistance, dataBounds, this.currentGrid.gridPointsMap, this.options.demoMode);
        this.forceUpdate();
      }
    }, 300);

    this.eventHandlers.zoomend = this.debounce(async () => {//console.log("Procesando 'zoomend'...");
      if(this.gridsMap.size === 0) return;
      const mapBounds = map.getBounds();

      const gridBounds = this.currentGrid.bounds;
      const isInside = gridBounds.contains(mapBounds.getNorthEast()) && gridBounds.contains(mapBounds.getSouthWest());

      const dataBounds = GridUtils.getMapBoundsCoordinates(map, this.options.mapAdjustment);

      const pointDistance = this.getPointDistanceFromBounds(dataBounds);

      const pointChanged = pointDistance !== this.options.pointDistance;
      if (!isInside || pointChanged) {//console.log("Hole map is not in the grid");
        this.options.pointDistance = pointDistance;
        this.currentGrid = GridUtils.gridBuilder(map, this.options.pointDistance, dataBounds, this.currentGrid.gridPointsMap, this.options.demoMode);
        this.forceUpdate();
      }
    }, 300);

    this.eventHandlers.click = this.debounce((e) => {
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

      if(this.options.demoMode) {
        const pointData = this.fetchWeatherData(grid, options);
        console.log('API data:\n', pointData);
      }

      const weatherData = this.getWeatherDataAt(lat, lng);
      var popup = L.popup({
        closeOnClick: true,
        className: 'windelsis-popup' // CSS class
      })
      .setLatLng(e.latlng)
      .setContent(
        `<b>Coordinates:</b><br>` +
        `Lat: ${lat.toFixed(5)}<br>` +
        `Lng: ${lng.toFixed(5)}<br>` +
        `<b>Temperature:</b> ${weatherData.temperature.toFixed(2)}°C<br>` +
        `<b>Precipitation:</b> ${weatherData.precipitation.toFixed(2)} mm<br>` +
        `<b>Wind:</b> ${weatherData.wind.speed.toFixed(2)} m/s, ${weatherData.wind.direction.toFixed(0)}°<br>` +
        `<b>Precipitation Probability:</b> ${weatherData.precipitationProb.toFixed(2)}%`
      )
      .openOn(map); 
    }, 300);

    map.on('moveend', this.eventHandlers.moveend);
    map.on('zoomend', this.eventHandlers.zoomend);
    map.on('click', this.eventHandlers.click);
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
    console.log('Handlers resumed');
  }

  toggleUpdates() {
    if (this.handlersPaused) this.resumeHandlers();
    else this.pauseHandlers();
    return this.handlersPaused;
  }
  
  addLayerControlListeners(){
    this.map.on("overlayadd", (e) => {//console.log("overlayadd", e.layer);
        if(e.layer === this.temperatureRenderer.canvasLayer) {
          if(this.map.hasLayer(this.precipitationRenderer.canvasLayer)){//console.log("removing precipitation layer\n####");
            this.map.removeLayer(this.precipitationRenderer.canvasLayer);}
          this.velocityLayer.setOptions({ colorScale: ["rgb(255, 255, 255)"] });
          if (this.map.hasLayer(this.velocityLayer)) {
              this.velocityLayer.remove();
              this.velocityLayer.addTo(this.map);
          }
        }else if(e.layer === this.precipitationRenderer.canvasLayer) {
          if(this.map.hasLayer(this.temperatureRenderer.canvasLayer)){//console.log("removing temperature layer\n####");
            this.map.removeLayer(this.temperatureRenderer.canvasLayer);}
          this.velocityLayer.setOptions({ colorScale: ["rgb(255, 255, 255)"] });
          if (this.map.hasLayer(this.velocityLayer)) {
              this.velocityLayer.remove();
              this.velocityLayer.addTo(this.map);
          }
        }/*else if (e.layer === this.velocityLayer) {
          if (!this.map.hasLayer(this.temperatureRenderer.canvasLayer) || !this.map.hasLayer(this.precipitationRenderer.canvasLayer)) {
            this.setWindyParameters(this.options.windyParameters);
          }
        }When adding any of the temp or prec layers, windy is added again and the ‘if’ is read.*/
    });

    this.map.on("overlayremove", (e) => {//console.log("overlayremove", e.layer);
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

    this.layerControl.addOverlay(this.velocityLayer, "Wind Layer"); // Add the layer
    this.velocityLayer.setOptions(this.options.windyParameters);
  }

  forceUpdate() {
    // (to-do) Check if the is new points in this.currentGrid.grid
    this.updateWeatherData().then(() => { console.log(this.currentGrid.grid);
      this.updateTemperatureData();
      this.updatePrecipitationData();
      this.updateWindData();
      this.currentGrid.grid = this.currentGrid.grid.filter(point => point.isStale());; // Reset the grid new GridPoints array for the next update
      this.gridsMap.set(this.gridKey, this.currentGrid);
    });
  }

  async updateWeatherData(){
    const standardizedData = await this.fetchWeatherData(this.currentGrid, this.options);

    // Iterate over each point and assign the corresponding weather data.
    if(!this.options.randomData)
      standardizedData.forEach((weatherData, index) => this.currentGrid.grid[index].setWeatherData(weatherData));
  }

  updateTemperatureData() {//console.log("######## updateTemperatureData ########");
    this.temperatureRenderer.update(GridUtils.tempDataBuilder(this.currentGrid));
  }

  updatePrecipitationData() {//console.log("######## updatePrecipitationData ########");
    this.precipitationRenderer.update(GridUtils.precipDataBuilder(this.currentGrid));
  }

  updateWindData() {//console.log("######## updateWindData ########");
    this.velocityLayer.setData(GridUtils.windyDataBuilder(this.currentGrid, this.options));
  }

  getCurrentData() {
    const key = 'current';

    if (this.gridsMap.has(key)) {
      this.currentGrid = this.gridsMap.get(key);//console.log("Exists", this.currentGrid);
    } else {
      const mapBounds = GridUtils.getMapBoundsCoordinates(this.map, this.options.mapAdjustment);
      this.options.pointDistance = this.getPointDistanceFromBounds(mapBounds);
      let auxGrid = GridUtils.gridBuilder(
        this.map,
        this.options.pointDistance,
        GridUtils.getMapBoundsCoordinates(this.map, this.options.mapAdjustment),
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
      const mapBounds = GridUtils.getMapBoundsCoordinates(this.map, this.options.mapAdjustment);
      this.options.pointDistance = this.getPointDistanceFromBounds(mapBounds);
      const auxGrid = GridUtils.gridBuilder(
        this.map,
        this.options.pointDistance,
        GridUtils.getMapBoundsCoordinates(this.map, this.options.mapAdjustment),
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
      const mapBounds = GridUtils.getMapBoundsCoordinates(this.map, this.options.mapAdjustment);
      this.options.pointDistance = this.getPointDistanceFromBounds(mapBounds);
      const auxGrid = GridUtils.gridBuilder(
        this.map,
        this.options.pointDistance,
        GridUtils.getMapBoundsCoordinates(this.map, this.options.mapAdjustment),
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

  setWindyParameters(parameters) { //console.log("######## setWindyParameters ########",parameters);
    this.options.windyParameters = { ...this.options.windyParameters, ...parameters };
    if (this.velocityLayer) {
      this.velocityLayer.setOptions(this.options.windyParameters);
    }
  }

  showWeatherPopup(lat, lng) {
    const pointKey = GridUtils.generatePointKey(lat, lng);
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
    const apiOptions = {
      dateType: options.dateType,
      start_date: options.start_date,
      end_date: options.end_date,
      hour_index: options.hour_index,
    }

    if (options.randomData) {
      GridUtils.generateRandomGridData(points);
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
