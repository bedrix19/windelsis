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

export default L.GridLayer.extend({
  initialize(data, options = {}) {
    this._data = data;
    this._tileCache = {};
    L.setOptions(this, Object.assign({
      tileSize: 256,
      opacity: 0.3,
      colorScale: COLOR_SCALES.temperature
    }, options));
  },

  createTile(coords, done) {
    const key = `${coords.z}/${coords.x}/${coords.y}`;
    if (this._tileCache[key]) {
      done(null, this._tileCache[key]);
      return this._tileCache[key];
    }

    const tile = L.DomUtil.create('canvas', 'leaflet-tile');
    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;
    const ctx = tile.getContext('2d');

    setTimeout(() => {
      this._drawHeatmapTile(ctx, coords, size.x, size.y);
      this._tileCache[key] = tile;
      done(null, tile);
    }, 0);

    return tile;
  },

  _drawHeatmapTile(ctx, coords, width, height) {
    const img = ctx.getImageData(0, 0, width, height);
    const pixels = img.data;

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const point = L.point(px + coords.x * width, py + coords.y * height);
        const latLng = this._map.unproject(point, coords.z);
        const value = this.interpolateValue(latLng.lat, latLng.lng, this._data);
        if (value == null || isNaN(value)) continue;

        const { r, g, b } = getColorForValue(value, this.options.colorScale);
        const a = Math.floor(this.options.opacity * 255);
        const idx = (py * width + px) * 4;
        pixels[idx]     = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = a;
      }
    }

    ctx.putImageData(img, 0, 0);
  },

  interpolateValue(lat, lng, data = this._data) {
    const { header, data: grid } = data;
    const { lo1, dx, la1, dy, nx, ny } = header;

    const i = Math.floor((la1 - lat) / dy);
    const j = Math.floor((lng - lo1) / dx);
    if (i < 0 || i >= ny - 1 || j < 0 || j >= nx - 1) return null;

    const t1 = grid[i * nx + j];
    const t2 = grid[i * nx + j + 1];
    const t3 = grid[(i + 1) * nx + j];
    const t4 = grid[(i + 1) * nx + j + 1];

    const x1 = lo1 + j * dx;
    const y1 = la1 - i * dy;
    const t12 = t1 + (t2 - t1) * (lng - x1) / dx;
    const t34 = t3 + (t4 - t3) * (lng - x1) / dx;
    return t12 + (t34 - t12) * (lat - y1) / dy;
  },

  updateData(newData) {
    this._data = newData;
    this._tileCache = {};
    this.redraw();
  }
});
