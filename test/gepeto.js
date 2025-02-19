/**
 * Expande una matriz original definida por sus extremos y dimensiones, 
 * agregando diferentes cantidades de filas/columnas en cada lado.
 *
 * @param {number} lo1 - Longitud del punto superior izquierdo original.
 * @param {number} la1 - Latitud del punto superior izquierdo original.
 * @param {number} lo2 - Longitud del punto inferior derecho original.
 * @param {number} la2 - Latitud del punto inferior derecho original.
 * @param {number} dx  - Separación en longitud entre puntos.
 * @param {number} dy  - Separación en latitud entre puntos.
 * @param {number} nx  - Número de columnas de la matriz original.
 * @param {number} ny  - Número de filas de la matriz original.
 * @param {number} extraLeft   - Cantidad de columnas a agregar a la izquierda.
 * @param {number} extraRight  - Cantidad de columnas a agregar a la derecha.
 * @param {number} extraTop    - Cantidad de filas a agregar en la parte superior.
 * @param {number} extraBottom - Cantidad de filas a agregar en la parte inferior.
 * @returns {object} Un objeto con la matriz expandida y los nuevos extremos.
 */
function expandMatrix(lo1, la1, lo2, la2, dx, dy, nx, ny, extraLeft, extraRight, extraTop, extraBottom) {
    // Nuevas dimensiones
    const newNx = nx + extraLeft + extraRight; // Total de columnas
    const newNy = ny + extraTop + extraBottom; // Total de filas
  
    // Nuevos extremos:
    // Para longitudes, el eje x crece hacia la derecha.
    const newLo1 = lo1 - extraLeft * dx; // Extremo izquierdo nuevo
    const newLo2 = lo2 + extraRight * dx; // Extremo derecho nuevo
  
    // Para latitudes, asumimos que la latitud disminuye al bajar (la1 es el tope y la2 es el fondo)
    const newLa1 = la1 + extraTop * dy;   // Extremo superior nuevo (mayor latitud)
    const newLa2 = la2 - extraBottom * dy;  // Extremo inferior nuevo (menor latitud)
  
    // Crear la matriz expandida.
    // Se genera un arreglo de filas, cada una con un arreglo de columnas.
    // El índice i = 0 corresponde a la fila superior.
    const matrix = [];
    for (let i = 0; i < newNy; i++) {
      const row = [];
      // Calcular la latitud para la fila i.
      // Comenzamos en newLa1 y bajamos de a dy.
      const currentLa = newLa1 - i * dy;
      for (let j = 0; j < newNx; j++) {
        // Calcular la longitud para la columna j.
        // Comenzamos en newLo1 y avanzamos de a dx.
        const currentLo = newLo1 + j * dx;
  
        // Determinar si el punto pertenece a la matriz original.
        // Los índices de la matriz original están en:
        // filas: de extraTop a extraTop + ny - 1
        // columnas: de extraLeft a extraLeft + nx - 1
        const inOriginal = (i >= extraTop && i < extraTop + ny) &&
                           (j >= extraLeft && j < extraLeft + nx);
  
        row.push({ lo: currentLo, la: currentLa, inOriginal });
      }
      matrix.push(row);
    }
  
    // Retornar la matriz y los nuevos extremos (opcional).
    return {
      matrix,
      newExtremos: {
        topLeft: { lo: newLo1, la: newLa1 },
        bottomRight: { lo: newLo2, la: newLa2 }
      },
      dimensiones: { columnas: newNx, filas: newNy }
    };
  }
  
  // Ejemplo de uso:
  const lo1 = 10, la1 = 20;
  const lo2 = 20, la2 = 10;
  const dx = 1, dy = 1;
  const nx = 11, ny = 11; // Por ejemplo, de 10 a 20 con paso 1 da 11 puntos.
  const extraLeft = 2, extraRight = 3, extraTop = 1, extraBottom = 4;
  
  const resultado = expandMatrix(lo1, la1, lo2, la2, dx, dy, nx, ny, extraLeft, extraRight, extraTop, extraBottom);
  
  // Mostrar información en la consola:
  console.log("Nuevos extremos:", resultado.newExtremos);
  console.log("Dimensiones de la matriz expandida:", resultado.dimensiones);
  console.log("Matriz expandida:", resultado.matrix);
  
