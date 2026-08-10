/**
 * ==============================================================================
 * p07 | Reinsert water and wetland
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Puts the flooded surface back into the annual map.
 *   
 *   The annual classification cannot represent seasonal flooding: a pixel that is
 *   under water for four months and dry grassland for eight is mapped as
 *   grassland. This step reads the monthly water and wetland classifications and
 *   uses them to decide, per year, which grassland and savanna pixels should
 *   become wetland (11), flooded savanna (7) or open water (33).
 *   
 *   Four years (1985, 1986, 1992 and 1995) had too little clear imagery for the
 *   monthly product to detect the flood, and are filled from their neighbours.
 *
 * INPUTS
 *   - PANT_col11_Anual_v{VERSION_IN} (from p06)
 *   - Monthly water and wetland classifications 1985-2025
 *   - MapBiomas Water collection 5
 *
 * OUTPUTS
 *   - PANT_col11_Anual_v{VERSION_OUT} (one band per year, 1985-2025)
 *
 * NOTES
 *   - Only grassland (12) and savanna (4) pixels are eligible: flooding does not
 *     reclassify forest or cropland in this legend.
 *
 * PIPELINE
 *   p03 post-classification | step 7 of 9  ->  p08_consistency_rules
 * ==============================================================================
 */

/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var REGIONS_BUFFER_FC = ee.FeatureCollection("projects/ee-arcplan-df/assets/col11/regions_buffer");
/***** End of imports. If edited, may not auto-convert in the playground. *****/

// ==============================================================================
// 1. PARAMETERS AND CONSTANTS
// ==============================================================================

var geometry = REGIONS_BUFFER_FC;
var VERSION_IN = '34';
var VERSION_OUT = '35';
var COLLECTION_ID = 11.0;
var DIR_OUT = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/';
var DESCRIPTION = 'Water and wetland reinserted - Col 11';
var PREFIX_OUT = 'PANT_col11_Anual_v';

// Define the full temporal scope for Collection 11 (1985 to 2025)
var years = [];
for (var y = 1985; y <= 2025; y++) years.push(y.toString());

// Import the MapBiomas palettes module
var palettes = require('users/mapbiomas/modules:Palettes.js');

// Define standard visualization parameters
var visClassification = {
    'min': 0,
    'max': 62,
    'palette': palettes.get('classification7')
};

// ==============================================================================
// 2. ASSETS
// ==============================================================================

// Base Collection 11 asset
var baseCollection = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/PANT_col11_Anual_v' + VERSION_IN);
// --- 2b. Monthly water and wetland classifications ---
// Monthly water and wetland classifications, one asset per year.
var MONTHLY_DIR = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/';
var MONTHLY_VERSION = 'v2';

var monthlyAssets = [];
for (var wy = 1985; wy <= 2025; wy++) {
    monthlyAssets.push(MONTHLY_DIR + 'class_mensal_RF_' + wy + '_' + MONTHLY_VERSION);
}
var water_col = ee.ImageCollection(monthlyAssets);

// MapBiomas Water collection, used as an independent source of permanent water.
var mbWater = ee.Image('projects/mapbiomas-brazil/assets/WATER/COLLECTION-5/mapbiomas_brazil_collection5_water_annual_v4').clip(geometry);

// ==============================================================================
// 3. REINSERT WATER AND WETLAND, YEAR BY YEAR
// ------------------------------------------------------------------------------
// Water and wetland are mapped monthly, so a pixel that is flooded for part of the
// year is annual grassland or savanna in the yearly classification. Here the
// monthly product decides where those pixels become wetland (11), flooded savanna
// (7) or open water (33).
// ==============================================================================

var MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
var processedImages = years.map(function(year) {
    var bandName = 'classification_' + year;

    var baseCorrected = baseCollection.select(bandName)
     var imgAnoAlagag= ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/mensal/class_mensal_RF_'+year+'_v2')

    // Months classified as open water, and months classified as wetland.
    var waterMonths = MONTHS.map(function(m) {
        return imgAnoAlagag.select('classification_' + year + '_' + m).eq(33).selfMask().rename('class');
    });
    var wetlandMonths = MONTHS.map(function(m) {
        return imgAnoAlagag.select('classification_' + year + '_' + m).eq(11).selfMask().rename('class');
    });

    // colAguaAno counts water OR wetland months; colAguaAno2 counts water only.
    var colAguaAno = ee.ImageCollection(waterMonths.concat(wetlandMonths)).sum();
    var colAguaAno2 = ee.ImageCollection(waterMonths).sum();
    // Only grassland and savanna pixels are eligible: flooding does not turn
    // forest or cropland into wetland in this legend.
    var maskGrassland = baseCorrected.mask(baseCorrected.eq(12)).selfMask();
    var maskSavna = baseCorrected.mask(baseCorrected.eq(4)).selfMask();

    var floodedArea1 = colAguaAno.gt(1).mask(maskSavna).selfMask().remap([1], [7]).rename(bandName);
    var floodedArea2 = colAguaAno.gt(1).mask(maskGrassland).selfMask().remap([1], [11]).rename(bandName);
    var waterArea = colAguaAno2.gt(1).mask(maskGrassland).selfMask().remap([1], [33]).rename(bandName);
    var mbWaterArea = mbWater.select('classification_' + year).selfMask().remap([1], [33]).rename(bandName);

    // Blended in order of increasing precedence: flooded savanna, wetland,
    // water from the monthly product, then MapBiomas Water on top.
    return baseCorrected
        .blend(floodedArea1)
        .blend(floodedArea2)
        .blend(waterArea)
        .blend(mbWaterArea)
        .rename(bandName);
});

// Convert the List of Images into a single multi-band Image
var annualClassification = ee.ImageCollection.fromImages(processedImages).toBands()
    .rename(years.map(function(y) { return 'classification_' + y; }));

// ==============================================================================
// 4. SPECIFIC YEAR CORRECTIONS (1985, 1986, 1992, 1995)
// ------------------------------------------------------------------------------
// Four years where cloud cover left the monthly product too sparse to detect the
// flood. Where the surrounding years are wetland, the year is filled in from them.
// ==============================================================================
var applyTemporalFix = function(img, yearToFix, yearA, yearB, yearC, yearD) {
    var mask = img.select('classification_' + yearA).eq(11)
        .and(img.select('classification_' + yearB).eq(11));

    // Apply additional conditions if yearC and yearD are provided
    if (yearC && yearD) {
        mask = mask.and(img.select('classification_' + yearC).eq(11))
                   .and(img.select('classification_' + yearD).eq(11));
    }

    mask = mask.remap([1], [100], 0).toByte().selfMask();

    var correctedYear = img.select('classification_' + yearToFix).add(mask)
        .remap([3, 4,7, 11, 12, 21, 19, 29, 25, 33, 103, 104, 107,111, 112, 119, 121, 129, 125, 133],
               [3, 4,7, 11, 12, 21, 19, 29, 25, 33,   3,   4, 7, 11,  11,  19,  21,  29,  25,  33]);

    return img.select('classification_' + yearToFix).blend(correctedYear.rename('classification_' + yearToFix));
};

// 5.1 Apply direct temporal fixes
var corrected1985 = applyTemporalFix(annualClassification, '1985', '1987', '1988');
var corrected1992 = applyTemporalFix(annualClassification, '1992', '1991', '1993');
var corrected1995 = applyTemporalFix(annualClassification, '1995', '1994', '1996');

// 5.2 Fix 1986 using the recently corrected 1985 as a reference
var tempFor86 = annualClassification.addBands(corrected1985, null, true);
var corrected1986 = applyTemporalFix(tempFor86, '1986', '1987', '1985', '1988', '1989');

// ==============================================================================
// 5. FINAL ASSEMBLY AND EXPORT
// ==============================================================================
// Overwrite the original bands with the specifically corrected ones
var finalExportImage = annualClassification
    .addBands(corrected1985, null, true)
    .addBands(corrected1986, null, true)
    .addBands(corrected1992, null, true)
    .addBands(corrected1995, null, true)
    .toByte();

// Set required MapBiomas metadata properties
finalExportImage = finalExportImage
    .set('territory', 'BRAZIL')
    .set('biome', 'PANTANAL')
    .set('source', 'arcplan')
    .set('version', VERSION_OUT)
    .set('collection_id', COLLECTION_ID)
    .set('description', DESCRIPTION);

print('Final image prepared for export:', finalExportImage);

Export.image.toAsset({
    "image": finalExportImage,
    "description": PREFIX_OUT + VERSION_OUT,
    "assetId": DIR_OUT + PREFIX_OUT + VERSION_OUT,
    "scale": 30,
    "pyramidingPolicy": { '.default': 'mode' },
    "maxPixels": 1e13,
    "region": geometry
});

// ==============================================================================
// 6. VISUALIZATION
// ==============================================================================
Map.addLayer(baseCollection.select('classification_2023'), visClassification, '2023 before', false);
Map.addLayer(finalExportImage.select('classification_2023'), visClassification, '2023 after', true);

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias — ArcPlan — mariana@arcplan.com.br
 * MapBiomas Collection 11 | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
