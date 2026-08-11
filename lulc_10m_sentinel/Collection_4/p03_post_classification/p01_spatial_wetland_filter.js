/**
 * ==============================================================================
 * p01 | Spatial filter and wetland reinsertion
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   First post-classification step, and the one that does the most work. Six
 *   stages run in sequence:
 *   
 *     2. temporal stabilisation. The class a pixel holds most often across the
 *        series decides what its dissenting years become, per class family.
 *     3. forest standing anywhere water was ever detected becomes grassland:
 *        forest does not grow on ground that floods.
 *     4. local mode filter, applied only to patches below MIN_CONNECT_PIXEL, so
 *        isolated noise is removed without smoothing coherent areas.
 *     5. wetland filter I. Pixels flooded for more than 240 months across the
 *        monthly series are pulled back to wetland or grassland.
 *     6. wetland filter II. The wet-season NDDI is computed per year from the
 *        Sentinel-2 mosaics and passed through the same mode filter; where at
 *        least two years confirm wet grassland, the series is reclassified.
 *   
 *   The two wetland filters are deliberately independent: one is historical and
 *   comes from the monthly water product, the other is spectral and comes from
 *   the mosaics themselves. Requiring both keeps single-year floods from
 *   rewriting the map.
 *
 * INPUTS
 *   - PANT_col4_Anual_GapFill_3 (from p02)
 *   - Sentinel-2 mosaics (mapbiomas-mosaics and nexgenmap, mosaics-3)
 *   - Accumulated monthly flood frequency (frequenciaAcumulada_bruta_33_11_v1)
 *
 * OUTPUTS
 *   - PANT_col4_Anual_au_filter_{VERSION_OUT} (one band per year, 2017-2025)
 *
 * NOTES
 *   - The 1xx values in the remap tables are the mask offset: a mask adds 100 to
 *     the pixel, so 121 means "class 21 under this mask".
 *   - LIMIAR_CAMPO_ALAGADO and LIMIAR_AGUA are NDDI thresholds; raising them
 *     admits more wet grassland and less water respectively.
 *
 * PIPELINE
 *   p03 post-classification | step 1 of 7  ->  p02_mode_filter
 * ==============================================================================
 */

// -- 0. CONSTANTES E ROI ------------------------------------------------------
var REGIONS_BUFFER_FC = ee.FeatureCollection('projects/ee-arcplan-df/assets/col11/regions_buffer');
var roi = REGIONS_BUFFER_FC;

var START_YEAR = 2017;
var END_YEAR   = 2025;
var ANOS_INT   = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
var ANOS_STR   = ANOS_INT.map(String);
var YEARS_EE   = ee.List.sequence(START_YEAR, END_YEAR);

// Output metadata
var BIOME            = 'PANTANAL';
var COL_VERSION      = 4.0;
var VERSION_OUT      = '1';
var DESCRIPTION      = 'Area umida e spatial filter';
var DIR_ASSETS       = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft';
var ASSET_PREFIX_OUT = 'PANT_col4_Anual_au_filter_';
var SCALE            = 10;

// Filter parameters
var MIN_CONNECT_PIXEL    = 25;   // patches at or below this size take the local mode
var LIMIAR_CAMPO_ALAGADO = 850;  // NDDI below this is wet grassland; raise to admit more
var LIMIAR_AGUA          = 750;  // NDDI below this is water; raise to admit less

// Visual check
var palettes = require('users/mapbiomas/modules:Palettes.js');
var vis      = { min: 0, max: 68, palette: palettes.get('classification9') };

// Region outlines, hidden by default
['reg0','reg1','reg2','reg3','reg4','reg5','reg6','reg7','reg8'].forEach(function(id) {
  Map.addLayer(REGIONS_BUFFER_FC.filter(ee.Filter.eq('id_reg', id)), {}, id, false);
});


