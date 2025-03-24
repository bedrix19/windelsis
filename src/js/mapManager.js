import { parseOpenMeteo, parseMeteoSIX } from "./apiService.js";
import { DataRenderer, COLOR_SCALES } from "./DataRenderer.js"; './DataRenderer.js';

export class MapManager {
  constructor(mapId, options = {}) {
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
    this.gridCollection = null; // Para almacenar las cuadrículas de datos por tipo de fecha
    this.options = {
      randomData: options.randomData || true,
      center: options.center || [42.8, -8],
      zoom: options.zoom || 8,
      minZoom: options.minZoom || 3,
      maxZoom: options.maxZoom || 18,
      updateDelay: options.updateDelay || 500,
      pointDistance:  options.pointDistance || null,
      maxGridPoints: options.maxGridPoints || 600,
      mapAdjustment: options.mapAdjustment || 0,
      windyParameters: this.getDefaultWindyParameters(),
      dateType: options.dateType || 'current',
      start_date: options.start_date || null,
      end_date: options.end_date || null,
      hour_index: options.hour_index || null
    };
    
    this.initialize(mapId);
  }

  initialize(mapId) {
    console.log("######## initialize ########");
    this.map = L.map(mapId, {
      center: this.options.center,
      zoom: this.options.zoom
    });

    // Add base layers
    this.setupBaseLayers();
    
    // Setup grid parameters
    const mapBounds = getMapBoundsCoordinates(this.map, this.options.mapAdjustment);
    this.options.pointDistance =  this.options.pointDistance !== null
                                  ? this.options.pointDistance
                                  : this.getPointDistanceFromBounds(mapBounds);
    this.currentGrid.gridPointsMap = new Map();
    this.currentGrid.gridCollection = new Map();
    this.currentGrid = gridBuilder(this.map, this.options.pointDistance, mapBounds, this.currentGrid.gridPointsMap);
    console.log("currentGrid", this.currentGrid);

    // Initialize weather layers
    this.initializeTemperatureLayer();
    this.initializePrecipitationLayer();
    this.initializeWindLayer();

    // Initialize event handlers
    this.initializeEventHandlers();

    // Add event listeners for layer control
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
  
    // Calculate corner coordinates
    const lat_p1 = latNW - i * dy;
    const lng_p1 = lonSW + j * dx;
    const lat_p2 = latNW - i * dy;
    const lng_p2 = lonSW + (j + 1) * dx;
    const lat_p3 = latNW - (i + 1) * dy;
    const lng_p3 = lonSW + j * dx;
    const lat_p4 = latNW - (i + 1) * dy;
    const lng_p4 = lonSW + (j + 1) * dx;

    // Get grid points
    const p1 = gridPointsMap.get(generatePointKey(lat_p1, lng_p1));
    const p2 = gridPointsMap.get(generatePointKey(lat_p2, lng_p2));
    const p3 = gridPointsMap.get(generatePointKey(lat_p3, lng_p3));
    const p4 = gridPointsMap.get(generatePointKey(lat_p4, lng_p4));

    if (!p1 || !p2 || !p3 || !p4) {
      throw new Error('Missing grid points for interpolation');
    }

    // Interpolation coordinates
    const x1 = p1.longitude;
    const x2 = p2.longitude;
    const y1 = p1.latitude;
    const y2 = p3.latitude;

    // Draw interpolation area
    const rectangle = L.rectangle([[y1, x1], [y2, x2]], { color: 'red', weight: 1 }).addTo(this.map);
    this.map.once('click', () => this.map.removeLayer(rectangle));
  
    // Interpolate temperature
    const t11 = p1.weatherData.temperature;
    const t21 = p2.weatherData.temperature;
    const t12 = p3.weatherData.temperature;
    const t22 = p4.weatherData.temperature;
    const R1t = ((x2 - lng) / (x2 - x1)) * t11 + ((lng - x1) / (x2 - x1)) * t21;
    const R2t = ((x2 - lng) / (x2 - x1)) * t12 + ((lng - x1) / (x2 - x1)) * t22;
    const temperature = ((y2 - lat) / (y2 - y1)) * R1t + ((lat - y1) / (y2 - y1)) * R2t;

    // Interpolate precipitation
    const p11 = p1.weatherData.precipitation;
    const p21 = p2.weatherData.precipitation;
    const p12 = p3.weatherData.precipitation;
    const p22 = p4.weatherData.precipitation;
    const R1p = ((x2 - lng) / (x2 - x1)) * p11 + ((lng - x1) / (x2 - x1)) * p21;
    const R2p = ((x2 - lng) / (x2 - x1)) * p12 + ((lng - x1) / (x2 - x1)) * p22;
    const precipitation = ((y2 - lat) / (y2 - y1)) * R1p + ((lat - y1) / (y2 - y1)) * R2p;

    // Interpolate wind
    const ws11 = p1.weatherData.wind.speed;
    const ws21 = p2.weatherData.wind.speed;
    const ws12 = p3.weatherData.wind.speed;
    const ws22 = p4.weatherData.wind.speed;
    const R1w = ((x2 - lng) / (x2 - x1)) * ws11 + ((lng - x1) / (x2 - x1)) * ws21;
    const R2w = ((x2 - lng) / (x2 - x1)) * ws12 + ((lng - x1) / (x2 - x1)) * ws22;
    const windSpeed = ((y2 - lat) / (y2 - y1)) * R1w + ((lat - y1) / (y2 - y1)) * R2w;

    const wd11 = p1.weatherData.wind.direction;
    const wd21 = p2.weatherData.wind.direction;
    const wd12 = p3.weatherData.wind.direction;
    const wd22 = p4.weatherData.wind.direction;
    const R1d = ((x2 - lng) / (x2 - x1)) * wd11 + ((lng - x1) / (x2 - x1)) * wd21;
    const R2d = ((x2 - lng) / (x2 - x1)) * wd12 + ((lng - x1) / (x2 - x1)) * wd22;
    const windDirection = ((y2 - lat) / (y2 - y1)) * R1d + ((lat - y1) / (y2 - y1)) * R2d;

    return {
      temperature: temperature,
      precipitation: precipitation,
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

  destroy(){
    if (this.velocityLayer) {
      this.map.removeLayer(this.velocityLayer);
      this.velocityLayer = null;
    }
  
    if (this.heatmapLayer) {
      this.map.removeLayer(this.heatmapLayer);
      this.heatmapLayer = null;
    }

    if (this.layerControl) {
      this.map.removeControl(this.layerControl);
      this.layerControl = null;
    }
  
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
  
    // Quitar todos los eventos del mapa
    if (this.map) {
      this.map.off();
      // Remover el mapa del DOM
      this.map.remove();
      this.map = null;
    }

    // Limpiar la información de la cuadrícula
    this.currentGrid = null;
  }

  debounce(func, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
  }

  initializeEventHandlers() {
    console.log("######## initializeEventHandlers ########");
    const map = this.map;

    const handleMoveEnd = this.debounce(() => {
      console.log("Procesando 'moveend'...");

      var mapBounds = map.getBounds();
      const gridBounds = this.currentGrid.bounds;
      const isInside = gridBounds.contains(mapBounds.getNorthEast()) && gridBounds.contains(mapBounds.getSouthWest());

      if (!isInside) {
        console.log("El área visible del mapa NO está completamente dentro del área definida.");
        const dataBounds = getMapBoundsCoordinates(map, this.options.mapAdjustment);
        this.currentGrid = gridBuilder(map, this.options.pointDistance, dataBounds, this.currentGrid.gridPointsMap);
        this.forceUpdate();
      }
    }, 300);

    const handleZoomEnd = this.debounce(async () => {
      console.log("Procesando 'zoomend'...");

      const mapBounds = map.getBounds();
      console.log("mapBounds", mapBounds);

      const gridBounds = this.currentGrid.bounds;
      const isInside = gridBounds.contains(mapBounds.getNorthEast()) && gridBounds.contains(mapBounds.getSouthWest());

      const dataBounds = getMapBoundsCoordinates(map, this.options.mapAdjustment);
      console.log("dataBounds", dataBounds);

      const pointDistance = this.getPointDistanceFromBounds(dataBounds);
      console.log("pointDistance", pointDistance);

      const pointChanged = pointDistance !== this.options.pointDistance;
      if (!isInside || pointChanged) {
        console.log("El área visible del mapa NO está completamente dentro del área definida.");
        this.options.pointDistance = pointDistance;
        this.currentGrid = gridBuilder(map, this.options.pointDistance, dataBounds, this.currentGrid.gridPointsMap);
        this.forceUpdate();
      }
    }, 300);

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleZoomEnd);

    map.on('click', (e) => {
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;
    
      // Llama a la API de open-meteo para obtener los datos de la ubicación
      const baseUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`;
      fetch(baseUrl)
        .then(response => response.json())
        .then(data => {
          console.log('Datos de open-meteo:\n',data);
        })
        .catch(error => console.error('Error fetching weather data:', error));

      const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
      const baseUrl2 = `https://servizos.meteogalicia.gal/apiv4/getNumericForecastInfo?coords=${lng},${lat}&variables=temperature,wind&API_KEY=219XBzNU7vG87JnRXaDq6uh35DbheXH1tAx72B6ElfPoVe7S6mqWUKzSQkJuqcLl`;
      fetch(baseUrl2)
        .then(response => response.json())
        .then(data => {
          console.log('Datos de MeteoSIX:\n',data);
        })
        .catch(error => console.error('Error fetching weather data:', error));

      // Creamos el popup con algunas opciones básicas
      const weatherData = this.getWeatherDataAt(lat, lng);
      var popup = L.popup({
        closeOnClick: true,
        className: 'mi-popup-personalizado' // Clase personalizada para CSS
      })
      .setLatLng(e.latlng)
      .setContent(
        `<b>Coordenadas:</b><br>` +
        `Lat: ${lat.toFixed(5)}<br>` +
        `Lng: ${lng.toFixed(5)}<br>` +
        `<b>Temperatura:</b> ${weatherData.temperature.toFixed(2)}°C<br>` +
        `<b>Precipitación:</b> ${weatherData.precipitation.toFixed(2)} mm<br>` +
        `<b>Viento:</b> ${weatherData.wind.speed.toFixed(2)} m/s @ ${weatherData.wind.direction.toFixed(0)}°`
      )
      .openOn(map);
    });
  }
  
  addLayerControlListeners(){
    this.map.on("overlayadd", (e) => {console.log("overlayadd", e.layer);
        if(e.layer === this.temperatureRenderer.canvasLayer) {
            this.map.removeLayer(this.precipitationRenderer.canvasLayer);
            this.setWindyParameters(["rgb(255, 255, 255)"]);
            if (this.map.hasLayer(this.velocityLayer)) {
                this.velocityLayer.remove();
                this.velocityLayer.setOptions({ colorScale: ["rgb(255, 255, 255)"] });
                this.velocityLayer.addTo(this.map);
            }
        } 
        else if(e.layer === this.precipitationRenderer.canvasLayer) {
            this.map.removeLayer(this.temperatureRenderer.canvasLayer);
            this.setWindyParameters(["rgb(255, 255, 255)"]);
            if (this.map.hasLayer(this.velocityLayer)) {
                this.velocityLayer.remove();
                this.velocityLayer.setOptions({ colorScale: ["rgb(255, 255, 255)"] });
                this.velocityLayer.addTo(this.map);
            }
        }
    });

    this.map.on("overlayremove", (e) => {
        console.log("overlayremove", e.layer);
        // Cuando se remueve la capa de temperatura (o podrías agregar similar lógica para precipitación)
        if(e.layer === this.temperatureRenderer.canvasLayer || e.layer === this.precipitationRenderer.canvasLayer) {
            if (this.map.hasLayer(this.velocityLayer)) {
                this.velocityLayer.remove();
                // Se restablecen los parámetros originales; asumimos que this.options.windyParameters contiene los valores previos
                this.setWindyParameters(this.options.windyParameters);
                this.velocityLayer.addTo(this.map);
            }
        }
    });
  }

  initializeTemperatureLayer() {
    console.log("######## initializeTemperatureLayer ########");
    this.temperatureRenderer = new DataRenderer(this.map, [], {
      pixelSize: 5,
      opacity: 0.3,
      controlName: 'Temperature Layer',
      colorScale: COLOR_SCALES.temperature,
      layerControl: this.layerControl
    });
  
    this.temperatureRenderer.canvasLayer = this.temperatureRenderer.init();
  }

  initializePrecipitationLayer() {
    console.log("######## initializePrecipitationLayer ########");
    this.precipitationRenderer = new DataRenderer(this.map, [], {
      pixelSize: 5,
      opacity: 0.3,
      controlName: 'Precipitation Layer',
      colorScale: COLOR_SCALES.precipitation,
      layerControl: this.layerControl
    });
  
    this.precipitationRenderer.canvasLayer = this.precipitationRenderer.init();
  }

  initializeWindLayer() {
    console.log("######## initializeWindLayer ########");
  }

  forceUpdate() {
    this.updateWindData().then(() => {
      this.updateTemperatureData();
      this.updatePrecipitationData();
    });
  }

  async updateWeatherData(){
    // Logica para actualizar la grilla de datos meteorológicos
  }

  async updateTemperatureData() {
    console.log("######## updateTemperatureData ########");
    this.temperatureRenderer.update(tempDataBuilder(this.currentGrid));
  }

  async updatePrecipitationData() {
    console.log("######## updatePrecipitationData ########");
    this.precipitationRenderer.update(precipDataBuilder(this.currentGrid));
  }

  async updateWindData(dateOptions = {}) {
    console.log("######## updateWindData ########", dateOptions);
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      console.log("Primera carga de datos");
      await fetchWeatherData(this.currentGrid, this.options);console.log("currentGrid", this.currentGrid);

      this.velocityLayer = DrawWindData({
        map: this.map,
        layerControl: this.layerControl,
        velocityLayer: this.velocityLayer,
        windyParameters: this.options.windyParameters,
        windyData: windyDataBuilder(this.currentGrid, this.options)
      });
    } catch (error) {
      console.error('Error updating wind data:', error);
    } finally {
      this.isUpdating = false;
    }
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

  async getCurrentData() {
    return this.setDateType('current');
  }

  async getForecastData(start_date, end_date) {
    return this.setDateType('forecast', { start_date, end_date });
  }

  async getHourlyForecast(start_date, end_date, hour_index) {
    return this.setDateType('forecast_hourly', { 
      start_date, 
      end_date, 
      hour_index 
    });
  }

  setWindyParameters(parameters) {
    console.log("######## setWindyParameters ########", parameters);
    this.options.windyParameters = { ...this.options.windyParameters, ...parameters };
    if (this.velocityLayer) {console.log("Seteando parametros de windy");
      this.velocityLayer.setOptions(this.options.windyParameters);
    }
  }

  setDateType(dateType, options = {}) {
    this.options.dateType = dateType;
    
    if (dateType === 'forecast' || dateType === 'forecast_hourly') {
      this.options.start_date = options.start_date || null;
      this.options.end_date = options.end_date || null;
      this.options.hour_index = options.hour_index || null;
    } else {
      this.options.start_date = null;
      this.options.end_date = null;
      this.options.hour_index = null;
    }

    return this.forceUpdate();
  }

  showWeatherPopup(lat, lng) {
    // Genera la clave para buscar el objeto en gridPointsMap
    const pointKey = generatePointKey(lat, lng);
    
    // Busca el gridPoint en el diccionario
    const gridPoint = this.currentGrid.gridPointsMap.get(pointKey);
    
    if (!gridPoint) {
      console.error("No se encontró información meteorológica para la coordenada dada.");
      return;
    }
    
    // Extraer los datos meteorológicos del objeto
    const { temperature, wind, timestamp } = gridPoint.weatherData;
    
    // Construir el contenido HTML para el popup
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
    
    // Crear y abrir el popup en el mapa
    L.popup({
      closeOnClick: false, // Evita que se cierre al hacer clic en el mapa
      autoClose: false,    // Permite mantener abierto el popup)
    }).setLatLng([lat, lng])
      .setContent(popupContent)
      .openOn(this.map);
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
  console.log("Generando datos aleatorios con mayor varianza");
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

// Convertir dirección del viento a componentes u y v
function convertWindDirection(speed, direction) {
  const rad = direction * (Math.PI / 180);

  // El signo es negativo porque la direccion del viento indica de donde viene
  const u = - speed * Math.sin(rad); // Componente U (este-oeste)
  const v = - speed * Math.cos(rad); // Componente V (norte-sur)
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

// Obtener las coordenadas de los límites del mapa que sean multiplos de MULTIPLE
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
  /*if(dateType == 'forecast_hourly') {
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
  } else console.error("Unrecognized data type");
  */

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
 * Ajusta una coordenada al múltiplo más cercano de gridStep.
 *
 * @param {number} coord - La coordenada a ajustar.
 * @param {number} gridStep - El paso de la grilla, por defecto 0.0625.
 * @returns {number} - La coordenada ajustada.
 */
function adjustToGrid(coord, gridStep = 0.0625) {
  return Math.round(coord / gridStep) * gridStep;
}

/**
 * Genera una clave única a partir de latitud y longitud,
 * asegurando que se usen 6 decimales en el string.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {string} - Clave en formato "latitud_longitud".
 */
function generatePointKey(latitude, longitude, decimals = 4) {
  return `${latitude.toFixed(decimals)}_${longitude.toFixed(decimals)}`;
}

/**
 * Genera una clave única basada en la fecha en formato aaaa-mm-dd.
 *
 * @param {Date} date - La fecha para generar la clave.
 * @returns {string} - Clave en formato "aaaa-mm-dd".
 */
function generateDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Construye un lookup (diccionario) a partir del array de GridPoint.
 *
 * @param {Array} points - Array de objetos GridPoint.
 * @returns {Map} - Map con claves generadas a partir de las coordenadas.
 */
function buildPointsLookup(points) {
  const lookup = new Map();
  points.forEach(point => {
    const key = generatePointKey(point.latitude, point.longitude);
    lookup.set(key, point);
  });
  return lookup;
}

/**
 * Actualiza los GridPoint con los datos del clima obtenidos de la API.
 * Se ajustan las coordenadas de weatherData al grid antes de generar la llave.
 *
 * @param {Array} results - Resultados de la API.
 * @param {Array} points - Array de GridPoint.
 * @param {Map} pointsLookup - Mapa de GridPoint indexados por su llave.
 * @param {string} dateType - Tipo de fecha para el parseo.
 */
function setDataFromOpenMeteo(results, points, pointsLookup, dateType) {
  results.forEach(({ data, batchIndex }) => {
    data.forEach((weatherData, index) => {
      /* // Usamos las llaves generadas para buscar el GridPoint correspondiente
      // Extraemos las coordenadas "crudas"
      const { latitude: rawLat, longitude: rawLon } = weatherData;
      // Ajustamos las coordenadas al múltiplo de grid (ej.: 0.0625)
      const latitude = adjustToGrid(rawLat, 0.0625);
      const longitude = adjustToGrid(rawLon, 0.0625);
      // Generamos la llave con 6 decimales
      const key = generatePointKey(latitude, longitude);
      const point = pointsLookup.get(key);
      if (point) {
        point.setWeatherData(parseOpenMeteo(weatherData, { timeType: dateType }));
      } else {
        console.warn(`No se encontró un GridPoint para las coordenadas ${key}`);
      }
      */
      // Implementación más sencilla
      let point = points[batchIndex * 100 + index];
      point.setWeatherData(parseOpenMeteo(weatherData, { timeType: dateType }));
    });
  });
}

/**
 * Los puntos de coordenadas de Open-Meteo son multiplos de .0625 (Si mandamos uno distinto los redondea)
 * Se actualizan cada hora y cuarto
 * latitudes, longitudes, nx, ny
 */
async function fetchWeatherData(grid, options, API = 'OpenMeteo') {
  const points = grid.grid || grid; // Use grid.grid if it exists, otherwise use grid directly
  if (options.randomData) {
    generateRandomGridData(points);
    return;
  }

  const fetchPromises = []; // Array to store all fetch promises
  
  // Agrupar los puntos en lotes de batchSize coordenadas por llamada
  const batchSize = 100;
  for (let i = 0; i < points.length; i += batchSize) {
    const batchPoints = points.slice(i, i + batchSize);
    const url = buildWeatherURL(API, batchPoints, options.dateType, options.start_date, options.end_date);
    console.log("url", url); //return;
    fetchPromises.push(
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          return response.json();
        })
        .then(data => ({ data, batchIndex: i / batchSize }))
    );
  }

  try {
    const results = await Promise.all(fetchPromises); console.log("API results", results);
    
    const pointsLookup = buildPointsLookup(points);

    if (API === 'OpenMeteo') setDataFromOpenMeteo(results, points, pointsLookup, options.dateType);
    else if (API === 'MeteoSIX') setDataFromMeteoSIX(results, points, nx);
  } catch (error) {
    console.error('Fetching weather data failed:', error);
    throw error;
  }
}

// Helper function to build weather API URL
function buildWeatherURL(API, points, dateType, start_date, end_date) {
  let url = '';
  if (API === 'OpenMeteo') {
    const latParams = points.map(p => p.latitude).join(',');
    const lonParams = points.map(p => p.longitude).join(',');
    const baseUrl = 'https://api.open-meteo.com/v1/forecast';
    switch (dateType) {
      case 'current':
        url = `${baseUrl}?latitude=${latParams}&longitude=${lonParams}&current=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation&wind_speed_unit=ms`;
        break;
      case 'forecast':
        url = `${baseUrl}?latitude=${latParams}&longitude=${lonParams}&start_date=${start_date}&end_date=${end_date}&daily=wind_speed_10m_max,wind_direction_10m_dominant&wind_speed_unit=ms`;
        break;
      case 'forecast_hourly':
        url = `${baseUrl}?latitude=${latParams}&longitude=${lonParams}&start_date=${start_date}&end_date=${end_date}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`;
        break;
      default:
        throw new Error('Invalid date type');
    }
  } else if (API === 'MeteoSIX') {
    const coords = points.map(p => `${p.longitude},${p.latitude}`).join(';');
    const baseUrl = 'https://servizos.meteogalicia.gal/apiv4/getNumericForecastInfo';
    switch (dateType) {
      case 'current':
        url = `${baseUrl}?coords=${coords}&variables=temperature,wind&API_KEY=219XBzNU7vG87JnRXaDq6uh35DbheXH1tAx72B6ElfPoVe7S6mqWUKzSQkJuqcLl`;
        break;
      case 'forecast': //por probar
        url = `${baseUrl}?coords=${coords}&startTime=${start_date}&endTime=${end_date}&variables=temperature,wind`;
        break;
      default:
        throw new Error('Invalid date type for MeteoSIX');
    }
  }
  return url;
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

function gridBuilder(map, pointDistance, gridLimits, gridPointsMap) {//gridLimits=mapBounds => _northEast y _southWest
  console.log("northWest", gridLimits.getNorthWest()); L.marker(gridLimits.getNorthWest()).addTo(map);
  console.log("northEast", gridLimits.getNorthEast()); L.marker(gridLimits.getNorthEast()).addTo(map);
  console.log("southWest", gridLimits.getSouthWest()); L.marker(gridLimits.getSouthWest()).addTo(map);
  console.log("southEast", gridLimits.getSouthEast()); L.marker(gridLimits.getSouthEast()).addTo(map);

  // Datos para la cuadricula
  const { nx, ny, dx, dy } = calculateGridParameters(gridLimits, pointDistance);
  console.log("nx:", nx, "ny:", ny, "dx:", dx, "dy:", dy);

  // Generar las coordenadas de los puntos
  const points = [];
  let count = 0, count1 = 0;
  console.log(gridPointsMap)
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
  console.log("Puntos generados:", count);
  console.log("Puntos obviados:", count1 - count);

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

function DrawWindData({ map, layerControl, velocityLayer = null, windyData, windyParameters = {} }) {
  if (velocityLayer) {
    velocityLayer.setOptions(windyParameters); // Actualizar los parámetros de la capa existente
    velocityLayer.setData(windyData); // Actualizar los datos de la capa existente
  } else {
    // Crear una nueva capa si no existe
    velocityLayer = L.velocityLayer({
      displayValues: true,
      displayOptions: {
        velocityType: "Global Wind",
        emptyString: "No velocity data"
      },
      // windy parameters
      data: windyData,
      maxVelocity: windyParameters.maxVelocity || 10,
      minVelocity: windyParameters.minVelocity || 0,
      velocityScale: windyParameters.velocityScale || 0.005,
      particleAge: windyParameters.particleAge || 90,
      lineWidth: windyParameters.lineWidth || 1,
      particleMultiplier: windyParameters.particleMultiplier || 1 / 300,
      frameRate: windyParameters.frameRate || 15,
    });

    layerControl.addOverlay(velocityLayer, "Wind Layer"); // Añadir la capa
    velocityLayer.setOptions(windyParameters);
    velocityLayer.addTo(map); // Mostrar la capa
    map.addLayer(velocityLayer); // Añadirla al campo de control
  }
  //map.setZoom(map.getZoom() - 1); // Ajustar el zoom para que se vea la capa

  // Retornar la capa para poder actualizarla
  return velocityLayer;
}

export function updateWindyParameters(velocityLayer = null, windyParameters) {
  if (velocityLayer) velocityLayer.setOptions(windyParameters);
}