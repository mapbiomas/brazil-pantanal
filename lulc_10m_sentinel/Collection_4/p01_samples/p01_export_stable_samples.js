/**
 * ==============================================================================
 * p01 | Stable samples from Landsat and from Sentinel
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Builds the two reference maps that Collection 4 trains on. They are produced
 *   by different criteria on purpose, and both are used downstream.
 *   
 *   RUN_LANDSAT compares Collections 9, 10.1 and 11 pixel by pixel and keeps only
 *   where all three agree; the result is coarse (30 m) but very reliable, and it
 *   reaches back far enough to anchor the classes that change slowly.
 *   
 *   RUN_SENTINEL requires the same class in all eight years of Sentinel
 *   Collection 3; it is native 10 m, so it carries the fine spatial detail that
 *   the Landsat branch cannot.
 *   
 *   Each branch can be run on its own with the toggles at the top.
 *
 * INPUTS
 *   - MapBiomas Landsat Collections 9, 10.1 and 11 (Pantanal)
 *   - MapBiomas Sentinel Collection 3 integration
 *   - Operational regions, buffered (regions_buffer)
 *
 * OUTPUTS
 *   - PANT_amostras_estaveis_landsat_2015a2025_col11_v{VERSION_OUT} (30 m)
 *   - PANT_amostras_estaveis_sentinel_2017a2024_col3_v{VERSION_OUT} (10 m)
 *
 * NOTES
 *   - CLASS_FROM / CLASS_TO collapse the full MapBiomas legend into the eight
 *     classes modelled here: 3, 4, 12, 19, 21, 25, 29, 33.
 *   - The two branches use different remap tables: the Landsat one folds wetland
 *     (11) into grassland (12), since 11 is reinserted later in p03.
 *
 * PIPELINE
 *   p01 samples | step 1 of 5  ->  p02_stratified_sampling
 * ==============================================================================
 */

// ---------------------------------------------------------------------
// USER PARAMETERS
// ---------------------------------------------------------------------
var VERSION_OUT = '1';

// Execution toggles to select processing lines
var RUN_LANDSAT = true;
var RUN_SENTINEL = true;

// Asset output destination directories
var DIR_OUT_LANDSAT = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/SAMPLES/PANTANAL/';
var DIR_OUT_SENTINEL = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/SAMPLES/PANTANAL/';

// Complete temporal scope allocations
var YEARS_LANDSAT = [
    '2015','2016','2017','2018','2019','2020','2021','2022','2023','2024','2025'
];

var YEARS_SENTINEL = ['2017','2018','2019','2020','2021','2022','2023','2024'];

// Reclassification matrices for training taxonomy standardization
var CLASS_FROM_LANDSAT = [3, 4, 5, 6, 7, 9, 11, 12, 15, 18, 19, 20, 36, 39, 40, 41, 21, 22, 23, 24, 25, 26, 29, 30, 31, 32, 33];
var CLASS_TO_LANDSAT   = [3, 4, 3, 3, 4, 3, 12, 12, 21, 19, 19, 19, 19, 19, 19, 19, 21, 25, 25, 25, 25, 33, 29, 25, 12, 12, 33];

var CLASS_FROM_SENTINEL = [3, 4, 5, 9, 11, 12, 13, 15, 18, 19, 20, 36, 39, 40, 41, 21, 22, 23, 24, 25, 26, 29, 30, 31, 32, 33];
var CLASS_TO_SENTINEL   = [3, 4, 3, 3, 12, 12, 13, 21, 19, 19, 21, 21, 21, 19, 19, 21, 25, 25, 25, 25, 33, 29, 25, 12, 12, 33];

// Temporal frequency constraints (minimum matching years required for structural persistence)
var FREQUENCY_LANDSAT = {
    "3": 11, "4": 11, "12": 11, "19": 11, "21": 11, "25": 11, "29": 11, "33": 11
};