// -- 1. DADOS DE ENTRADA ------------------------------------------------------
// Spectral index module for the S2 mosaic
var addIndex = require('users/gee_arcplan/MapBiomas_Col11_Pantanal:processa_Bandas_Indices_Sentinel');

// Sentinel-2 mosaics, two collections merged
var colMos = ee.ImageCollection('projects/mapbiomas-mosaics/assets/SENTINEL/BRAZIL/mosaics-3')
  .merge(ee.ImageCollection('projects/nexgenmap/MapBiomas2/SENTINEL/mosaics-3'));

// Accumulated monthly flood frequency, used by wetland filter I
var freqAlagado = ee.Image(
  'projects/mapbiomas-workspace/AMOSTRAS/col10/PANTANAL/SAMPLES/mensal/frequenciaAcumulada_bruta_33_11_v1'
);

var integratedBands = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan/PANT_col4_Anual_GapFill_3');
var geometry = roi.geometry();


// -- 2. TEMPORAL STABILISATION -------------------------------------------------
// Temporal mode plus a count of how often each pixel was water across the series.
// The 1xx values are masked classes, resolved against the pixel's modal class.
// Use ANOS_INT (client-side array). With YEARS_EE (an ee.List) the loop variable
// becomes an ee.ComputedObject and 'classification_' + y builds the wrong band name.
var imgList = ANOS_INT.map(function(y) {
  return integratedBands.select('classification_' + y).rename('class');
});
var tempCol = ee.ImageCollection(imgList);
var modeImg   = tempCol.mode();
var waterSum  = tempCol.map(function(img) { return img.eq(33); }).sum();
var waterMask = waterSum.gte(1).remap([1],[100]).toByte().selfMask();

var stabs = {
  Water: {
    mask: waterMask,
    i: [3, 4, 12, 19, 21, 29, 25, 33, 103, 104, 112, 119, 121, 129, 125, 133],
    o: [3, 4, 12, 19, 21, 29, 25, 33,  12,   4,  12,  19,  21,  12,  12,  33]
  },
  Savanna: {
    mask: modeImg.eq(4).remap([1],[100]).toByte().selfMask(),
    i: [3, 4, 12, 19, 21, 29, 25, 33, 103, 104, 112, 119, 121, 129, 125, 133],
    o: [3, 4, 12, 19, 21, 29, 25, 33,   4,   4,  12,   4,  21,   4,  25,  33]
  },
  Campo: {
    mask: modeImg.eq(12).remap([1],[100]).toByte().selfMask(),
    i: [3, 4, 12, 19, 21, 29, 25, 33, 103, 104, 112, 119, 121, 129, 125, 133],
    o: [3, 4, 12, 19, 21, 29, 25, 33,   4,   4,  12,  12,  21,  12,  12,  33]
  },
  Pasture: {
    mask: integratedBands.select('classification_' + START_YEAR).eq(21)
            .and(integratedBands.select('classification_' + END_YEAR).eq(21))
            .and(modeImg.eq(21))
            .remap([1],[100]).toByte().selfMask(),
    i: [3, 4, 12, 19, 21, 29, 25, 33, 103, 104, 112, 119, 121, 129, 125, 133],
    o: [3, 4, 12, 19, 21, 29, 25, 33,  21,  21,  21,  21,  21,  21,  21,  21]
  },
  Forest: {
    mask: modeImg.eq(3).remap([1],[100]).toByte().selfMask(),
    i: [3, 4, 12, 19, 21, 29, 25, 33, 103, 104, 112, 119, 121, 129, 125, 133],
    o: [3, 4, 12, 19, 21, 29, 25, 33,   3,   3,  12,   3,  21,  12,  25,  33]
  }
};

