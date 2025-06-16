function getColorForValue(value, colorScale) {
    // if value is less than the first value in the scale, return the first color
    if (value <= colorScale[0].value) {
        const [r, g, b] = colorScale[0].color;
        return { r, g, b };
    }
    if (value >= colorScale[colorScale.length - 1].value) {
        const [r, g, b] = colorScale[colorScale.length - 1].color;
        return { r, g, b };
    }
  
    // find the two colors that the value is between
    for (let i = 0; i < colorScale.length - 1; i++) {
        const current = colorScale[i];
        const next = colorScale[i + 1];
        if (value >= current.value && value <= next.value) {
            const factor = (value - current.value) / (next.value - current.value);
            const r = Math.round(current.color[0] + factor * (next.color[0] - current.color[0]));
            const g = Math.round(current.color[1] + factor * (next.color[1] - current.color[1]));
            const b = Math.round(current.color[2] + factor * (next.color[2] - current.color[2]));
            return { r, g, b };
        }
    }

    // fallback
    const lastColor = colorScale[colorScale.length - 1].color;
    return { r: lastColor[0], g: lastColor[1], b: lastColor[2] };
}

const COLOR_SCALES = {
    temperature: [
        { value: -15, color: [113, 190, 207] },  // Azul claro
        { value: -8,  color: [137, 204, 197] },  // Verde azulado
        { value: -4,  color: [120, 184, 206] },  // Azul medio
        { value: 0,   color: [98, 129, 207] },   // Azul más oscuro
        { value: 1,   color: [128, 167, 132] },  // Verde grisáceo
        { value: 10,  color: [181, 202, 96] },   // Verde amarillento
        { value: 21,  color: [242, 177, 59] },   // Amarillo anaranjado
        { value: 30,  color: [235, 96, 49] },    // Naranja rojizo
        { value: 47,  color: [112, 45, 21] }     // Marrón oscuro
    ],
    precipitation: [
        { value: 0,   color: [255, 255, 255] }, // Blanco
        { value: 1,   color: [200, 255, 255] }, // Azul muy claro
        { value: 5,   color: [100, 200, 255] }, // Azul claro
        { value: 10,  color: [0, 100, 255] },   // Azul
        { value: 25,  color: [0, 0, 255] },     // Azul oscuro
        { value: 50,  color: [128, 0, 255] }    // Violeta
    ]
};

/**
 * Use of the canvasLayer plugin for Leaflet to render data on a map
 * https://github.com/Sumbera/gLayers.Leaflet
 */
class DataRenderer {
    constructor(map, data, options = {}) {
        this.map = map;
        this.data = data;
        this.canvasLayer = null;
        this._timer = null;
        this.options = Object.assign({
            pixelSize: 5,
            opacity: 0.3,
            controlName: 'Data Layer',
            layerControl: map.layerControl,
            colorScale: COLOR_SCALES.temperature,
            demoMode: false,
        }, options);
    }

    init() {
        this._paneName = this.options.paneName || "overlayPane"; // for leaflet < 1
        
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
        
        this.options.layerControl.addOverlay(this.canvasLayer, this.options.controlName);
        
        return this.canvasLayer;
    }

    onDrawLayer(info) {
        if (!this.data || !this.data.data || this.data.data.length === 0) {
            console.log(this.data, 'No available data to draw');
            return;
        }

        if (this._timer) clearTimeout(this._timer);

        this._timer = setTimeout(() => {
            const ctx = info.canvas.getContext('2d', { willReadFrequently: true });
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
                    const value = this.interpolateValue(latLng.lat, latLng.lng);
                    if (value == null || Number.isNaN(value)) continue;
                    const { r, g, b } = getColorForValue(value, this.options.colorScale);
                    const a = Math.floor(this.options.opacity * 255);;
                    const index = (y * width + x) * 4;
                    data[index] = r;
                    data[index + 1] = g;
                    data[index + 2] = b;
                    data[index + 3] = a;
                }
            }

            if(this.options.demoMode) {
                const header = this.data.header;
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
            }

            ctx.putImageData(imageData, 0, 0);
        }, 100);
    }

    interpolateValue(lat, lng) {
        const { header, data } = this.data;
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

    update(data) {
        this.data = data;
        if (this.canvasLayer && this.map.hasLayer(this.canvasLayer)){
            this.canvasLayer.needRedraw();
        }    
    }

    setOptions(options = {}) {
        Object.assign(this.options, options);
        return this;
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

export { DataRenderer, COLOR_SCALES };