/**
 * ==============================================================================
 * p06 | Relief mask, isolation filter and fractal filter
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Three filters that remove what survived every earlier stage.
 *   
 *   The relief mask handles a specific artefact: slope, terrain roughness and
 *   permanent shadow all darken a pixel in ways that read as water. Wetland (11)
 *   and water (33) on rough ground become grassland, and flooded savanna (7)
 *   becomes savanna.
 *   
 *   The isolation filter replaces patches below filter_size pixels with the
 *   majority class of their neighbourhood.
 *   
 *   The fractal filter works on shape rather than spectra. Real pasture is
 *   compact, because fences and machinery produce simple outlines; classification
 *   noise is small and ragged. The fractal dimension, 2 * ln(perimeter) /
 *   ln(area), separates them, and a pasture patch under five hectares whose
 *   fractal dimension exceeds 1.35 is reclassified as grassland.
 *
 * INPUTS
 *   - PANT_col4_Anual_21_filter_5 (from p05)
 *
 * OUTPUTS
 *   - PANT_col4_Anual_df_filter_{version_out} (one band per year, 2017-2025)
 *
 * NOTES
 *   - MAX_PIXELS_PATCH is deliberately set just above the area threshold: patches
 *     larger than that would be kept anyway, so a wider search only costs time.
 *   - If this script times out, use p06b, which splits the fractal filter into one
 *     export task per year.
 *   - A slower earlier variant of this script (p06_df_filter) is not carried over.
 *
 * PIPELINE
 *   p03 post-classification | step 6 of 7  ->  p07_prodes_alerts_mask
 * ==============================================================================
 */

var roi = ee.FeatureCollection('projects/ee-arcplan-df/assets/col11/regions_buffer');
// ======================================================================
// PARAMETERS
// ======================================================================

var anos = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

// Filtro espacial de isolamento (etapa 1b)
var filter_size = 8;            // pixels with this many connected neighbours or fewer are smoothed

// Fractal dimension filter (stage 3)
var AREA_THRESHOLD_HA  = 5;                        // largest suspect patch, in hectares
var AREA_THRESHOLD_M2  = AREA_THRESHOLD_HA * 10000; // in square metres
var FD_THRESHOLD       = 1.35;                     // fractal dimension threshold
// At 10 m, 1 px = 100 m2, so 5 ha = 500 px. A 20% margin guarantees a correct
// label for every patch below the threshold without searching any further.
var AREA_THRESHOLD_PIXELS = Math.round(AREA_THRESHOLD_M2 / 100); // 500 px a 10m
var MAX_PIXELS_PATCH      = Math.round(AREA_THRESHOLD_PIXELS * 1.2); // 600 px

var imgEntrada = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/PANT_col4_Anual_21_filter_5');

var palettes = require('users/mapbiomas/modules:Palettes.js');
var vis = { min: 0, max: 62, palette: palettes.get('classification8') };


// ======================================================================
// STAGE 1a - ROUGH RELIEF MASK
// ======================================================================
// Wet classes (7 / 11 / 33) on rough relief are spectral artefacts caused by
// artefatos espectrais causados por sombra e rugosidade do terreno.
// Corrections applied:
//   7  (flooded savanna) -> 4  (savanna)
//   11 (Campo Alagado)     -> 12 (Campestre)
//   33 (water)           -> 12 (grassland)

var dem = ee.Image('USGS/SRTMGL1_003');

// 1. Declividade
var slope    = ee.Terrain.slope(dem);
var slopeMask = slope.gt(15);                    // graus

// 2. Roughness (TRI: local standard deviation of elevation, 3x3 kernel)
var tri     = dem.reduceNeighborhood({
  reducer: ee.Reducer.stdDev(),
  kernel:  ee.Kernel.square(3)
});
var triMask = tri.gt(25);                        // metros

// 3. Sombra permanente: hillshade < 0.1 nos 4 azimutes principais
function hillshadeAzimuth(azimuthDeg) {
  var az       = ee.Image.constant(azimuthDeg).multiply(Math.PI / 180);
  var zen      = ee.Image.constant(45).multiply(Math.PI / 180);
  var slopeRad = slope.multiply(Math.PI / 180);
  var aspect   = ee.Terrain.aspect(dem).multiply(Math.PI / 180);
  return zen.cos().multiply(slopeRad.cos())
    .add(zen.sin().multiply(slopeRad.sin()).multiply(az.subtract(aspect).cos()));
}
var sombraPermanente = hillshadeAzimuth(45).lt(0.1)
  .and(hillshadeAzimuth(135).lt(0.1))
  .and(hillshadeAzimuth(225).lt(0.1))
  .and(hillshadeAzimuth(315).lt(0.1));