var FREQUENCY_SENTINEL = {
    "3": 8, "4": 8, "12": 8, "19": 8, "21": 8, "25": 8, "29": 8, "33": 8
};

// ---------------------------------------------------------------------
// INPUT DATA
// ---------------------------------------------------------------------
var ASSET_REGS_VECTOR = 'projects/ee-arcplan-df/assets/col11/regions_buffer';
var ASSET_COL11 = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/PANT_col11_Anual_v39';
var ASSET_COL10_1 = 'projects/mapbiomas-public/assets/brazil/lulc/collection10_1/mapbiomas_brazil_collection10_1_coverage_v1';
var ASSET_COL9    = 'projects/mapbiomas-public/assets/brazil/lulc/collection9/mapbiomas_collection90_integration_v1';
var ASSET_S2_COL3  = 'projects/mapbiomas-public/assets/brazil/lulc_10m/collection3/mapbiomas_10m_collection3_integration_v1';

// Ingest vector boundaries and extract the processing region of interest (ROI)
var biomasVector = ee.FeatureCollection(ASSET_REGS_VECTOR);
var pantanalVector = biomasVector.filter(ee.Filter.eq('id_reg', 'reg0'));

// Processing extent: the buffered reg0 polygon, which already covers the whole
// biome plus the surrounding plateau strip.
var processingRegion = pantanalVector.geometry();

// Load visualization kits
var palettes = require('users/mapbiomas/modules:Palettes.js');
var visParamsRef = { min: 0, max: 62, palette: palettes.get('classification8') };

// Render the biome edge outline for quality assurance oversight
var blankCanvas = ee.Image(0).mask(0);
var biomeOutline = blankCanvas.paint(pantanalVector, 'AA0000', 2);
Map.addLayer(biomeOutline, {palette: '000000', opacity: 0.6}, 'Biome Boundary (Pantanal)', false);

// ---------------------------------------------------------------------
// FEATURE ENGINEERING
// ---------------------------------------------------------------------

/**
 * Generates a single categorical layer indicating where pixel persistence passes a threshold.
 * Optimized to run completely server-side without mixing JavaScript and Engine environments.
 */
var getFrequencyMask = function(collection, classId, frequencyThresholdMap) {
    var classIdInt = ee.Number.parse(classId);

    var maskCollection = collection.map(function(image) {
        return image.eq(classIdInt);
    });

    var frequency = maskCollection.reduce(ee.Reducer.sum());
    var frequencyMask = frequency.gte(ee.Number(frequencyThresholdMap[classId]))
        .multiply(classIdInt)
        .toByte();

    return frequencyMask.mask(frequencyMask.eq(classIdInt))
                        .rename('frequency')
                        .set('class_id', classIdInt);
};

