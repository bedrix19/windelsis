function getColorForTemperature(temp) {
    if (temp < 0) return '#0000FF';         // Azul para temperaturas bajo cero
    else if (temp < 10) return '#00FFFF';   // Cian
    else if (temp < 20) return '#00FF00';   // Verde
    else if (temp < 30) return '#FFFF00';   // Amarillo
    else return '#FF0000';                  // Rojo
}
  
class TemperatureRenderer {
    constructor(map, gridPointsMap, options = {}) {
        this.map = map;
        this.gridPointsMap = gridPointsMap;
        this.options = Object.assign({
            pixelSize: 2,
            opacity: 0.8,
            controlName: 'Temperatura',
            layerControl: map.layerControl 
        }, options);
        this.canvasLayer = null;
        this._timer = null;
    }
    
    render() {
        this._paneName = this.options.paneName || "overlayPane"; // Para leaflet < 1
        
        var pane = this.map._panes.overlayPane;
        
        if (this.map.getPane) {
            // Intentar obtener el panel primero para preservar el padre
            pane = this.map.getPane(this._paneName);
            
            if (!pane) {
                pane = this.map.createPane(this._paneName);
            }
        }
        
        // Crear una instancia de L.CanvasLayer y delegarle los métodos de este objeto
        this.canvasLayer = L.canvasLayer({
            pane: pane
        }).delegate(this);
        
        // Añadir la capa al mapa primero
        this.canvasLayer.addTo(this.map);
        
        // Ahora, añadir al control de capas si existe
        // Esto es muy importante: asegúrate de que este código se ejecuta
        console.log("Control de capas disponible:", !!this.options.layerControl);
        
        if (this.options.layerControl) {
            // Usar el control de capas pasado como opción
            this.options.layerControl.addOverlay(this.canvasLayer, this.options.controlName);
            console.log("Capa añadida al control usando this.options.layerControl");
        } else if (this.map.layerControl) {
            // Usar el control de capas del mapa si existe
            this.map.layerControl.addOverlay(this.canvasLayer, this.options.controlName);
            console.log("Capa añadida al control usando this.map.layerControl");
        } else {
            console.log("No se encontró ningún control de capas disponible");
        }
        
        return this.canvasLayer;
    }
    
    // Método requerido por L.CanvasLayer para dibujar
    onDrawLayer(info) {
        if (!this.gridPointsMap || this.gridPointsMap.size === 0) {
            console.log(this.gridPointsMap, 'No hay datos disponibles para dibujar');
            return;
        }
    
        if (this._timer) clearTimeout(this._timer);
    
        this._timer = setTimeout(() => {
            const ctx = info.canvas.getContext('2d');
            ctx.clearRect(0, 0, info.canvas.width, info.canvas.height);
    
            // Configurar opacidad global
            ctx.globalAlpha = this.options.opacity;
    
            // Dibujar cada punto del grid
            for (const [key, point] of this.gridPointsMap) {
                if (point.weatherData && point.weatherData.temperature != null) {
                    // Convertir coordenadas geográficas a posición en el contenedor del mapa
                    const pos = this.map.latLngToContainerPoint([point.latitude, point.longitude]);
                    const color = getColorForTemperature(point.weatherData.temperature);
    
                    ctx.fillStyle = color;
                    ctx.fillRect(pos.x, pos.y, this.options.pixelSize, this.options.pixelSize);
                }
            }
        }, 50); // Pequeño retraso para evitar demasiados redibujados
    }
    
    // Permite actualizar los datos y redibujar la capa
    update(gridPointsMap) {
        this.gridPointsMap = gridPointsMap;
        if (this.canvasLayer) {
            this.canvasLayer.needRedraw();
        }
    }
    
    // Limpiar el canvas
    _clearTemperature() {
        if (this.canvasLayer && this.canvasLayer._canvas) {
            const ctx = this.canvasLayer._canvas.getContext('2d');
            ctx.clearRect(0, 0, this.canvasLayer._canvas.width, this.canvasLayer._canvas.height);
        }
    }
    
    // Destruir la capa de temperatura
    _destroyTemperatureLayer() {
        if (this._timer) clearTimeout(this._timer);
        this._clearTemperature();
        if (this.canvasLayer) {
            this.map.removeLayer(this.canvasLayer);
            this.canvasLayer = null;
        }
    }
}

export default TemperatureRenderer;