// 4. Combined mask, with small fragments removed
// Reduced window (200 against 1000): equivalent result for spurious relief
// fragments, at a much lower search cost.
var relevoMask = slopeMask.or(triMask).or(sombraPermanente)
  .selfMask()
  .connectedPixelCount(200, true).gte(50)
  .unmask(0).gt(0);                             // boolean: 1 = relevo acidentado

Map.addLayer(slope,        { min: 0, max: 45,  palette: ['white','orange','brown'] }, 'Slope',        false);
Map.addLayer(tri,          { min: 0, max: 100, palette: ['white','grey','black'] },   'TRI',          false);
Map.addLayer(sombraPermanente, { palette: ['yellow'] },                               'Sombra perm.', false);
Map.addLayer(relevoMask,   { palette: ['white','red'] },                              'Relevo mask',  false);

// Apply the correction year by year
for (var i = 0; i < anos.length; i++) {
  var ano   = anos[i];
  var banda = 'classification_' + ano;
  var classeAno = imgEntrada.select(banda);

  var corrigida = classeAno
    .where(relevoMask.and(classeAno.eq(7)),  4)   // Savana Inund. -> Savana
    .where(relevoMask.and(classeAno.eq(11)), 12)  // Campo Alagado -> Campestre
    .where(relevoMask.and(classeAno.eq(33)), 12)  // water     -> grassland
    .rename(banda);

  if (i === 0) { var filtro1a = corrigida; }
  else { filtro1a = filtro1a.addBands(corrigida); }
}

print('Filtro 1a - Relevo acidentado corrigido', filtro1a);


// ======================================================================
// ETAPA 1b - FILTRO ESPACIAL DE ISOLAMENTO (connectedPixelCount)
// ======================================================================
// Pixels with filter_size connected neighbours of the same class or fewer take
// the mode of their 3x3 neighbourhood, which removes granular noise and patches
// below the minimum mapping unit.

for (var i = 0; i < anos.length; i++) {
  var ano   = anos[i];
  var banda = 'classification_' + ano;
  var image = filtro1a.select(banda);

  var focal_mode  = image.unmask(0)
                         .focal_mode({ radius: 1, kernelType: 'square', units: 'pixels' });
  var connections = image.unmask(0)
                         .connectedPixelCount({ maxSize: 30, eightConnected: false });

  // No reproject: Earth Engine evaluates at the export scale, tile by tile.
  // A reproject here would force the whole tile to 10 m before the export.
  var to_mask  = focal_mode.updateMask(connections.lte(filter_size));
  var classOut = image.blend(to_mask)
                      .updateMask(image.unmask(0).neq(0))
                      .rename(banda);

  if (i === 0) { var filtro1b = classOut; }
  else { filtro1b = filtro1b.addBands(classOut); }
}

print('Filtro 1b - Isolamento espacial', filtro1b);


// ======================================================================
// FILTER 2 - pasture in exactly one year, other than 2025 -> grassland
// ======================================================================
// Pasture that appears in exactly one year of the series is almost certainly a
// classification error. The exception is 2025, the most recent year, where a
// single occurrence may be a real recent conversion not yet consolidated.

// Total number of years the pixel was pasture
var soma21 = ee.Image(0);
for (var i = 0; i < anos.length; i++) {
  soma21 = soma21.add(
    filtro1b.select('classification_' + anos[i]).eq(21)
  );
}
var apenasUmaVez21 = soma21.eq(1); // TRUE onde 21 aparece em exatamente 1 ano

for (var i = 0; i < anos.length; i++) {
  var ano   = anos[i];
  var banda = 'classification_' + ano;
  var classeAno = filtro1b.select(banda);
  var corrigida;

  if (ano !== 2025) {
    // Pasture this year, only once in the series, and not 2025 -> grassland
    var maskIsol21 = classeAno.eq(21).and(apenasUmaVez21);
    corrigida = classeAno.where(maskIsol21, 12).rename(banda);
  } else {
    corrigida = classeAno.rename(banda); // 2025 is handled above
  }

  if (i === 0) { var filtro2 = corrigida; }
  else { filtro2 = filtro2.addBands(corrigida); }
}

print('Filter 2 - single-year pasture', filtro2);


