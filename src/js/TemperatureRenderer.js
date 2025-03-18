// TemperatureRenderer.js

// Función para mapear la temperatura a un color.
function getColorForTemperature(temp) {
    if (temp < 0) return '#0000FF';       // Azul para temperaturas bajo cero
    else if (temp < 10) return '#00FFFF';  // Cian
    else if (temp < 20) return '#00FF00';  // Verde
    else if (temp < 30) return '#FFFF00';  // Amarillo
    else return '#FF0000';                // Rojo
}
  
class TemperatureRenderer {
    constructor(map, gridPointsMap, options = {}) {
        this.map = map;
        this.gridPointsMap = gridPointsMap;
        this.options = Object.assign({
            pixelSize: 2,    // Tamaño del píxel o rectángulo a dibujar
            opacity: 0.8,    // Opacidad de la capa de temperatura
            controlName: 'TemperatureRenderer'
            }, options);
        this.canvasLayer = null;
    }
    
    render() {
        this.canvasLayer = new L.Canvas(this.map, this.options); //como en wind-js-leaflet

        this.canvasLayer.draw = () => {
            const canvas = this.canvasLayer.canvas;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (const key in this.gridPointsMap) {
                if (this.gridPointsMap.hasOwnProperty(key)) {
                const point = this.gridPointsMap[key];
                
                if (point.weatherData.temperature == null) continue; // Si no hay dato de temperatura, se omite este punt

                // Convertir coordenadas geográficas a posición en el contenedor del mapa
                const pos = this.map.latLngToContainerPoint([point.latitude, point.longitude]);
                const color = getColorForTemperature(point.weatherData.temperature);

                ctx.fillStyle = color;
                ctx.globalAlpha = this.options.opacity;
                ctx.fillRect(pos.x, pos.y, this.options.pixelSize, this.options.pixelSize);
                }
            }
        };

        // Añadimos la capa de canvas al mapa
        this.canvasLayer.addTo(this.map);

        // Añadir la capa al control de capas de Leaflet usando el nombre especificado.
        if (this.options.controlName) {
            // Se asume que si no existe aún, se crea un control de capas y se guarda en this.map.layerControl.
            if (!this.map.layerControl) {
                this.map.layerControl = L.control.layers(null, null).addTo(this.map);
            }
                this.map.layerControl.addOverlay(this.canvasLayer, this.options.controlName);
        }

        return this.canvasLayer;
    }

    // Permite actualizar los datos y redibujar la capa
    update(gridPointsMap) {
        this.gridPointsMap = gridPointsMap;
        if (this.canvasLayer && typeof this.canvasLayer.draw === 'function') {
        this.canvasLayer.draw();
        }
    }
}
  
  export default TemperatureRenderer;
  