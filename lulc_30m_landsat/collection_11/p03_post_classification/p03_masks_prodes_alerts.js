/**
 * ==============================================================================
 * p03 | External masks: PRODES, deforestation alerts and flood frequency
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Brings independent datasets in to correct false positives that the classifier
 *   cannot resolve from spectral information alone.
 *   
 *   Three rules are applied year by year:
 *     A. PRODES: anthropogenic classes mapped where deforestation was never
 *        reported, or inside areas that cannot be pasture, revert to natural cover;
 *     B. MapBiomas alerts: from 2019 on, an alerted pixel is forced to
 *        anthropogenic use from its detection year onwards;
 *     C. flood frequency: pasture and agriculture mapped on ground that is under
 *        water for most of the series become grassland or savanna.
 *   
 *   Flood frequency is computed here from the monthly water and wetland
 *   classifications, counting how many months out of 492 each pixel was flooded.
 *
 * INPUTS
 *   - PANT_col11_Anual_31 (from p02)
 *   - PRODES accumulated deforestation to 2000 and yearly increments
 *   - MapBiomas deforestation alerts 2019-2025
 *   - Non-pasture mask
 *   - Monthly water and wetland classifications 1985-2025
 *
 * OUTPUTS
 *   - PANT_col11_Anual_v{VERSION_OUT} (one band per year, 1985-2025)
 *
 * NOTES
 *   - The original script carried this processing block three times, differing
 *     only in which masks were active and in the flood threshold. It is now a
 *     single block driven by USE_PRODES and FLOOD_FREQ_THRESHOLD.
 *
 * PIPELINE
 *   p03 post-classification | step 3 of 9  ->  p04_spatial_filter
 * ==============================================================================
 */

// ==============================================================================
// 1. PARAMETERS AND CONSTANTS
// ==============================================================================
var START_YEAR = 1985;
var END_YEAR = 2025; // Updated temporal scope for Collection 11
var YEARS = ee.List.sequence(START_YEAR, END_YEAR);


var DIR_OUT = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/';
var PREFIX_OUT = 'PANT_col11_Anual_v';
var VERSION_OUT = '32';

// ------------------------------------------------------------------------------
// Rule switches. The production run (v32) uses PRODES with its yearly increments
// and a flood threshold of 120 months. Two alternatives were tested during
// development and are reachable from here instead of being duplicated in code:
//   USE_PRODES = false                -> rely on the non-pasture mask alone;
//   FLOOD_FREQ_THRESHOLD = 80         -> a more permissive flood correction.
// ------------------------------------------------------------------------------
var USE_PRODES = true;
var FLOOD_FREQ_THRESHOLD = 120;

// Palette module
var palettes = require('users/mapbiomas/modules:Palettes.js');
var VIS_PARAMS = { min: 0, max: 62, palette: palettes.get('classification8') };

// ==============================================================================
// 2. ASSET DEFINITIONS
// ==============================================================================
var ASSET_MOSAICS = 'projects/nexgenmap/MapBiomas2/LANDSAT/BRAZIL/mosaics-2';
// Update to the base classification collection 11 asset
var BASE_CLASS_IMAGE = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/PANT_col11_Anual_31');
var BIOMES = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-raster-41_old');

// Masks and Features
var PRODES_2000 = ee.FeatureCollection('users/gee_arcplan/col9/accumulated_deforestation_2000');
var PRODES_INC = ee.FeatureCollection('users/gee_arcplan/col9/prodes_pos2000');
var ALERTS = ee.FeatureCollection('projects/ee-arcplan-df/assets/col11/alertas_19-25');
var MASK_NON_PASTURE = ee.FeatureCollection('users/gee_arcplan/col8/mask_sem_pasto');
// --- 2b. Historical water frequency over the whole series ---
var water_col = ee.ImageCollection([
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_1985_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_1986_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_1987_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_1988_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_1989_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_1990_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_1991_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_1992_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_1993_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_1994_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_1995_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_1996_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_1997_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_1998_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_1999_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2000_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2001_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2002_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2003_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2004_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2005_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2006_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2007_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2008_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2009_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2010_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2011_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2012_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2013_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2014_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2015_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2016_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2017_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2018_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2019_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2020_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2021_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2022_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2023_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2024_v2',
  'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_2025_v2',
  ]
  );

// Count the months classified as water or wetland in each year, then sum over the
// whole series: the result is how many months out of 492 a pixel was under water.
var FLOOD_FREQ = water_col
  .map(function(img) { return img.neq(0).reduce(ee.Reducer.sum()); })
  .sum().rename('freq_historica').selfMask();

Map.addLayer(FLOOD_FREQ, {}, 'Historical flood frequency (months)', false);

// Biome geometry context
var pantanalMask = BIOMES.mask(BIOMES.eq(3));
var geometry = pantanalMask.geometry();
Map.addLayer(pantanalMask, {}, 'Biome Pantanal', false);

MASK_NON_PASTURE = ee.Image(1).mask(pantanalMask).clip(MASK_NON_PASTURE);
// ==============================================================================
// 3. BASE MASKS PREPARATION
// ==============================================================================

// Areas that cannot physically be pasture (protected areas, water bodies, and so on).
var maskNonPasture = MASK_NON_PASTURE.neq(0).remap([1], [1], 0).toByte().selfMask();

