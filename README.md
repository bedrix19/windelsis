# Windelsis

`Windelsis` is a JavaScript library for visualizing weather data on interactive maps using Leaflet. It provides tools to render temperature, precipitation, and wind velocity layers, as well as utilities for grid-based weather data management.

## Features

- **Weather Layers**: Visualize temperature, precipitation, and wind velocity on a map.
- **Interactive Map**: Built on Leaflet, allowing zooming, panning, and interaction with weather data.
- **Customizable**: Supports custom color scales, grid resolutions, and weather data sources.
- **API Integration**: Fetch weather data from APIs (like Open-Meteo in the demo).

## Installation

To use `Windelsis` in your project, export windelsis.js or you can build the library and include it in your application.

### Build the Library

1. Install dependencies:
   ```sh
   npm install

2. Build library
   ```sh
   npm run build

## Example

Use Windelsis to create a map with weather layers:
   ```js
   const { MapManager } = Windelsis;

   const mapManager = new MapManager(map, fetch_function, options);
   ```

### map

Must be the id of the map (a string) or an instance of L.Map.

### fetch_function

This must be a function capable of obtaining weather data based on two parameters:
1. **An array of GridPoint objects**: Each GridPoint object should provide `latitude` and `longitude` properties.
2. **An options object**: This object determines the type of request to be made (e.g., current weather, forecast, or hourly forecast).

Have to return the weather data in a standarized format in the same order of the original array.

If `fetch_function` is set to `null`, the library will use the default `openMeteoApiCaller` function, which fetches weather data from the Open-Meteo API which does not need an API key.

### options

The `options` parameter is an object that configures the behavior of the `MapManager` instance. It supports the following properties:

1. **`center`** (`[latitude, longitude]`, required):
   - The initial geographical center of the map.

2. **`zoom`** (number, required):
   - The initial zoom level of the map.

3. **`randomData`** (boolean, optional):
   - If `true`, the map will generate random weather data for testing purposes.
   - Default: `false`.

4. **`demoMode`** (boolean, optional):
   - If `true`, enables demo mode with preconfigured settings for testing.
   - Default: `false`.

5. **`windyParameters`** (object, optional):
   - Configuration for the wind visualization layer.
   - Properties:
     - **`maxVelocity`** (number): Maximum wind velocity for the visualization.
     - **`velocityScale`** (number): Scale factor for wind velocity.
     - **`particleAge`** (number): Lifespan of particles in frames.
     - **`lineWidth`** (number): Width of the wind lines.
     - **`particleMultiplier`** (number): Multiplier for the number of particles.
     - **`frameRate`** (number): Frame rate for the animation.

6. **`fetchOptions`** (object, optional):
   - Additional options to pass to the `fetch_function` for API calls.

### Get Weather functions
   ```js
   mapManager.getCurrentData()
   mapManager.getForecastData(forecastDate, forecastDate) //for now can fetch just one date for forecast
   mapManager.getHourlyForecast(forecastDate, forecastDate, forecastTime)
   ```

Test the library, open the demo files in the demo directory in your browser.

## Reference

`windelsis` is possible because of things like:

- [L.CanvasOverlay.js](https://github.com/Sumbera/gLayers.Leaflet)
- [leaflet-velocity](https://github.com/onaci/leaflet-velocity)
- [WindJS](https://github.com/Esri/wind-js)
- [earth](https://github.com/cambecc/earth)

## License

This project is licensed under the MIT License.