/**
 * ==============================================================================
 * p05 | Pasture persistence and wetland classes
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Five filters, in sequence.
 *   
 *   The first two clean up the start of the series: pasture in 2017 that never
 *   recurs was a first-year artefact, and forest at both ends with a forest mode
 *   in between is forest throughout.
 *   
 *   The third reinserts the flooded classes the annual model cannot represent. A
 *   pixel under water for part of the year is mapped as dry grassland or savanna,
 *   so the maximum-flood surface is used to convert grassland to wetland (11),
 *   grassland and pasture to water (33), and savanna to flooded savanna (7).
 *   Isolated patches are cleaned with connectedPixelCount.
 *   
 *   The fourth follows from the third: a pixel that was ever wetland, water or
 *   flooded savanna cannot be pasture in any year, so pasture becomes grassland
 *   across the series.
 *   
 *   The fifth propagates stable pasture forward. Two consecutive pasture years
 *   anchor the class for up to PASTURE_PERSISTENCE years, so the model cannot
 *   drop in and out of pasture on ground that is plainly in continuous use.
 *
 * INPUTS
 *   - PANT_col4_Anual_traj_filter_4 (from p04)
 *   - Sentinel-2 mosaics (mapbiomas-mosaics and nexgenmap, mosaics-3)
 *
 * OUTPUTS
 *   - PANT_col4_Anual_21_filter_{version_out} (one band per year, 2017-2025)
 *
 * NOTES
 *   - limiar_campo_alagado and limiar_agua are NDDI thresholds: raising the first
 *     admits more wet grassland, raising the second admits less water.
 *   - The source repeated its whole header block twice; one copy was removed.
 *
 * PIPELINE
 *   p03 post-classification | step 5 of 7  ->  p06_fractal_filter
 * ==============================================================================
 */

var roi = ee.FeatureCollection('projects/ee-arcplan-df/assets/col11/regions_buffer')
// ======================================================================
// PARAMETERS
// ======================================================================

var anos = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
var START_YEAR = 2017;

var limiar_campo_alagado = 1000; // raise to admit more flooded area
var limiar_agua = 750;           // raise to admit less permanent water
var min_connect_pixel = 25;      // patches of 25 connected px or fewer are smoothed
var PASTURE_PERSISTENCE = 4;     // how many years pasture may propagate from an anchor

var bandas = [
  "blue_median", "blue_median_wet", "blue_median_dry", "blue_stdDev",
  "green_median", "green_median_dry", "green_median_wet", "green_median_texture",
  "green_min", "green_stdDev",
  "red_median", "red_median_dry", "red_min", "red_median_wet", "red_stdDev",
  "nir_median", "nir_median_dry", "nir_median_wet", "nir_stdDev",
  "red_edge_1_median", "red_edge_1_median_dry", "red_edge_1_median_wet", "red_edge_1_stdDev",
  "red_edge_2_median", "red_edge_2_median_dry", "red_edge_2_median_wet", "red_edge_2_stdDev",
  "red_edge_3_median", "red_edge_3_median_dry", "red_edge_3_median_wet", "red_edge_3_stdDev",
  "red_edge_4_median", "red_edge_4_median_dry", "red_edge_4_median_wet", "red_edge_4_stdDev",
  "swir1_median", "swir1_median_dry", "swir1_median_wet", "swir1_stdDev",
  "swir2_median", "swir2_median_wet", "swir2_median_dry", "swir2_stdDev"
];

var asset1  = ee.ImageCollection('projects/mapbiomas-mosaics/assets/SENTINEL/BRAZIL/mosaics-3');
var asset2  = ee.ImageCollection('projects/nexgenmap/MapBiomas2/SENTINEL/mosaics-3').select(bandas);
var colMos  = asset1.merge(asset2);
var addIndex = require('users/gee_arcplan/MapBiomas_Col11_Pantanal:processa_Bandas_Indices_Sentinel');

var imgEntrada = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/PANT_col4_Anual_traj_filter_4')


// ======================================================================
// FILTER 1 - pasture present only in 2017 -> grassland
// ======================================================================
// Pasture in 2017 that never recurs between 2018 and 2025 was almost certainly a
// first-year classification error, so it becomes grassland.

// Count the years after 2017 in which the pixel was pasture
var somaPos2017 = ee.Image(0);
for (var i = 1; i < anos.length; i++) {
  somaPos2017 = somaPos2017.add(
    imgEntrada.select('classification_' + anos[i]).eq(21)
  );
}

// Mask: pasture in 2017 and never again afterwards
var maskSo2017 = imgEntrada.select('classification_2017').eq(21)
                           .and(somaPos2017.eq(0));

var class2017f1 = imgEntrada.select('classification_2017')
                            .where(maskSo2017, 12)
                            .rename('classification_2017');

// addBands with overwrite: replaces the 2017 band only
var filtro1 = imgEntrada.addBands(class2017f1, null, true);

print('Filtro 1 - 21 isolado em 2017 -> 12', filtro1);