var outBands = integratedBands;
['Water','Savanna','Campo','Pasture','Forest'].forEach(function(key) {
  var r = stabs[key];
  for (var i = 0; i < ANOS_STR.length; i++) {
    var ano  = ANOS_STR[i];
    var base = outBands.select('classification_' + ano);
    var corr = base.add(r.mask).remap(r.i, r.o).rename('classification_' + ano);
    outBands = outBands.addBands(base.blend(corr), null, true);
  }
});


// -- 3. WATER PRESENCE: FOREST BECOMES GRASSLAND (12) --------------------------
// Any pixel that was water (33) in at least one year of the series and is
// classified as forest (3) becomes grassland (12).
// Forest does not stand on ground that floods, so this is a misclassification.
var hasWater = waterSum.gte(1);
var step3;

for (var i = 0; i < ANOS_STR.length; i++) {
  var ano  = ANOS_STR[i];
  var base = outBands.select('classification_' + ano);
  // .where(condition, value) replaces only where the condition holds
  var band = base.where(hasWater.and(base.eq(3)), 12)
                 .rename('classification_' + ano);
  if (i === 0) { step3 = band; }
  else         { step3 = step3.addBands(band); }
}


// -- 4. FILTRO DE MODA + FILTRO ESPACIAL --------------------------------------
// The local mode (3x3 square window) is computed everywhere but applied only to
// isolated patches (MIN_CONNECT_PIXEL connected pixels or fewer), so granular
// noise disappears without smoothing large coherent areas.
var bandNames_ee = ee.List(ANOS_STR.map(function(a) { return 'classification_' + a; }));
var connNames_ee = bandNames_ee.map(function(b) { return ee.String(b).cat('_conn'); });

var step3WithConn = step3.addBands(
  step3.connectedPixelCount(100, true).rename(connNames_ee)
);

var step4;
for (var i = 0; i < ANOS_STR.length; i++) {
  var ano  = ANOS_STR[i];
  var base = step3WithConn.select('classification_' + ano);
  var conn = step3WithConn.select('classification_' + ano + '_conn');
  // masked local mode: applied only where the patch is small
  var moda = base.focal_mode(3, 'square', 'pixels').mask(conn.lte(MIN_CONNECT_PIXEL));
  var out  = base.blend(moda).rename('classification_' + ano);
  if (i === 0) { step4 = out; }
  else         { step4 = step4.addBands(out); }
}


// -- 5. WETLAND FILTER I - accumulated flood frequency -------------------------
// Pixels flooded for more than 240 months across the monthly series: vegetation
// classes fall back to wetland (11), while water bodies (33) are preserved.
var maskFreq = freqAlagado.select('class').gt(240)
  .remap([1],[100], 0).toByte().selfMask();

var step5;
for (var i = 0; i < ANOS_STR.length; i++) {
  var ano  = ANOS_STR[i];
  var base = step4.select('classification_' + ano);
  var corr = base.add(maskFreq)
    .remap(
      [3, 4, 11, 12, 19, 21, 25, 29, 33, 103, 104, 111, 112, 119, 121, 125, 129, 133],
      [3, 4, 11, 12, 19, 21, 25, 29, 33,  12,  12,  11,  12,  12,  12,  12,  12,  33]
    ).rename('classification_' + ano);
  var out = base.blend(corr).rename('classification_' + ano);
  if (i === 0) { step5 = out; }
  else         { step5 = step5.addBands(out); }
}


// -- 6. WETLAND FILTER II - NDDI confirmation from the S2 mosaics --------------
// The wet-season NDDI is computed per year from the S2 mosaics. Values below the
// thresholds indicate wet grassland (11) or open water (33).
// The resulting annual mask goes through the same mode filter as stage 4, and
// where at least two years confirm wet grassland the main series is reclassified.

