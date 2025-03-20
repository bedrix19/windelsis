function getColorForTemperature(temp) {
    // Definición de puntos de parada (stops) con sus valores y colores (en formato RGB)
    const stops = [
        { value: -10, color: [0, 0, 255] },     // Azul
        { value: 0,   color: [0, 255, 255] },   // Cian
        { value: 10,  color: [0, 255, 0] },     // Verde
        { value: 20,  color: [255, 255, 0] },   // Amarillo
        { value: 30,  color: [255, 0, 0] }      // Rojo
    ];
  
    // Si la temperatura está fuera de rango, se retorna el color del extremo correspondiente
    if (temp <= stops[0].value) {
        const [r, g, b] = stops[0].color;
        return { r, g, b };
    }
    if (temp >= stops[stops.length - 1].value) {
        const [r, g, b] = stops[stops.length - 1].color;
        return { r, g, b };
    }
  
    // Buscar entre qué dos puntos se encuentra la temperatura y hacer interpolación
    for (let i = 0; i < stops.length - 1; i++) {
        const current = stops[i];
        const next = stops[i + 1];
        if (temp >= current.value && temp <= next.value) {
            const factor = (temp - current.value) / (next.value - current.value);
            const r = Math.round(current.color[0] + factor * (next.color[0] - current.color[0]));
            const g = Math.round(current.color[1] + factor * (next.color[1] - current.color[1]));
            const b = Math.round(current.color[2] + factor * (next.color[2] - current.color[2]));
            return { r, g, b };
        }
    }
}
  
class TemperatureRenderer {
    constructor(map, temperatureData, options = {}) {
        this.map = map;
        this.temperatureData = temperatureData;
        this.options = Object.assign({
            pixelSize: 5,
            opacity: 0.3,
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
            pane = this.map.getPane(this._paneName);
            if (!pane) {
                pane = this.map.createPane(this._paneName);
            }
        }
        
        this.canvasLayer = L.canvasLayer({
            pane: pane
        }).delegate(this);
        
        this.canvasLayer.addTo(this.map);
        
        if (this.options.layerControl) {
            this.options.layerControl.addOverlay(this.canvasLayer, this.options.controlName);
        } else if (this.map.layerControl) {
            this.map.layerControl.addOverlay(this.canvasLayer, this.options.controlName);
        }
        
        return this.canvasLayer;
    }

    onDrawLayer(info) {
        if (!this.temperatureData || this.temperatureData.data.length === 0) {
            console.log(this.temperatureData, 'No hay datos disponibles para dibujar');
            return;
        }

        if (this._timer) clearTimeout(this._timer);

        this._timer = setTimeout(() => {
            const ctx = info.canvas.getContext('2d');
            ctx.clearRect(0, 0, info.canvas.width, info.canvas.height);

            ctx.globalAlpha = this.options.opacity;
            ctx.globalCompositeOperation = 'multiply';

            const width = info.canvas.width;
            const height = info.canvas.height;
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const latLng = this.map.containerPointToLatLng([x, y]);
                    const temp = this.interpolateTemperature(latLng.lat, latLng.lng);
                    const { r, g, b } = getColorForTemperature(temp);
                    const a = Math.floor(this.options.opacity * 255);;
                    const index = (y * width + x) * 4;
                    data[index] = r;
                    data[index + 1] = g;
                    data[index + 2] = b;
                    data[index + 3] = a;
                }
            }

            // pintar los puntos de la grilla
            const header = this.temperatureData.header;
            const nx = header.nx;
            const ny = header.ny;
            const dx = header.dx;
            const dy = header.dy;
            const lo1 = header.lo1;
            const la1 = header.la1;

            for (let i = 0; i < ny; i++) {
                for (let j = 0; j < nx; j++) {
                    const lat = la1 - i * dy;
                    const lng = lo1 + j * dx;
                    const containerPoint = this.map.latLngToContainerPoint([lat, lng]);
                    const px = Math.round(containerPoint.x);
                    const py = Math.round(containerPoint.y);

                    if (px >= 0 && px < width && py >= 0 && py < height) {
                        const index = (py * width + px) * 4;
                        data[index] = 0;
                        data[index + 1] = 0;
                        data[index + 2] = 0;
                        data[index + 3] = 255;
                    }
                }
            }

            ctx.putImageData(imageData, 0, 0);
        }, 100);
    }

    interpolateTemperature(lat, lng) {
        const { header, data } = this.temperatureData;
        const { lo1, lo2, la1, la2, nx, ny, dx, dy } = header;
        
        const i = Math.floor((la1 - lat) / dy);
        const j = Math.floor((lng - lo1) / dx);
        
        if (i < 0 || i >= ny - 1 || j < 0 || j >= nx - 1) {
            return null;
        }
        
        const t1 = data[i * nx + j];
        const t2 = data[i * nx + (j + 1)];
        const t3 = data[(i + 1) * nx + j];
        const t4 = data[(i + 1) * nx + (j + 1)];
        
        const x1 = lo1 + j * dx;
        const x2 = lo1 + (j + 1) * dx;
        const y1 = la1 - i * dy;
        const y2 = la1 - (i + 1) * dy;
        
        const t12 = t1 + (t2 - t1) * (lng - x1) / (x2 - x1);
        const t34 = t3 + (t4 - t3) * (lng - x1) / (x2 - x1);
        const t = t12 + (t34 - t12) * (lat - y1) / (y2 - y1);
        
        return t;
    }

    update(temperatureData) {
        this.temperatureData = temperatureData;
        if (this.canvasLayer) {
        this.canvasLayer.needRedraw();
        }
    }

    _clearTemperature() {
        if (this.canvasLayer && this.canvasLayer._canvas) {
        const ctx = this.canvasLayer._canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvasLayer._canvas.width, this.canvasLayer._canvas.height);
        }
    }

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