// ======================================================================
// FILTER 2 - Stable forest: forest in 2017 and 2025 with a forest mode -> forest throughout
// ======================================================================
// A pixel that is forest at both ends of the series and whose dominant class is
// forest should be forest in every year; the rest is temporal noise.

var modaF2 = ee.ImageCollection(
  anos.map(function (ano) {
    return filtro1.select('classification_' + ano).rename('class');
  })
).mode();

var maskFlorestaEstavel = filtro1.select('classification_2017').eq(3)
                                 .and(filtro1.select('classification_2025').eq(3))
                                 .and(modaF2.eq(3));

for (var i = 0; i < anos.length; i++) {
  var ano  = anos[i];
  var banda = 'classification_' + ano;
  var corrigida = filtro1.select(banda)
                         .where(maskFlorestaEstavel, 3)
                         .rename(banda);
  if (i === 0) { var filtro2 = corrigida; }
  else { filtro2 = filtro2.addBands(corrigida); }
}

print('Filter 2 - stable forest', filtro2);


// ======================================================================
// PRE-STAGE 3 - CONVERT 33 TO 12 BEFORE REINSERTING WETLAND
// ======================================================================
// Water (33) is redetected from scratch by the NDDI below, so residual water
// pixels inherited from the previous step are converted to grassland first.

for (var i = 0; i < anos.length; i++) {
  var ano   = anos[i];
  var banda = 'classification_' + ano;
  var classeAno = filtro2.select(banda);
  var sem33 = classeAno.where(classeAno.eq(33), 12).rename(banda);
  if (i === 0) { var filtro2b = sem33; }
  else { filtro2b = filtro2b.addBands(sem33); }
}

print('Pre-stage 3 - 33 to 12', filtro2b);


// ======================================================================
// STAGE 3 - REINSERT THE WETLAND CLASSES (11 / 33 / 7)
// ======================================================================

// ------ 3a. Raw annual flood surface ----------------------------------
// Background 21 is ignored later; flood is 11 and water is 33.
// The blend gives water priority over wetland, since water is more restrictive.

for (var i_ano = 0; i_ano < anos.length; i_ano++) {
  var ano = anos[i_ano];

  var mosaicoBase = colMos
    .filterMetadata('year',  'equals', ano)
    .filterMetadata('biome', 'equals', 'PANTANAL')
    .mosaic();
  var mosaicoTotal = addIndex.get(mosaicoBase);

  // Wet-season NDDI
  var nddi_wet = mosaicoTotal
    .normalizedDifference(['ndvi_median_wet', 'ndwi_median_wet'])
    .add(1).multiply(1000);
  nddi_wet = ee.Image(1).blend(nddi_wet)//.clip(geometry);

  // NDDI seco (idem)
  var nddi_dry = mosaicoTotal
    .normalizedDifference(['ndvi_median_dry', 'ndwi_median_dry'])
    .add(1).multiply(1000);
  nddi_dry = ee.Image(1).blend(nddi_dry)//.clip(geometry);

  // Flood and permanent water detected from the wet season
  var cheia_maxima = nddi_wet.lt(limiar_campo_alagado)
                             .and(mosaicoTotal.select('ndwi_median_wet').gt(0.1));
  var agua_maxima  = nddi_wet.lt(limiar_agua)
                             .and(mosaicoTotal.select('ndwi_median_wet').gt(0.1));

  // Raw flood surface: background 21, wetland 11, water 33
  var wetRaw = ee.Image(21)
    .blend(cheia_maxima.selfMask().remap([1], [11]))
    .blend(agua_maxima.selfMask().remap([1], [33]))
    .rename('classification_' + ano);

  if (i_ano === 0) { var wetAreaRaw = wetRaw; }
  else { wetAreaRaw = wetAreaRaw.addBands(wetRaw); }
}

// ------ 3b. Remove isolated patches from the flood surface ------------
// patches with this many connected pixels or fewer are smoothed
// by the neighbourhood mode (3x3 square kernel).

for (var i_ano = 0; i_ano < anos.length; i_ano++) {
  var ano   = anos[i_ano];
  var banda = 'classification_' + ano;
  var wetAno = wetAreaRaw.select(banda);
  var conn   = wetAno.connectedPixelCount(100, true);
  var moda   = wetAno.focal_mode(3, 'square', 'pixels')
                     .updateMask(conn.lte(min_connect_pixel));
  var wetFilt = wetAno.blend(moda).rename(banda);

  if (i_ano === 0) { var wetAreaFiltered = wetFilt; }
  else { wetAreaFiltered = wetAreaFiltered.addBands(wetFilt); }
}

// ------ 3c. Merge the flood surface into the main classification ------
// Overlay rules, in increasing order of priority:
//   11 where the flood surface is wetland and the class is grassland
//   33 where the flood surface is water and the class is grassland
//   33 where the flood surface is water and the class is pasture
//    7 where the flood surface is wetland and the class is savanna