// ======================================================================
// FILTER 3 - FRACTAL DIMENSION: small, convoluted pasture patches -> grassland
// ======================================================================
// Pastagens reais tendem a ter forma compacta (baixa complexidade de
// borda). Patches de classe 21 que combinam:
//   area below AREA_THRESHOLD_M2, and
//   FD above FD_THRESHOLD (a very irregular outline)
// together mark structural noise, which is reclassified as grassland.
//
// FD = 2 * ln(perimeter) / ln(area)
//   A circular or square patch gives FD near 1.0
//   Forma fragmentada       -> FD -> 2.0
//
// MAX_PIXELS_PATCH is 600 (500 px plus 20%) rather than 1024: patches above
// Patches > 600 px excedem o threshold de 500 px (5 ha) e seriam mantidos
// 600 px exceed the threshold and would be kept regardless.

var applyFractalFilter21 = function (image, banda) {
  var patchMask = image.eq(21);

  // Exposed edges: 4-connected neighbours that are not pasture
  var weights      = [[0, 1, 0],
                      [1, 0, 1],
                      [0, 1, 0]];
  var kernel       = ee.Kernel.fixed({ width: 3, height: 3, weights: weights });
  var neighbors    = patchMask.convolve(kernel);
  var exposedEdges = ee.Image(4).subtract(neighbors).multiply(patchMask);

  // Comprimento de borda por pixel
  var pixelSide      = ee.Image.pixelArea().sqrt();
  var pixelPerimeter = exposedEdges.multiply(pixelSide).rename('perimeter');

  // IDs de patches - BFS limitado ao tamanho que realmente importa
  var patchOnly = patchMask.selfMask();
  var patchIds  = patchOnly.connectedComponents({
    connectedness: ee.Kernel.square(1),
    maxSize: MAX_PIXELS_PATCH
  }).select('labels');

  // Total area per patch
  var pixelArea = ee.Image.pixelArea().updateMask(patchOnly).rename('area');
  var patchArea = pixelArea.addBands(patchIds).reduceConnectedComponents({
    reducer:   ee.Reducer.sum(),
    labelBand: 'labels',
    maxSize:   MAX_PIXELS_PATCH
  });

  // Total perimeter per patch
  var patchPerimeter = pixelPerimeter.updateMask(patchOnly).addBands(patchIds)
    .reduceConnectedComponents({
      reducer:   ee.Reducer.sum(),
      labelBand: 'labels',
      maxSize:   MAX_PIXELS_PATCH          // 600 px  <- reduzido de 1024
    });

  // Fractal dimension: FD = 2 * ln(P) / ln(A)
  var fd = ee.Image(2)
    .multiply(patchPerimeter.log())
    .divide(patchArea.log())
    .rename('fd');

  // Patches suspeitos: pequenos (< 5 ha) E borda complexa (FD > threshold)
  var suspiciousPatches = patchArea.lt(AREA_THRESHOLD_M2).and(fd.gt(FD_THRESHOLD));

  return image.where(suspiciousPatches, 12).rename(banda);
};

// Apply the fractal filter to each year
for (var i = 0; i < anos.length; i++) {
  var ano       = anos[i];
  var banda     = 'classification_' + ano;
  var classeAno = filtro2.select(banda);
  var corrigida = applyFractalFilter21(classeAno, banda);

  if (i === 0) { var filtro3 = corrigida; }
  else { filtro3 = filtro3.addBands(corrigida); }
}

print('Filter 3 - fractal dimension', filtro3);


// ======================================================================
// FINAL OUTPUT AND VISUAL CHECK
// ======================================================================

var outFinal = filtro3;
print('Resultado final', outFinal);

for (var i = 0; i < anos.length; i++) {
  var ano = anos[i];
  // Map.addLayer(imgEntrada.select('classification_' + ano), vis, 'Entrada '  + ano, false);
  // Map.addLayer(outFinal.select('classification_'   + ano), vis, 'Output '   + ano, false);
}

// =============================================================================
// EXPORT
// =============================================================================
var vesion_in   = '5';
var version_out = '6';
var descricao   = 'Filtro fractal';
var col         = 4.0;
var prefixo_out = 'PANT_col4_Anual_df_filter_';
var dirout      = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/';
//projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/PANT_col4_Anual_moda_filter_
var finalOutput = outFinal
  .set('territory',    'BRAZIL')
  .set('biome',        'PANTANAL')
  .set('source',       'arcplan')
  .set('version',      version_out)
  .set('year',         version_out)
  .set('collection_id', col)
  .set('description',  descricao);

print('Ready to export:', finalOutput);

Export.image.toAsset({
  image:            finalOutput.toByte(),
  description:      prefixo_out + version_out,
  assetId:          dirout + prefixo_out + version_out,
  scale:            10,
  pyramidingPolicy: { '.default': 'mode' },
  maxPixels:        1e13,
  region:           roi
});

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias - ArcPlan - mariana@arcplan.com.br
 * MapBiomas Collection 4 (10 m) | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