// PRODES deforestation accumulated up to 2000.
var maskProdes2000 = PRODES_2000.reduceToImage(['year'], 'mean')
                                .neq(0).remap([1], [100], 0).toByte().selfMask();

var baseProdesMask = maskNonPasture.blend(maskProdes2000).eq(1).selfMask();

// Pixels flooded for at least FLOOD_FREQ_THRESHOLD months over the series.
var floodMask = FLOOD_FREQ.select(0).gte(FLOOD_FREQ_THRESHOLD)
                          .remap([1], [100], 0).toByte().selfMask();

// ==============================================================================
// 4. ANNUAL RULE PROCESSING
// ------------------------------------------------------------------------------
// Each rule adds 100 to the pixel value inside its mask, so 121 means "class 21
// under this mask". The remap table then decides what that combination becomes.
// ==============================================================================

var correctedCol = ee.ImageCollection(YEARS.map(function(y) {
    var year = ee.Number(y);
    var yearStr = year.format('%04d');
    var bandName = ee.String('classification_').cat(yearStr);

    var classImg = BASE_CLASS_IMAGE.select(bandName);

    // --------------------------------------------------------------------------
    // RULE A: PRODES deforestation and non-pasture areas
    // --------------------------------------------------------------------------
    // Anthropogenic classes mapped inside areas that PRODES never reported as
    // deforested, or that cannot be pasture, are pulled back to natural cover.
    var currentMaskA;
    if (USE_PRODES) {
        // PRODES accumulated up to the year being processed.
        var incImage = PRODES_INC.filter(ee.Filter.lte('year', year))
                                 .reduceToImage(['year'], 'mean')
                                 .neq(0).remap([1], [100], 0).toByte().selfMask();

        currentMaskA = ee.Image(ee.Algorithms.If(
            year.lte(2000),
            baseProdesMask,
            baseProdesMask.blend(incImage).eq(1).selfMask()
        ));
    } else {
        currentMaskA = maskNonPasture;
    }

    var prodesApplied = classImg.add(currentMaskA.remap([1], [100]))
        .remap([3, 4, 12, 19, 21, 29, 25, 33, 103, 104, 112, 119, 121, 129, 125, 133],
               [3, 4, 12, 19, 21, 29, 25, 33,   3,   4,  12,  12,  12,  29,  25,  33]);
    classImg = classImg.blend(prodesApplied.rename(bandName));

    // --------------------------------------------------------------------------
    // RULE B: MapBiomas deforestation alerts (2019 onwards)
    // --------------------------------------------------------------------------
    // An alerted pixel is known deforestation: force it to anthropogenic use from
    // the detection year on. Water (33) is left alone.
    var cumulativeAlertsMask = ALERTS.filter(ee.Filter.gte('ANODETEC', 2019))
                                     .filter(ee.Filter.lte('ANODETEC', year))
                                     .reduceToImage(['ANODETEC'], 'mean')
                                     .neq(0).remap([1], [100]).toByte().selfMask();

    var alertsApplied = ee.Image(ee.Algorithms.If(
        year.gte(2019),
        classImg.add(cumulativeAlertsMask)
            .remap([3, 4, 12, 19, 21, 29, 25, 33, 103, 104, 112, 119, 121, 129, 125, 133],
                   [3, 4, 12, 19, 21, 29, 25, 33,  21,  21,  21,  21,  21,  21,  21,  33])
            .rename(bandName),
        classImg
    ));
    classImg = classImg.blend(alertsApplied);

    // --------------------------------------------------------------------------
    // RULE C: flood frequency
    // --------------------------------------------------------------------------
    // Pasture and agriculture cannot persist on ground that floods for most of the
    // series; those pixels are seasonal grassland or savanna misread as pasture.
    var floodApplied = classImg.add(floodMask)
        .remap([3, 4, 12, 19, 21, 29, 25, 33, 103, 104, 112, 119, 121, 129, 125, 133],
               [3, 4, 12, 19, 21, 29, 25, 33,   4,   4,  12,  12,  12,  12,  12,  33]);
    classImg = classImg.blend(floodApplied.rename(bandName));

    return classImg.set('year', year);
}));

// Collapse the collection back into a single multi-band image.
var finalCorrectedImage = correctedCol.toBands().rename(
    YEARS.map(function(y) { return ee.String('classification_').cat(ee.Number(y).format('%04d')); })
);

print('Corrected image:', finalCorrectedImage);

Map.addLayer(BASE_CLASS_IMAGE.select('classification_2025'), VIS_PARAMS, '2025 before masks', false);
Map.addLayer(finalCorrectedImage.select('classification_2025'), VIS_PARAMS, '2025 after masks', true);

// ==============================================================================
// 5. METADATA AND EXPORT
// ==============================================================================

var outputName = PREFIX_OUT + VERSION_OUT;

var exportImage = finalCorrectedImage
    .set('territory', 'BRAZIL')
    .set('biome', 'PANTANAL')
    .set('source', 'arcplan')
    .set('version', VERSION_OUT)
    .set('collection_id', 11.0)
    .set('description', 'PRODES, MapBiomas alerts and flood frequency masks');

Export.image.toAsset({
    image: exportImage.toByte(),
    description: outputName,
    assetId: DIR_OUT + outputName,
    scale: 30,
    pyramidingPolicy: { '.default': 'mode' },
    maxPixels: 1e13,
    region: geometry,
    overwrite: true
});

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias — ArcPlan — mariana@arcplan.com.br
 * MapBiomas Collection 11 | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