/**
 * Interpola los datos de la cuadrícula original a una nueva cuadrícula con separaciones mayores.
 *
 * @param {number[][]} originalData - Arreglo 2D con los datos originales. Se asume originalData[i][j].
 * @param {number} lo1 - Longitud del punto superior izquierdo de la cuadrícula original.
 * @param {number} la1 - Latitud del punto superior izquierdo de la cuadrícula original.
 * @param {number} dx - Separación en longitud en la cuadrícula original.
 * @param {number} dy - Separación en latitud en la cuadrícula original.
 * @param {number} newLo1 - Longitud del punto superior izquierdo de la nueva cuadrícula.
 * @param {number} newLa1 - Latitud del punto superior izquierdo de la nueva cuadrícula.
 * @param {number} newDx - Separación en longitud de la nueva cuadrícula.
 * @param {number} newDy - Separación en latitud de la nueva cuadrícula.
 * @param {number} newNx - Número de columnas de la nueva cuadrícula.
 * @param {number} newNy - Número de filas de la nueva cuadrícula.
 *
 * @returns {Object[][]} newData - Arreglo 2D donde cada elemento es un objeto { lon, lat, value }
 *         Si el punto nuevo cae dentro del área original, se asigna el valor interpolado.
 *         Si está fuera del área original, se deja como null (o se podría procesar de otra forma).
 */
function interpolateToNewGrid(originalData, lo1, la1, dx, dy, newLo1, newLa1, newDx, newDy, newNx, newNy) {
    const newData = [];
    const originalRows = originalData.length;
    const originalCols = originalData[0].length;
    
    // Calcular los límites físicos de la cuadrícula original
    // Esquina superior izquierda: (lo1, la1)
    // Esquina inferior derecha: (lo1 + (originalCols-1)*dx, la1 - (originalRows-1)*dy)
    const origLo2 = lo1 + (originalCols - 1) * dx;
    const origLa2 = la1 - (originalRows - 1) * dy;
    
    // Recorrer cada punto de la nueva cuadrícula
    for (let i = 0; i < newNy; i++) {
      const row = [];
      // Calcular la latitud del punto nuevo (suponiendo que al bajar, la latitud disminuye)
      const newLat = newLa1 - i * newDy;
      for (let j = 0; j < newNx; j++) {
        // Calcular la longitud del punto nuevo
        const newLon = newLo1 + j * newDx;
        let value = null;
        
        // Verificar si el punto nuevo cae dentro del área de la cuadrícula original
        if (newLon >= lo1 && newLon <= origLo2 && newLat <= la1 && newLat >= origLa2) {
          // Calcular las coordenadas "fraccionales" en la cuadrícula original
          const jOrig = (newLon - lo1) / dx;
          const iOrig = (la1 - newLat) / dy;
          
          // Índices enteros vecinos
          let j0 = Math.floor(jOrig);
          let i0 = Math.floor(iOrig);
          let j1 = j0 + 1;
          let i1 = i0 + 1;
          
          // Ajustar en caso de estar en el borde (para evitar índices fuera de rango)
          if (j1 >= originalCols) {
            j1 = originalCols - 1;
            j0 = j1; // Sin interpolación en longitud, se usa el valor exacto
          }
          if (i1 >= originalRows) {
            i1 = originalRows - 1;
            i0 = i1;
          }
          
          const deltaX = jOrig - j0;
          const deltaY = iOrig - i0;
          
          // Valores de los 4 nodos vecinos en la cuadrícula original
          const f00 = originalData[i0][j0];
          const f10 = originalData[i0][j1];
          const f01 = originalData[i1][j0];
          const f11 = originalData[i1][j1];
          
          // Interpolación bilineal:
          value = f00 * (1 - deltaX) * (1 - deltaY) +
                  f10 * deltaX * (1 - deltaY) +
                  f01 * (1 - deltaX) * deltaY +
                  f11 * deltaX * deltaY;
        }
        
        // Guardamos el punto con sus coordenadas y el valor interpolado (o null si está fuera)
        row.push({ lon: newLon, lat: newLat, value: value });
      }
      newData.push(row);
    }
    
    return newData;
  }
  
  // ----------------------
  // Ejemplo de uso:
  
  // Datos de la cuadrícula original
  const originalData = [
    [10, 12, 14, 16],
    [11, 13, 15, 17],
    [12, 14, 16, 18],
    [13, 15, 17, 19]
  ];
  const lo1 = 100;  // Longitud inicial
  const la1 = 50;   // Latitud inicial (superior)
  const dx = 0.5;   // Separación en longitud original
  const dy = 0.5;   // Separación en latitud original
  
  // Nueva cuadrícula (con mayor separación) que cubre el mismo dominio de la original
  const newLo1 = lo1;           // Se asume misma esquina superior izquierda
  const newLa1 = la1;
  const newDx = 1.0;            // Nueva separación (mayor que dx)
  const newDy = 1.0;            // Nueva separación (mayor que dy)
  const newNx = 3;              // Número de columnas en la nueva cuadrícula
  const newNy = 3;              // Número de filas en la nueva cuadrícula
  
  const newGridData = interpolateToNewGrid(
    originalData, lo1, la1, dx, dy,
    newLo1, newLa1, newDx, newDy,
    newNx, newNy
  );
  
  console.log("Nueva cuadrícula con valores interpolados:");
  console.table(newGridData);
  