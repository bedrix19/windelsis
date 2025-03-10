import { parseOpenMeteo, parseMeteoSIX } from "./apiService.js";

export class MapManager {
  constructor(mapId, options = {}) {
    this.map = null;
    this.heatmapLayer = null;
    this.velocityLayer = null;
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
    this.options = {
      randomData: options.randomData || true,
      center: options.center || [42.8, -8],
      zoom: options.zoom || 8,
      minZoom: options.minZoom || 3,
      maxZoom: options.maxZoom || 18,
      updateDelay: options.updateDelay || 500,
      pointDistance:  options.pointDistance || null,
      maxGridPoints: options.maxGridPoints || 1000,
      mapAdjustment: options.mapAdjustment || 0,
      windyParameters: options.windyParameters || this.getDefaultWindyParameters(),
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
    const bounds = L.latLngBounds(mapBounds.southWest, mapBounds.northEast);
    this.options.pointDistance =  this.options.pointDistance !== null
                                  ? this.options.pointDistance
                                  : this.getPointDistanceFromBounds(bounds);
    this.currentGrid = gridBuilder(this.map, this.options.pointDistance, mapBounds);
    console.log("currentGrid", this.currentGrid);

    // Initialize event handlers
    this.initializeEventHandlers();

  }

  getDefaultWindyParameters() {
    return {
      maxVelocity: 10,
      minVelocity: 0,
      velocityScale: 0.005,
      particleAge: 90,
      lineWidth: 1,
      particleMultiplier: 1/300,
      frameRate: 15
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

  getTemperatureAt(lat, lng) {
    const { grid, dx, dy, nx, ny } = this.currentGrid;
  
    // Encontrar los índices de la celda
    const i = Math.floor((this.currentGrid.bounds.northWest.lat - lat) / dy);
    const j = Math.floor((lng - this.currentGrid.bounds.southWest.lng) / dx);
  
    if (i < 0 || i >= ny - 1 || j < 0 || j >= nx - 1) {
      throw new Error('Coordenadas fuera de los límites de la cuadrícula');
    }
  
    const p1 = grid[i * nx + j];            // inferior izquierda (Q11)
    const p2 = grid[i * nx + (j + 1)];      // inferior derecha (Q21)
    const p3 = grid[(i + 1) * nx + j];      // superior izquierda (Q12)
    const p4 = grid[(i + 1) * nx + (j + 1)];// superior derecha (Q22)
    console.log("p1", p1, "p2", p2, "p3", p3, "p4", p4);

    // Coordenadas para la interpolación
    const x1 = p1.longitude;
    const x2 = p2.longitude;
    const y1 = p1.latitude;
    const y2 = p3.latitude;
    // Dibujar el area de interpolación
    L.rectangle([[y1, x1], [y2, x2]], { color: 'red', weight: 1 }).addTo(this.map);
  
    // Extraer los valores numéricos a interpolar (por ejemplo, la temperatura)
    const fQ11 = p1.weatherData.temperature;
    const fQ21 = p2.weatherData.temperature;
    const fQ12 = p3.weatherData.temperature;
    const fQ22 = p4.weatherData.temperature;
  
    // Interpolación bilineal
    const R1 = ((x2 - lng) / (x2 - x1)) * fQ11 + ((lng - x1) / (x2 - x1)) * fQ21;
    const R2 = ((x2 - lng) / (x2 - x1)) * fQ12 + ((lng - x1) / (x2 - x1)) * fQ22;
    const P  = ((y2 - lat) / (y2 - y1)) * R1 + ((lat - y1) / (y2 - y1)) * R2;
  
    return P;
  }

  setupBaseLayers() {
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    const Esri_WorldImagery = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
    const Esri_DarkGreyCanvas = L.tileLayer('http://{s}.sm.mapstack.stamen.com/toner-lite,$fff[difference],$fff[@23],$fff[hsl-saturation@20])/{z}/{x}/{y}.png');
    const cartoDbDark = L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png')

    this.layerControl = L.control.layers({
      Satellite: Esri_WorldImagery,
      'Grey Canvas': Esri_DarkGreyCanvas,
      'OpenStreetMap': osm,
      'Carto Db Dark': cartoDbDark,
      'cartoDbLight': L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'),
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

  initializeEventHandlers() {
    console.log("######## initializeEventHandlers ########");
    /*Estas lineas hacen que el mapa funcione mal
    const debouncedUpdate = this.debounce(() => {
        this.updateWindData();
      }, this.options.updateDelay
    );

    // Zoom events with grid management
    this.map.on('zoomend', () => {
      const currentZoom = this.map.getZoom();
      if (this.lastZoom !== currentZoom) {
        this.pointDistance = this.getPointDistanceFromZoom(currentZoom);
        //debouncedUpdate();
      }
      this.lastZoom = currentZoom;
    });

    // Pan events
    this.map.on('moveend', () => {
      if (!this.map.isZooming()) {
        //debouncedUpdate();
      }
    });
    */
    this.map.on('zoomend moveend', () => {
      var mapBounds = this.map.getBounds();
      const gridBounds = L.latLngBounds(this.currentGrid.bounds.southWest, this.currentGrid.bounds.northEast);
        // Comprobamos que ambos extremos, el noreste y el suroeste, estén contenidos en areaBounds.
        if (  gridBounds.contains(mapBounds.getNorthEast()) &&
              gridBounds.contains(mapBounds.getSouthWest()) ) {
          console.log("El área visible del mapa ESTÁ completamente dentro del área definida.");
        } else {
          console.log("El área visible del mapa NO está completamente dentro del área definida.");
          // obtener los puntos que faltan
          const mapBounds = getMapBoundsCoordinates(this.map, this.options.mapAdjustment);
          console.log("mapBounds", mapBounds);
          console.log(this.map.getBounds());
          // construir los bounds como si fuesen de leaflet
          const bounds = L.latLngBounds(mapBounds.southWest, mapBounds.northEast);
          console.log("bounds", bounds);
          const pointDistance = this.getPointDistanceFromBounds(bounds);
          console.log("pointDistance", pointDistance);
          const missingPoints = getNewGridPoints(this.currentGrid, mapBounds, pointDistance, pointDistance);
          console.log("Nuevos puntos:", missingPoints);
          console.log("Puntos existentes:", this.currentGrid.grid);
          // obtenemos los datos de los nuevos puntos y los juntamos con los existentes en una matriz ordenada de noroeste a sureste
          // POR IMPLEMENTAR
        }
    });

    this.map.on('click', (e) => {
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
      var popup = L.popup({
        closeOnClick: false, // Evita que se cierre al hacer clic en el mapa
        autoClose: false,    // Permite mantener abierto el popup
        className: 'mi-popup-personalizado' // Clase personalizada para CSS
      })
      .setLatLng(e.latlng)
      .setContent('<b>Coordenadas:</b><br>Lat: ' + lat.toFixed(5) + '<br>Lng: ' + lng.toFixed(5) + '<br><b>Temperatura:</b> ' + this.getTemperatureAt(lat, lng).toFixed(2) + '°C')
      .openOn(this.map);
    });
  }

  forceUpdate() {
    this.updateWindData().then(() => {
      this.updateTemperatureData();
    });
  }

  debounce(func, wait) {
      return () => {
        if (this.updateTimeout) {
          clearTimeout(this.updateTimeout);
        }
        this.updateTimeout = setTimeout(() => {
          func.apply(this);
        }, wait);
      };
  }


  async updateWeatherData(){
    // Logica para actualizar la grilla de datos meteorológicos
  }

  async updateTemperatureData() {
    console.log("######## updateTemperatureData ########");return
    try {
      // Remove existing heatmap layer if it exists
      if (this.heatmapLayer) {
        this.map.removeLayer(this.heatmapLayer);
      }
  
      // Prepare data points for heat layer
      const heatPoints = this.currentGrid.grid.map(point => {
        return [
          point.latitude,
          point.longitude,
          point.weatherData.temperature
        ];
      });
  
      // Configure heat layer
      this.heatmapLayer = L.heatLayer(heatPoints, {
        radius: 50,
        blur: 15,
        maxZoom: 18,
        max: 40, // maximum temperature to normalize colors
        minOpacity: 0.3,
        gradient: {
          0.0: 'blue',    // Cold temperatures
          0.25: 'cyan',
          0.5: 'lime',
          0.75: 'yellow',
          1.0: 'red'      // Hot temperatures
        }
      });
  
      // Add layer to map and layer control
      this.layerControl.addOverlay(this.heatmapLayer, "Temperature Heatmap");
      this.heatmapLayer.addTo(this.map);
  
    } catch(error) {
      console.error('Error updating temperature data:', error);
    }
  }

  async updateWindData(dateOptions = {}) {
    console.log("######## updateWindData ########", dateOptions);
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      //const mapBounds = getMapBoundsCoordinates(this.map, this.options.mapAdjustment);
      const oldGrid = this.currentGrid.grid;
      //const pointDistance = this.options.pointDistance;

      if (oldGrid !== undefined) {
        this.currentGrid = gridBuilder(this.map, this.options.pointDistance, this.options.mapAdjustment);
        console.log("oldGrid.windData", this.currentGrid);
        this.currentGrid.windData = await fetchWeatherData(this.currentGrid, this.options);

        this.velocityLayer = DrawWindData({
          map: this.map,
          layerControl: this.layerControl,
          velocityLayer: this.velocityLayer,
          windyParameters: this.options.windyParameters,
          windyData: windyDataBuilder(this.currentGrid, this.options)
        });
        /*
        //Generar nuevos puntos que no estaban en la cuadrícula anterior
        const { latitudes, longitudes } = getNewGridPoints(oldGrid.bounds, mapBounds, pointDistance, pointDistance);

        if (latitudes.length === 0 && longitudes.length === 0) {
          console.log("No hay nuevos puntos, evitando petición innecesaria.");
          this.isUpdating = false;
          return;
        }

        //Hacer petición solo para los nuevos puntos
        const newData = await fetchWeatherData(latitudes, longitudes, latitudes.length, longitudes.length, this.options.dateType);

        //Fusionar los datos nuevos con los existentes
        this.currentGrid.windData = mergeWindData(this.currentGrid.windData, newData, oldGrid.bounds, mapBounds);
        this.currentGrid.bounds = mapBounds;

        //Actualizar capa sin reemplazarla completamente
        if (this.velocityLayer) {
          this.velocityLayer.setData(this.currentGrid.windData);
        } else {
          this.velocityLayer = L.velocityLayer({
            displayValues: true,
            data: this.currentGrid.windData,
            maxVelocity: this.options.windyParameters.maxVelocity,
          }).addTo(this.map);
        }
        */
      }else{
        console.log("Primera carga de datos");
        if(!this.options.randomData) {
          this.currentGrid.grid = await fetchWeatherData(this.currentGrid, this.options);console.log("currentGrid", this.currentGrid);
        } else {
          this.setRandomGridData();
        }

        this.velocityLayer = DrawWindData({
          map: this.map,
          layerControl: this.layerControl,
          velocityLayer: this.velocityLayer,
          windyParameters: this.options.windyParameters,
          windyData: windyDataBuilder(this.currentGrid, this.options)
        });
      }
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

  setRandomGridData() {
    console.log("Generando datos aleatorios uniformes");
    const baseTemperature = (Math.random() * 10) + 15;
    const baseWindSpeed = (Math.random() * 5) + 15;
    const baseWindDirection = Math.random() * 360;

    this.currentGrid.points.forEach(point => {
      const randomTemperature = (baseTemperature + (Math.random() * 2 - 5)).toFixed(2);
      const randomWindSpeed = (baseWindSpeed + (Math.random() * 2 - 10)).toFixed(2);
      const randomWindDirection = (baseWindDirection + (Math.random() * 10 - 90)).toFixed(2);

      point.setWeatherData({
        weather_units: {
        temperature: '°C',
        wind_speed: 'm/s',
        wind_direction: '°'
        },
        temperature: parseFloat(randomTemperature),
        wind: {
        speed: parseFloat(randomWindSpeed),
        direction: parseFloat(randomWindDirection)
        },
        timestamp: new Date().toISOString(), // Format: 2025-02-24T09:19:57.000Z
        rawData: null
      });
    });
    console.log("currentGrid random data", this.currentGrid);
    this.currentGrid.grid = this.currentGrid.points;
  }

  setWindyParameters(parameters) {
    this.options.windyParameters = { ...this.options.windyParameters, ...parameters };
    if (this.velocityLayer) {
        this.velocityLayer.setOptions(this.options.windyParameters);
    }
  }

  setPointDistance(distance) {
    this.options.pointDistance = distance;
    this.forceUpdate();
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
        wind_direction: '°'
      },
      temperature: null,
      wind: {
        speed: null,
        direction: null,
      },
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

  getWindComponents() {
    if (!this.weatherData?.wind) return null;

    return convertWindDirection(
      this.weatherData.wind.speed,
      this.weatherData.wind.direction
    );
  }

  convertSpeed(speed, unit) {
    return unit === 'km/h' ? speed * 0.27778 : speed;
  }

  getTemperature() {
    return this.weatherData.temperature;
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
  }

  // If all distances would exceed maxPoints, return the largest distance
  console.log(`Using maximum distance: 1° due to area size`);
  return possibleDistances[possibleDistances.length - 1];
}

// Obtener las coordenadas de los límites del mapa que sean multiplos de MULTIPLE
function getMapBoundsCoordinates(map, adjustment = 0) {
  const MULTIPLE = 0.25;
  const bounds =  map.getBounds();
  const southWest = bounds.getSouthWest();                  //L.marker(southWest).addTo(map);
  const northEast = bounds.getNorthEast();                  //L.marker(northEast).addTo(map);
  const northWest = L.latLng(northEast.lat, southWest.lng); //L.marker(northWest).addTo(map);
  const southEast = L.latLng(southWest.lat, northEast.lng); //L.marker(southEast).addTo(map);

  console.log("Puntos de los límites del mapa\nNW:", northWest," NE:", northEast," SW:", southWest," SE:", southEast);

  function roundToMultiple(value, multiple, roundUp) {
    return roundUp
      ? Math.ceil(value / multiple) * multiple
      : Math.floor(value / multiple) * multiple;
  }

  return {
    northWest: L.latLng(
      roundToMultiple(northWest.lat, MULTIPLE, true) + adjustment,
      roundToMultiple(northWest.lng, MULTIPLE, false) - adjustment
    ),
    northEast: L.latLng(
      roundToMultiple(northEast.lat, MULTIPLE, true) + adjustment,
      roundToMultiple(northEast.lng, MULTIPLE, true) + adjustment
    ),
    southWest: L.latLng(
      roundToMultiple(southWest.lat, MULTIPLE, false) - adjustment,
      roundToMultiple(southWest.lng, MULTIPLE, false) - adjustment
    ),
    southEast: L.latLng(
      roundToMultiple(southEast.lat, MULTIPLE, false) - adjustment,
      roundToMultiple(southEast.lng, MULTIPLE, true) + adjustment
    )
  };
}

// Logica para contrsuir el array para heatmap
function heatmapDataBuilder(grid){
  var tempData = [];
  var maxTemp = 0;
  for (let i = 0; i < grid.length; i++) {
    const point = grid[i];
    if(point.weatherData.temperature > maxTemp) maxTemp = point.weatherData.temperature;
    tempData.push({
      lat: point.latitude,
      lng: point.longitude,
      count: point.weatherData.temperature
    });
  }
  maxTemp = maxTemp > 40 ? maxTemp : 40;
  return {max: maxTemp, data: tempData};
}

// Logica para construir el json para usar con leaflet-velocity
function windyDataBuilder(currentGrid, options) {
  const { bounds, grid, dx, dy, nx, ny } = currentGrid;
  const dateType = options.dateType;
  const hour_index = options.hour_index;

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
        lo1: bounds.northWest.lng,
        lo2: bounds.southEast.lng,
        la1: bounds.northWest.lat,
        la2: bounds.southEast.lat,
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
        lo1: bounds.northWest.lng,
        lo2: bounds.southEast.lng,
        la1: bounds.northWest.lat,
        la2: bounds.southEast.lat,
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
  const { points, nx, ny } = grid;
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

    return points;
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
        url = `${baseUrl}?latitude=${latParams}&longitude=${lonParams}&current=temperature_2m,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`;
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

function gridBuilder(map, pointDistance, gridLimits) {
  console.log("northWest", gridLimits.northWest); L.marker(gridLimits.northWest).addTo(map);
  console.log("northEast", gridLimits.northEast); L.marker(gridLimits.northEast).addTo(map);
  console.log("southWest", gridLimits.southWest); L.marker(gridLimits.southWest).addTo(map);
  console.log("southEast", gridLimits.southEast); L.marker(gridLimits.southEast).addTo(map);

  // Mapa de GridPoints
  const gridPointsMap = new Map();

  // Datos para la cuadricula
  const { nx, ny, dx, dy } = calculateGridParameters(gridLimits, pointDistance);
  console.log("nx:", nx, "ny:", ny, "dx:", dx, "dy:", dy);

  // Generar las coordenadas de los puntos
  const points = [];
  for (let i = 0; i < ny; i++) {
    const latitude = gridLimits.northWest.lat - i * dy;
    for (let j = 0; j < nx; j++) {
      const longitude = gridLimits.northWest.lng + j * dx;
      const gp = new GridPoint(latitude, longitude);
      points.push(gp);
      gridPointsMap.set(gp.id, gp);
    }
  }

  return {
    bounds: gridLimits,
    points: points,
    gridPointsMap: gridPointsMap,
    dx: dx,
    dy: dy,
    nx: nx,
    ny: ny,
  }
}

// Primera implementación, pero solo sirve para hallar '4 rectas', no para el resto
function getNewGridPoints(oldGrid, newBounds, dx, dy) {
  const newPoints = [];

  // Crear un set para almacenar las claves de los puntos existentes
  const existingPoints = new Set();
  let count = 0;
  oldGrid.grid.forEach(point => {
    existingPoints.add(generatePointKey(point.latitude, point.longitude));
    count++;
  });
  console.log("Puntos obviados", count);

  // Función para agregar nuevos puntos si no existen en el set
  function addNewPoint(lat, lon) {
    const key = generatePointKey(lat, lon);
    if (!existingPoints.has(key)) {
      newPoints.push(new GridPoint(lat, lon));
    }
  }

  // Generar nuevos puntos de noroeste a sureste
  for (let lat = newBounds.northWest.lat; lat >= newBounds.southEast.lat; lat -= dy) {
    for (let lon = newBounds.northWest.lng; lon <= newBounds.southEast.lng; lon += dx) {
      addNewPoint(lat, lon);
    }
  }

  return newPoints;
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

    layerControl.addOverlay(velocityLayer, "API Wind Data"); // Añadir la capa
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