// 6a. Annual maximum-flood mask from the NDDI
var maskMaxAll;
for (var i = 0; i < ANOS_INT.length; i++) {
  var anoInt = ANOS_INT[i];
  var anoStr = ANOS_STR[i];

  var mos    = colMos.filter(ee.Filter.eq('year', anoInt)).mosaic();
  var mosIdx = addIndex.get(mos);

  var nddiWet  = mosIdx.normalizedDifference(['ndvi_median_wet', 'ndwi_median_wet'])
                       .add(1).multiply(1000);
  var cheiaMax = nddiWet.lt(LIMIAR_CAMPO_ALAGADO).selfMask(); // wet grassland
  var aguaMax  = nddiWet.lt(LIMIAR_AGUA).selfMask();          // open water

  // Background 21, then 11 where wet grassland, then 33 where water (most restrictive)
  var maskAnual = ee.Image(21)
    .blend(cheiaMax.remap([1],[11]).blend(aguaMax.remap([1],[33])))
    .rename('classification_' + anoStr)
    .clip(geometry);

  if (i === 0) { maskMaxAll = maskAnual; }
  else         { maskMaxAll = maskMaxAll.addBands(maskAnual); }
}

// 6b. Same mode filter as stage 4, applied to the NDDI mask
var maskMaxWithConn = maskMaxAll.addBands(
  maskMaxAll.connectedPixelCount(100, true).rename(connNames_ee)
);
var maskMaxFiltered;
for (var i = 0; i < ANOS_STR.length; i++) {
  var ano  = ANOS_STR[i];
  var base = maskMaxWithConn.select('classification_' + ano);
  var conn = maskMaxWithConn.select('classification_' + ano + '_conn');
  var moda = base.focal_mode(3, 'square', 'pixels').mask(conn.lte(MIN_CONNECT_PIXEL));
  var out  = base.blend(moda).rename('classification_' + ano);
  if (i === 0) { maskMaxFiltered = out; }
  else         { maskMaxFiltered = maskMaxFiltered.addBands(out); }
}

// 6c. Count how many years the pixel was detected as wet grassland (11)
var somaWetland = ee.ImageCollection(
  ANOS_STR.map(function(ano) {
    return maskMaxFiltered.select('classification_' + ano).eq(11).rename('class');
  })
).sum();

// 6d. Two confirmed years or more: apply the wetland reclassification to the series
var maskNddi = somaWetland.gt(1).remap([1],[100], 0).toByte().selfMask();

var finalBands;
for (var i = 0; i < ANOS_STR.length; i++) {
  var ano  = ANOS_STR[i];
  var base = step5.select('classification_' + ano);
  var corr = base.add(maskNddi)
    .remap(
      [3, 4, 11, 12, 19, 21, 25, 29, 33, 103, 104, 111, 112, 119, 121, 125, 129, 133],
      [3, 4, 11, 12, 19, 21, 25, 29, 33,  12,  12,  11,  12,  12,  12,  25,  29,  33]
    ).rename('classification_' + ano);
  var out = base.blend(corr).rename('classification_' + ano);
  if (i === 0) { finalBands = out; }
  else         { finalBands = finalBands.addBands(out); }
}


// -- 7. VISUAL CHECK -----------------------------------------------------------
ANOS_STR.forEach(function(ano) {
  Map.addLayer(integratedBands.select('classification_' + ano), vis, 'Input  ' + ano, false);
  Map.addLayer(finalBands.select('classification_'     + ano), vis, 'Output ' + ano, false);
});


// -- 8. METADATA E EXPORT ------------------------------------------------------
var finalOutput = finalBands.toByte().set({
  territory:         'BRAZIL',
  biome:             BIOME,
  source:            'arcplan',
  version:           VERSION_OUT,
  collection_id:     COL_VERSION,
  description:       DESCRIPTION,
  temporal_coverage: START_YEAR + '-' + END_YEAR
});

Export.image.toAsset({
  image:            finalOutput,
  description:      ASSET_PREFIX_OUT + VERSION_OUT,
  assetId:          DIR_ASSETS + '/' + ASSET_PREFIX_OUT + VERSION_OUT,
  scale:            SCALE,
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
