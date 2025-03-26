export async function openMeteoApiCaller(points, options) {
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
        url = `${baseUrl}?latitude=${latParams}&longitude=${lonParams}` +
              `&current=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation` +
              `&wind_speed_unit=ms`;
        break;
      case 'forecast':
        url = `${baseUrl}?latitude=${latParams}&longitude=${lonParams}` +
              `&start_date=${options.start_date}&end_date=${options.end_date}` +
              `&daily=wind_speed_10m_max,wind_direction_10m_dominant` +
              `&wind_speed_unit=ms`;
        break;
      case 'forecast_hourly':
        url = `${baseUrl}?latitude=${latParams}&longitude=${lonParams}` +
              `&start_date=${options.start_date}&end_date=${options.end_date}` +
              `&hourly=wind_speed_10m,wind_direction_10m` +
              `&wind_speed_unit=ms`;
        break;
      default:
        throw new Error('Invalid date type');
    }
    console.log("Calling URL:", url);

    promises.push(
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          return response.json();
        })
        .then(data => ({ data, startIndex: i }))
    );
  }

  const results = await Promise.all(promises);
  results.forEach(({ data, startIndex }) => {
    const weatherDataArray = Array.isArray(data) ? data : [data];
    weatherDataArray.forEach((weatherData, index) => {
      standardizedDataArray[startIndex + index] = parseOpenMeteo(weatherData, { timeType: options.dateType });
    });
  });

  console.log(standardizedDataArray);
  return standardizedDataArray;
}

export function parseOpenMeteo(data, options){
  if(!'current' in data || !'hourly' in data || !'daily' in data) throw new Error('Invalid data format');

  let weatherData, weatherUnits, index;

  if(options.timeType == 'current') {
      weatherData = data.current;
      weatherUnits = data.current_units;
  }
  else if(options.timeType == 'forecast') {
    for(let i = 0; i < data.hourly.length; i++){
      if(data.hourly[i].time == options.timestamp){
          index = i;
          break;
      }
    }
    weatherData = data.daily[index];
    weatherUnits = data.daily_units;
  }

  const standardizedData  = {
      temperature: weatherData.temperature_2m,
      wind: {
          speed: weatherData.wind_speed_10m,
          direction: weatherData.wind_direction_10m
      },
      precipitation: weatherData.precipitation,
      weatherUnits: {
          temperature: weatherUnits.temperature_2m,
          windSpeed: weatherUnits.wind_speed_10m,
          windDirection: weatherUnits.wind_direction_10m,
          precipitation: weatherUnits.precipitation
      },
      timestamp: weatherData.time,
      rawData: data
    };
  return standardizedData;
}

export async function meteoSixApiCaller(points, options) {
  
}

export function parseMeteoSIX(results) {
  // Suponemos que results es un array de objetos { data, rowIndex }
  if (!results || results.length === 0) {
    console.error("No se han recibido datos de MeteoSIX");
    return null;
  }

  const data = results[0].data;
  if (!data.features || data.features.length === 0) {
    console.error("No hay features en los datos de MeteoSIX");
    return null;
  }
  const feature = data.features[0];
  const days = feature.properties.days;
  
  const now = new Date();
  
  // Variables para almacenar los datos actuales
  let currentTemp = null;
  let currentWind = null;

  for (const day of days) {
    if (!day.variables) continue;
    
    for (const variable of day.variables) {
      if (variable.name === "temperature" && !currentTemp) {
        // Buscamos el primer valor cuya hora sea >= ahora
        const forecast = variable.values.find(v => new Date(v.timeInstant) >= now);
        if (forecast) {
          currentTemp = {
            value: forecast.value,
            timeInstant: forecast.timeInstant,
            modelRun: forecast.modelRun,
            units: variable.units
          };
        }
      }
      // Para el viento
      else if (variable.name === "wind" && !currentWind) {
        const forecast = variable.values.find(v => new Date(v.timeInstant) >= now);
        if (forecast) {
          currentWind = {
            moduleValue: forecast.moduleValue,
            directionValue: forecast.directionValue,
            timeInstant: forecast.timeInstant,
            modelRun: forecast.modelRun,
            moduleUnits: variable.moduleUnits,
            directionUnits: variable.directionUnits,
            iconURL: forecast.iconURL
          };
        }
      }
    }
    if (currentTemp && currentWind) break;
  }
  
  if (!currentTemp || !currentWind) {
    console.error("No se han encontrado datos actuales de temperatura y/o viento");
    return null;
  }

  const standardizedData = {
    temperature: currentTemp.value,
    wind: {
      speed: currentWind.moduleValue,
      direction: currentWind.directionValue
    },
    weatherUnits: {
      temperature: currentTemp.units,
      windSpeed: currentWind.moduleUnits,
      windDirection: currentWind.directionUnits
    },
    timestamp: currentTemp.timeInstant,
    rawData: AudioData
  };
  
  console.log(standardizedData);
  return standardizedData;
}

