export class MapManager {
  constructor(mapId, options = {}) {
    this.map = null;
    this.velocityLayer = null;
    this.layerControl = null;
    this.isUpdating = false;
    this.lastZoom = null;
    this.updateTimeout = null;
    this.currentGrid = {
      bounds: null,
      gridPoints: { latitudes: [], longitudes: [] },
      dx: null,
      dy: null,
      nx: null,
      ny: null,
      windData: []
    };    
    this.options = {
      center: options.center || [42.8, -8],
      zoom: options.zoom || 8,
      minZoom: options.minZoom || 3,
      maxZoom: options.maxZoom || 18,
      updateDelay: options.updateDelay || 500,
      pointDistance:  options.pointDistance !== undefined
                      ? options.pointDistance
                      : this.getPointDistanceFromZoom(options.zoom),
      mapAdjustment: options.mapAdjustment || 0,
      windyParameters: options.windyParameters || this.getDefaultWindyParameters(),
      dateType: options.dateType || 'current',
      start_date: options.start_date || null,
      end_date: options.end_date || null,
      hour_index: options.hour_index || null
    };
    
    this.initialize(mapId);
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

  getPointDistanceFromZoom(zoom) {
    console.log("getPointDistanceFromZoom", zoom);
    if (zoom <= 7) return 1;
    else if (zoom > 7 && zoom <= 8) return 0.5;
    else if (zoom > 8 && zoom <= 9) return 0.25;
    else if (zoom > 9 && zoom < 11) return 0.125;
    else return 0.0625;
  }

  initialize(mapId) {
    this.map = L.map(mapId, {
        center: this.options.center,
        zoom: this.options.zoom
    });

    // Add base layers
    this.setupBaseLayers();
    
    // Setup grid parameters
    this.currentGrid = gridBuilder.call(this, this.options.pointDistance, this.options.mapAdjustment);
    console.log("currentGrid", this.currentGrid);

    // Initialize event handlers
    //this.initializeEventHandlers();
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
      'googleSatellite': L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'),
      'pnoa2022': L.tileLayer.wms('https://www.ign.es/wms/pnoa-historico'),
    }).addTo(this.map);

