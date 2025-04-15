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
                `&daily=temperature_2m_max,precipitation_sum,` +
                `wind_speed_10m_max,wind_direction_10m_dominant` +
                `&wind_speed_unit=ms`;
          break;
        case 'forecast_hourly':
          url = `${baseUrl}?latitude=${latParams}&longitude=${lonParams}` +
                `&start_date=${options.start_date}&end_date=${options.end_date}` +
                `&hourly=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m` +
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
      standardizedDataArray[startIndex + index] = parseOpenMeteo(weatherData, options);
    });
  });

  return standardizedDataArray;
}

export function parseOpenMeteo(data, options) {
  if (!data || (!data.current && !data.hourly && !data.daily)) {
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
      weatherUnits: {
        temperature: weatherUnits.temperature_2m_max ?? weatherUnits.temperature_2m,
        windSpeed: weatherUnits.wind_speed_10m_max ?? weatherUnits.wind_speed_10m,
        windDirection: weatherUnits.wind_direction_10m_dominant ?? weatherUnits.wind_direction_10m,
        precipitation: weatherUnits.precipitation_sum ?? weatherUnits.precipitation,
      },
      timestamp: weatherData.time?.[index] ?? weatherData.time,
      rawData: data,
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
