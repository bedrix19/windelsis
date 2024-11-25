class WeatherMap {
    constructor(mapContainerId, apiKeys) {
        this.apiKeys = apiKeys; // Your OpenWeather API key
        this.map = L.map(mapContainerId).setView([0, 0], 2); // Initialize Leaflet map
        this.tempMarker;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.map);

        // Add click event listener to fetch weather data
        this.map.on('click', (event) => this.onMapClick(event));
    }

    async fetchWeatherDataFromNOAA(lat, lon) {
        const baseURL = 'https://www.ncei.noaa.gov/cdo-web/api/v2/data';
        const params = new URLSearchParams({
            datasetid: 'GHCND', 
            datatypeid: 'TMAX', 
            startdate: '2023-01-01', 
            enddate: '2023-12-31', 
            limit: 1,
            latitude: lat,
            longitude: lon,
        });
        const url = `${baseURL}?${params.toString()}`;
    
        const response = await fetch(url, {
            method: 'GET',
            headers: {
            token: this.apiKeys.noaa, // NOAA API token
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch NOAA data');
        }
        return response.json();
    }

    // Fetch weather data from OpenWeather for a given latitude and longitude
    async fetchWeatherDataFromOpenWeather(lat, lon) {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${this.apiKeys.openWeather}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch weather data');
        return response.json();
    }

    async onMapClick(event) {
        const { lat, lng } = event.latlng;
        const selectedAPI = document.getElementById('apiSelector').value;
        try{
            let weatherData, temperature, source;

            if (selectedAPI === 'noaa') {
              weatherData = await this.fetchWeatherDataFromNOAA(lat, lng);
              temperature = weatherData.results[0]?.value ?? 'No data'; // NOAA data format
              source = 'NOAA';
            } else if (selectedAPI === 'openWeather') {
              weatherData = await this.fetchWeatherDataFromOpenWeather(lat, lng);
              temperature = weatherData.main.temp; // OpenWeather data format
              source = 'OpenWeather';
            }
            console.log(selectedAPI,weatherData);

            // Add PopUp
            L.popup()
                .setLatLng(event.latlng)
                .setContent(`Source: ${source}<br>Temperature: ${temperature}°C`) // Location is missing
                .openOn(this.map);

            // Add Marker
            if(this.tempMarker) this.map.removeLayer(this.tempMarker) // Remove marker if is displayed
            this.tempMarker = L.marker([lat, lng], {draggable:true})
                .addTo(this.map)
                .bindPopup(`Source: ${source}<br>Temperature: ${temperature}°C`)
                .openPopup();
        }catch(error){
            console.error('Error fetching weather data:', error);
            alert('Failed to retrieve weather data.');
        }
    }
  }
  
  // Export the class for use in other scripts
  export default WeatherMap;
  