for (var i_ano = 0; i_ano < anos.length; i_ano++) {
  var ano   = anos[i_ano];
  var banda = 'classification_' + ano;

  var wetAno      = wetAreaFiltered.select(banda);

  var campo_ano  = classeAtual.eq(12);
  var pasto_ano  = classeAtual.eq(21);
  var savana_ano = classeAtual.eq(4);

  // Overlay layers, all self-masked, so each affects only where its rule holds
  var alagado_campo = wetAno.eq(11).and(campo_ano).selfMask().remap([1], [11]).rename(banda);
  var agua_campo    = wetAno.eq(33).and(campo_ano).selfMask().remap([1], [33]).rename(banda);
  var agua_pasto    = wetAno.eq(33).and(pasto_ano).selfMask().remap([1], [33]).rename(banda);
  // 7 overrides 11 where the base class is savanna; the last blend wins
  var savana_inund  = wetAno.eq(11).and(savana_ano).selfMask().remap([1], [7]).rename(banda);

  var classeComUmido = classeAtual
    .blend(alagado_campo)
    .blend(agua_campo)
    .blend(agua_pasto)
    .blend(savana_inund) // last blend wins
    .rename(banda);

  if (i_ano === 0) { var filtro3 = classeComUmido; }
  else { filtro3 = filtro3.addBands(classeComUmido); }
}

print('Stage 3 - wetland reinserted', filtro3);


// ======================================================================
// FILTER 4 - pasture becomes grassland wherever the pixel was ever flooded
// ======================================================================
// Pasture on ground that has shown any sign of flooding is far more likely to be
// naturally flooded grassland than cultivated pasture.

// Cumulative mask: true where the class was 11, 33 or 7 in any year
var maskUmidoAny = ee.Image(0);
for (var i = 0; i < anos.length; i++) {
  var classeAno = filtro3.select('classification_' + anos[i]);
  maskUmidoAny  = maskUmidoAny.or(
    classeAno.eq(11).or(classeAno.eq(33)).or(classeAno.eq(7))
  );
}

// Applied to every year: pasture becomes grassland where there is a flood history
for (var i = 0; i < anos.length; i++) {
  var ano   = anos[i];
  var banda = 'classification_' + ano;
  var classeAno = filtro3.select(banda);
  var corrigida  = classeAno
    .where(classeAno.eq(21).and(maskUmidoAny), 12)
    .rename(banda);
  if (i === 0) { var filtro4 = corrigida; }
  else { filtro4 = filtro4.addBands(corrigida); }
}

print('Filter 4 - pasture to grassland on flooded ground', filtro4);


// ======================================================================
// FILTER 5 - STABLE PASTURE PERSISTENCE
// ======================================================================
// Two consecutive pasture years act as an anchor: the window of up to
// PASTURE_PERSISTENCE years around them should also be pasture.
// ser 21.
//
// For each year Y and each offset p (0 to PASTURE_PERSISTENCE):
//   anchor = Y - p
//   if the two years before Y were both pasture, Y becomes pasture too
//
// Filter 4 has already converted flooded pasture to grassland, so anchors in
// wetland areas will not propagate pasture.

for (var i = 0; i < anos.length; i++) {
  var year          = anos[i];
  var currentClass  = filtro4.select('classification_' + year);
  var cumulativeStableMask = ee.Image(0);

  for (var p = 0; p <= PASTURE_PERSISTENCE; p++) {
    var targetAnchorYear = year - p;
    var prev1 = targetAnchorYear - 1;
    var prev2 = targetAnchorYear - 2;

    // Only run while the second anchor year is still inside the series
    if (prev2 >= START_YEAR) {
      var isStable = filtro4.select('classification_' + prev2).eq(21)
                    .and(filtro4.select('classification_' + prev1).eq(21));
      cumulativeStableMask = cumulativeStableMask.or(isStable);
    }
  }

  // Where the cumulative mask is true, force pasture; the blend only overwrites
  // os pixels onde o mask tem valor (selfMask descarta os FALSE/0)
  var finalPastureMask = cumulativeStableMask.selfMask().multiply(21);
  var classCorr = currentClass
    .blend(finalPastureMask)
    .rename('classification_' + year);

  if (i === 0) { var filtro5 = classCorr; }
  else { filtro5 = filtro5.addBands(classCorr); }
}

print('Filter 5 - stable pasture persistence', filtro5);


// ======================================================================
// FINAL OUTPUT
// ======================================================================

var outotalFiltros2 = filtro5;

print('Resultado final - novo conjunto de filtros', outotalFiltros2);

// Optional visual check
 var palettes = require('users/mapbiomas/modules:Palettes.js');
 var vis = { min: 0, max: 62, palette: palettes.get('classification8') };
 for (var i = 0; i < anos.length; i++) {
    Map.addLayer(imgEntrada.select('classification_' + anos[i]), vis, 'entrada ' + anos[i], false);


   Map.addLayer(outotalFiltros2.select('classification_' + anos[i]), vis, 'Output ' + anos[i], false);
 }

// =============================================================================
// EXPORT
// =============================================================================
var vesion_in   = '4';
var version_out = '5';
var descricao   = 'Filtro pasto';
var col         = 4.0;
var prefixo_out = 'PANT_col4_Anual_21_filter_';
var dirout      = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/';
//projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/PANT_col4_Anual_moda_filter_
var finalOutput = outotalFiltros2
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
