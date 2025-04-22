# Windelsis [![NPM version][npm-image]][npm-url]

`Windelsis` is a JavaScript library that visualizes weather data on interactive maps using Leaflet. It provides tools to render temperature, precipitation, and wind velocity layers, as well as utilities for grid-based weather data management.

## Features

- **Weather Layers**: Visualize temperature, precipitation, and wind velocity on a map.
- **Interactive Map**: Built on Leaflet, allowing zooming, panning, and interaction with weather data.
- **Customizable**: Supports custom color scales, grid resolutions, and weather data sources.
- **API Integration**: Fetch weather data from APIs (like Open-Meteo in the demo).

<!-- To do: ![Screenshot](/demo.gif?raw=true) -->

## Installation

To use `Windelsis` in your project, install windelsis, or you can build the library and include it in your application.

### Build the Library

1. Install dependencies:
   ```sh
   npm install

2. Build the library
   ```sh
   npm run build

### npm install

   ```sh
   npm install windelsis
   ```

## Example

Use Windelsis to create a map with weather layers:
   ```js
   const { MapManager } = Windelsis;

   const mapManager = new MapManager(map, fetch_function, options);
   ```

### map

Can either be:

1. **A string**: Represents the ID of the HTML element where the Leaflet map will be **created**.
2. **An instance of `L.Map`**: Pass an existing Leaflet map instance if the map is already created.

This flexibility allows you to let `Windelsis` handle map creation or integrate it with an existing Leaflet map setup.

### fetch_function

This function retrieves weather data based on two parameters:
1. **Array of GridPoint objects**: Each object includes `latitude` and `longitude`.
2. **Options object**: Specifies the type of request (e.g., current weather, forecast).

It must return data in the same order as received. If `fetch_function` is `null`, the library defaults to `openMeteoApiCaller` from `apiService.js`, which fetches data from the Open-Meteo API without requiring an API key.

This flexible approach allows you to source weather data from any provider, such as a database or a meteorological API.

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

6. **`maxBounds`** (`[[lat1, lng1], [lat2, lng2]]`, optional):
   - Defines the geographical bounds that restrict the map's view using two diagonally opposite corners of the rectangle.
   - Default: `null` (no bounds).

7. **`pointDistance`** (number, optional):
   - Specifies the minimum distance in ° between grid points for weather data. Will ignore maxGridPoints if set.
   - Default: `null` (if not set, windelsis calculates it based on maxGrindPoints and the limits of the map).

8. **`maxGridPoints`** (number, optional):
   - Sets the maximum number of grid points to be processed for weather data visualization.
   - Default: `600`.

## Get Weather functions
   ```js
   mapManager.getCurrentData()
   //for now can fetch just one date for forecast
   mapManager.getForecastData(forecastDate, forecastDate)
   mapManager.getHourlyForecast(forecastDate, forecastDate, forecastTime)
   ```

## Testing

Open the `demo` files in your browser. I use the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension in Visual Studio Code for a quick local server setup.

## Reference

`windelsis` is possible because of things like:

- [L.CanvasOverlay.js](https://github.com/Sumbera/gLayers.Leaflet)
- [leaflet-velocity](https://github.com/onaci/leaflet-velocity)
- [WindJS](https://github.com/Esri/wind-js)
- [earth](https://github.com/cambecc/earth)

## License

This project is licensed under the MIT License.

[npm-image]: https://img.shields.io/npm/v/windelsis.svg
[npm-url]: https://www.npmjs.com/package/windelsis