    cartoDbDark.addTo(this.map);
  }

  destroy(){
    // Remover la capa de viento, si existe
    if (this.velocityLayer) {
      this.map.removeLayer(this.velocityLayer);
      this.velocityLayer = null;
    }
  
    // Remover el control de capas, si existe
    if (this.layerControl) {
      this.map.removeControl(this.layerControl);
      this.layerControl = null;
    }
  
    // Cancelar cualquier actualización pendiente
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
    const debouncedUpdate = this.debounce(() => {
        this.updateWindData();
      }, this.options.updateDelay
    );

    // Zoom events with grid management
    this.map.on('zoomend', () => {
      const currentZoom = this.map.getZoom();
      if (this.lastZoom !== currentZoom) {
        this.pointDistance = this.getPointDistanceFromZoom(currentZoom);
        debouncedUpdate();
      }
      this.lastZoom = currentZoom;
    });

    // Pan events
    this.map.on('moveend', () => {
      if (!this.map.isZooming()) {
        debouncedUpdate();
      }
    });
  }

  forceUpdate() {
    this.updateWindData();
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

  async updateWindData(dateOptions = {}) {
    console.log("updateWindData", dateOptions);
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      //const mapBounds = getMapBoundsCoordinates(this.map, this.options.mapAdjustment);
      const oldGrid = this.currentGrid;
      //const pointDistance = this.options.pointDistance;

      if (oldGrid.windData) {
        this.currentGrid = gridBuilder.call(this, this.options.pointDistance, this.options.mapAdjustment);
        console.log("currentGrid", this.currentGrid);
        this.currentGrid.windData = await fetchWeatherData(this.currentGrid, this.options.dateType, this.options.start_date, this.options.end_date);

        this.velocityLayer = DrawWindData({
          map: this.map,
          layerControl: this.layerControl,
          velocityLayer: this.velocityLayer,
          windyParameters: this.options.windyParameters,
          windyData: windyDataBuilder(this.currentGrid.windData, this.currentGrid.nx, this.currentGrid.ny, this.currentGrid.dx, this.currentGrid.dy, this.currentGrid.bounds, this.options.dateType, this.options.hour_index)
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
        this.currentGrid.windData = await fetchWeatherData(this.currentGrid, this.options.dateType, this.options.start_date, this.options.end_date);

        this.velocityLayer = DrawWindData({
          map: this.map,
          layerControl: this.layerControl,
          velocityLayer: this.velocityLayer,
          windyParameters: this.options.windyParameters,
          windyData: windyDataBuilder(this.currentGrid.windData, this.currentGrid.nx, this.currentGrid.ny, this.currentGrid.dx, this.currentGrid.dy, this.currentGrid.bounds, this.options.dateType, this.options.hour_index)
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
  const southWest = map.unproject(bounds.getBottomLeft(), zoomLevel);//L.marker(southWest).addTo(map);
  const northEast = map.unproject(bounds.getTopRight(), zoomLevel);//L.marker(northEast).addTo(map);
  
  return L.latLngBounds(southWest, northEast);
}

// Obtener las coordenadas de los límites del mapa
function getMapBoundsCoordinates(map, adjustment = 0) {
  const bounds =  map.getZoom() >= 11
                  ? getBoundsAtZoom(map, 11)
                  : map.getBounds();
  const southWest = bounds.getSouthWest();//L.marker(southWest).addTo(map);
  const northEast = bounds.getNorthEast();//L.marker(northEast).addTo(map);
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
function windyDataBuilder(data, nx, ny, dx, dy, boundaries, dateType = 'current', hour_index) {
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

  console.log(windData); //console.log("windData", JSON.stringify(windData, null, 2));
  return windData;
}

/**
 * Los puntos de latitud de la API son multiplos de .0625 (Si mandamos uno distinto los redondea)
 * Se actualizan cada hora y cuarto
 * latitudes, longitudes, nx, ny
 */
async function fetchWeatherData(grid, dateType = 'current', start_date = null, end_date = null) {
  const { latitudes, longitudes } = grid.gridPoints;
  const nx = grid.nx, ny = grid.ny;

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

// Generar las coordenadas de los puntos
function generateGridCoordinates(map, bounds, nx, ny, dx, dy) {
  const longitudes = [], latitudes = [];

  for (let i=0;i<ny;i++) latitudes.push(bounds.northWest.lat - i * dy);
  for (let j=0;j<nx;j++) longitudes.push(bounds.northWest.lng + j * dx);

  return { latitudes, longitudes };
}

function gridBuilder(pointDistance, adjustment) {
  // Obtener los límites del mapa
  const gridLimits = getMapBoundsCoordinates(this.map, adjustment);

  console.log("northWest", gridLimits.northWest);
  console.log("northEast", gridLimits.northEast);
  console.log("southWest", gridLimits.southWest);
  console.log("southEast", gridLimits.southEast);

  // Datos para la cuadricula
  const { nx, ny, dx, dy } = calculateGridParameters(gridLimits, pointDistance);

  console.log("nx:", nx, "ny:", ny, "dx:", dx, "dy:", dy);

  // Generar las coordenadas de los puntos
  const { latitudes, longitudes } = generateGridCoordinates(this.map, gridLimits, nx, ny, dx, dy);

  return {
    bounds: gridLimits,
    gridPoints: { latitudes: latitudes, longitudes: longitudes },
    dx: dx,
    dy: dy,
    nx: nx,
    ny: ny,
  }
}

// Primera implementación, pero solo sirve para hallar '4 rectas', no para el resto
function getNewGridPoints(oldBounds, newBounds, dx, dy) {
  // Calcular los nuevos extremos en base a newBounds pero que sean multiplos de dx y dy
  let newNorthWest, newNorthEast, newSouthWest, newSouthEast;

  const newPoints = {
      latitudes: [],
      longitudes: []
  };

  // Si hay nuevos puntos al norte
  for (let lat = oldBounds.northWest.lat + dy; lat <= newBounds.northWest.lat; lat += dy) {
      newPoints.latitudes.push(lat);
  }

  // Si hay nuevos puntos al sur
  for (let lat = oldBounds.southWest.lat - dy; lat >= newBounds.southWest.lat; lat -= dy) {
      newPoints.latitudes.push(lat);
  }

  // Si hay nuevos puntos al este
  for (let lon = oldBounds.northEast.lng + dx; lon <= newBounds.northEast.lng; lon += dx) {
      newPoints.longitudes.push(lon);
  }

  // Si hay nuevos puntos al oeste
  for (let lon = oldBounds.northWest.lng - dx; lon >= newBounds.northWest.lng; lon -= dx) {
      newPoints.longitudes.push(lon);
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