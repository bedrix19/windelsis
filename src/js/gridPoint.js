import GridUtils from './gridUtils.js';

export class GridPoint {
    constructor(latitude, longitude) {
      this.latitude = latitude;
      this.longitude = longitude;
      this.id = GridUtils.generatePointKey(latitude,longitude);
      this.weatherData = {
        weather_units: { // data format that we use
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
      this.weatherData = {
        ...data,
        temperature: data.temperature ?? 0,
        wind: {
          speed: data.wind?.speed ?? 0,
          direction: data.wind?.direction ?? 0,
        },
        precipitation: data.precipitation ?? 0,
        timestamp: data.timestamp ?? null,
        rawData: data.rawData ?? null,
      };
      if (this.weatherData.wind.speed !== null && this.weatherData.wind.direction !== null) {
      const { u, v } = GridUtils.convertWindDirection(this.weatherData.wind.speed, this.weatherData.wind.direction);
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
  