// ---------------------------------------------------------------------
// BRANCH 1: LANDSAT CROSS-COLLECTION AGREEMENT (30 m)
// ---------------------------------------------------------------------
// A pixel is kept only where Collections 9, 10.1 and 11 all agree, year by year,
// after the legend has been normalised. Agreement between three independent model
// runs is a far stronger signal than persistence inside any single one of them.
// ---------------------------------------------------------------------
if (RUN_LANDSAT) {
    var classCol11   = ee.Image(ASSET_COL11).clip(processingRegion);
    var classCol10 = ee.Image(ASSET_COL10_1).clip(processingRegion);
    var classCol9   = ee.Image(ASSET_COL9).clip(processingRegion);

    // Compare the three collections year by year.
    var crossCollectionBands = YEARS_LANDSAT.map(function (yearString) {
        var bandName = 'classification_' + yearString;
        var yearNum = ee.Number.parse(yearString);

        var img11 = classCol11.select(bandName);
        var reclass11 = img11.remap(CLASS_FROM_LANDSAT, CLASS_TO_LANDSAT, 0);

        // Years beyond the reach of an older collection fall back to Collection 11.
       var img10 = ee.Algorithms.If(yearNum.lte(2024), classCol10.select(bandName), img11);
        var img9 = ee.Algorithms.If(yearNum.lte(2023), classCol9.select(bandName), img11);


        var reclass10 = ee.Image(img10).remap(CLASS_FROM_LANDSAT, CLASS_TO_LANDSAT, 0);
        var reclass9 = ee.Image(img9).remap(CLASS_FROM_LANDSAT, CLASS_TO_LANDSAT, 0);

        var matchMatrix = reclass11.eq(reclass10).and(reclass10.eq(reclass9));
        return reclass11.mask(matchMatrix).selfMask().int8().rename('classification');
    });

    var annualLandsatCollection = ee.ImageCollection.fromImages(crossCollectionBands);

    // Then require the agreed class to persist for FREQUENCY_LANDSAT years.
    var landsatMasks = Object.keys(FREQUENCY_LANDSAT).map(function(classId) {
        return getFrequencyMask(annualLandsatCollection, classId, FREQUENCY_LANDSAT);
    });

    var referenceMapLandsat = ee.ImageCollection.fromImages(landsatMasks)
        .reduce(ee.Reducer.firstNonNull())
        .clip(processingRegion);

    referenceMapLandsat = referenceMapLandsat.mask(referenceMapLandsat.neq(27)).rename("reference");
    Map.addLayer(referenceMapLandsat, visParamsRef, 'Stable Training Pixels Landsat (2015-2024)', true);
}

// ---------------------------------------------------------------------
// BRANCH 2: SENTINEL-2 TEMPORAL PERSISTENCE (10 m)
// ---------------------------------------------------------------------
// Only one 10 m collection exists, so here stability means persistence: the pixel
// must hold the same class in all eight years of Sentinel Collection 3.
// ---------------------------------------------------------------------
if (RUN_SENTINEL) {
    var classSentinel = ee.Image(ASSET_S2_COL3)
        .clip(processingRegion);

    var remappedSentinelList = YEARS_SENTINEL.map(function(yearString) {
        var image = classSentinel.select('classification_' + yearString);
        return image.remap(CLASS_FROM_SENTINEL, CLASS_TO_SENTINEL, 0).int8();
    });

    var annualSentinelCollection = ee.ImageCollection.fromImages(remappedSentinelList);

    var sentinelMasks = Object.keys(FREQUENCY_SENTINEL).map(function(classId) {
        return getFrequencyMask(annualSentinelCollection, classId, FREQUENCY_SENTINEL);
    });

    var referenceMapSentinel = ee.ImageCollection.fromImages(sentinelMasks)
        .reduce(ee.Reducer.firstNonNull())
        .clip(processingRegion);

    referenceMapSentinel = referenceMapSentinel.mask(referenceMapSentinel.neq(27)).rename("reference");
    Map.addLayer(referenceMapSentinel, visParamsRef, 'Stable Training Pixels Sentinel (2017-2024)', true);
}

// ---------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------
if (RUN_LANDSAT) {
    var outputNameLandsat = 'PANT_amostras_estaveis_landsat_2015a2025_col11_v' + VERSION_OUT;
    Export.image.toAsset({
        image: referenceMapLandsat.toInt8(),
        description: outputNameLandsat,
        assetId: DIR_OUT_LANDSAT + outputNameLandsat,
        scale: 30,
        pyramidingPolicy: { '.default': 'mode' },
        maxPixels: 1e13,
        region: processingRegion
    });
}

if (RUN_SENTINEL) {
    var outputNameSentinel = 'PANT_amostras_estaveis_sentinel_2017a2024_col3_v' + VERSION_OUT;
    Export.image.toAsset({
        image: referenceMapSentinel.toInt8(),
        description: outputNameSentinel,
        assetId: DIR_OUT_SENTINEL + outputNameSentinel,
        scale: 10,
        pyramidingPolicy: { '.default': 'mode' },
        maxPixels: 1e13,
        region: processingRegion
    });
}

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias - ArcPlan - mariana@arcplan.com.br
 * MapBiomas Collection 4 (10 m) | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
