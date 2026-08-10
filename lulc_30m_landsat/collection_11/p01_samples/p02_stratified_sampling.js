/**
 * ==============================================================================
 * p02 | Stratified sampling of the stable pixels
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Turns the stable-pixel rasters produced in p01 into point collections that
 *   the classifier can consume. Sampling is stratified twice over: by class and
 *   by sub-region, so that a class which is common in one part of the Pantanal
 *   does not drown out the regions where it is rare. Allocation per region and
 *   class is declared in STRATA_ALLOCATION.
 *   
 *   Before sampling, every pixel covered by a MapBiomas deforestation alert is
 *   masked out, since an alerted pixel is by definition not stable.
 *   
 *   Two products are exported: one point set from the single-collection stable
 *   map (p01a) and one point set per year from the cross-collection map (p01b).
 *
 * INPUTS
 *   - PANT_amostras_estaveis85a24_col11_v1 (from p01a)
 *   - PANT_amostras_estaveis_col8910_v1 (from p01b)
 *   - MapBiomas deforestation alerts 2019-2025
 *   - Pantanal operational sub-regions (regions_t)
 *
 * OUTPUTS
 *   - samples_stable_v{VERSION_OUT}_regs (one table, all regions)
 *   - samples_stable8910_v{VERSION_OUT}_{year} (one table per year)
 *
 * NOTES
 *   - Allocation constants: N_PR = primary class in that region, N_SE = secondary,
 *     N_RA = rare, ZERO = class not sampled there.
 *
 * PIPELINE
 *   p01 samples | step 2 of 4  ->  p03_extract_training_bands
 * ==============================================================================
 */

/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var limite_mos = 
    /* color: #d63000 */
    /* shown: false */
    ee.Geometry.Polygon(
        [[[-58.52936205752952, -16.48069309590335],
          [-58.57330737002952, -17.101247170160555],
          [-58.32062182315452, -17.478882098612424],
          [-57.96905932315452, -17.656938725904308],
          [-57.77130541690452, -17.897558502926692],
          [-57.67242846377952, -18.273525077010646],
          [-57.94708666690452, -19.23060191352147],
          [-58.24371752627952, -19.71741814896459],
          [-58.29864916690452, -20.274912605306977],
          [-57.99103197940452, -20.96383809400686],
          [-58.07892260440452, -21.578107423128746],
          [-58.10089526065452, -22.230467998199895],
          [-57.41974291690452, -22.26097380469566],
          [-57.32086596377952, -21.88427321684344],
          [-57.11212572940452, -21.49635339908078],
          [-56.98028979190452, -21.056141489602602],
          [-56.82648119815452, -20.45000902167834],
          [-56.38702807315452, -20.48088774020802],
          [-55.89264330752952, -20.50147010055191],
          [-55.65094408877952, -20.50147010055191],
          [-55.10162768252952, -19.44829624235093],
          [-54.68414721377952, -18.482045076276716],
          [-54.68414721377952, -17.792981029318906],
          [-54.80499682315452, -17.048736849002278],
          [-54.82696947940452, -16.522828344097242],
          [-55.06866869815452, -16.217140881812828],
          [-55.50812182315452, -15.847575770994556],
          [-56.00250658877952, -15.604348700492018],
          [-56.71661791690452, -15.93210807445483],
          [-57.29889330752952, -15.805296326997492],
          [-57.95807299502952, -15.535558114006925],
          [-58.973632404627836, -15.897400514355134],
          [-59.290155580858844, -16.315729569211467]]]),
    geometry = 
    /* color: #d63000 */
    /* shown: false */
    ee.Geometry.Polygon(
        [[[-58.52936205752952, -16.48069309590335],
          [-58.57330737002952, -17.101247170160555],
          [-58.32062182315452, -17.478882098612424],
          [-57.96905932315452, -17.656938725904308],
          [-57.77130541690452, -17.897558502926692],
          [-57.67242846377952, -18.273525077010646],
          [-57.94708666690452, -19.23060191352147],
          [-58.24371752627952, -19.71741814896459],
          [-58.29864916690452, -20.274912605306977],
          [-57.99103197940452, -20.96383809400686],
          [-58.07892260440452, -21.578107423128746],
          [-58.10089526065452, -22.230467998199895],
          [-57.41974291690452, -22.26097380469566],
          [-57.32086596377952, -21.88427321684344],
          [-57.11212572940452, -21.49635339908078],
          [-56.98028979190452, -21.056141489602602],
          [-56.82648119815452, -20.45000902167834],
          [-56.38702807315452, -20.48088774020802],
          [-55.89264330752952, -20.50147010055191],
          [-55.65094408877952, -20.50147010055191],
          [-55.10162768252952, -19.44829624235093],
          [-54.68414721377952, -18.482045076276716],
          [-54.68414721377952, -17.792981029318906],
          [-54.80499682315452, -17.048736849002278],
          [-54.82696947940452, -16.522828344097242],
          [-55.06866869815452, -16.217140881812828],
          [-55.50812182315452, -15.847575770994556],
          [-56.00250658877952, -15.604348700492018],
          [-56.71661791690452, -15.93210807445483],
          [-57.29889330752952, -15.805296326997492],
          [-57.95807299502952, -15.535558114006925],
          [-58.973632404627836, -15.897400514355134],
          [-59.290155580858844, -16.315729569211467]]]);
/***** End of imports. If edited, may not auto-convert in the playground. *****/

// ==============================================================================
// 1. PARAMETERS AND CONSTANTS
// ==============================================================================

// Output directory aligned for Collection 11 operational assets
var DIR_OUT = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/';
var VERSION_OUT = '2';

// Input Asset paths (Aligned with production database)
var ASSET_REGIONS = 'projects/ee-arcplan-df/assets/col11/regions_t';
var ASSET_ALERTS = 'projects/ee-arcplan-df/assets/col11/alertas_19-25';
// Written by p01a. The original run of p01a was missing a trailing slash on its
// output directory, so the asset landed one level up with the folder name glued to
// the file name. Re-run p01a with the corrected DIR_OUT and update this path.
var ASSET_STABLE_BASE = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANALPANT_amostras_estaveis85a24_col11_v1';
var ASSET_STABLE_8910  = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/PANT_amostras_estaveis_col8910_v1';
var ASSET_COL10_1     = 'projects/mapbiomas-public/assets/brazil/lulc/collection10_1/mapbiomas_brazil_collection10_1_coverage_v1';

// Full temporal scope extended for Collection 11 taxonomy extraction
var YEARS = [
    '1985','1986','1987','1988','1989','1990','1991','1992','1993','1994','1995','1996','1997','1998','1999',
    '2000','2001','2002','2003','2004','2005','2006','2007','2008','2009','2010','2011','2012','2013','2014',
    '2015','2016','2017','2018','2019','2020','2021','2022','2023','2024','2025'
];

// Target legend categories evaluated during stratified sampling allocations
var CLASS_VALUES = [3, 4, 12, 19, 21, 25, 29, 33];

// Visualization Configurations
var palettes = require('users/mapbiomas/modules:Palettes.js');
var visParamsOriginal = {'min': 0, 'max': 69, 'palette': palettes.get('classification9')};

// ==============================================================================
// 2. GEOMETRY AND REGIONS INITIALIZATION
// ==============================================================================

// Load official operational regions vector asset for Pantanal stratified execution
var regioesCollection = ee.FeatureCollection(ASSET_REGIONS);
print('Pantanal Sub-regions Boundary Collection:', regioesCollection);

// Load baseline MapBiomas image context for inspection
var col10_1 = ee.Image(ASSET_COL10_1);
Map.addLayer(col10_1.select('classification_2023'), visParamsOriginal, 'MapBiomas Baseline Col10.1 (2023)', false);

// Load raw input data assets
var imgStableBase = ee.Image(ASSET_STABLE_BASE);
var imgStable8910  = ee.Image(ASSET_STABLE_8910);

// ==============================================================================
// 3. STRATIFIED SAMPLING MATRIX DEFINITIONS
// ==============================================================================

// Sample allocation schemas per class hierarchy (Main, Secondary, Rare, Omitted)
var N_PR1 = 2500; var N_SE1 = 1000; var N_RA1 = 500;  var ZERO1 = 0;
var N_PR2 = 1500; var N_SE2 = 800; var N_RA2 = 300;

// Stratified distribution profile assigned per sub-region ID
var STRATA_ALLOCATION = {
          //[ 3,      4,     12,    19,   21,    25,    29,    33];
    'reg1': [N_PR2, N_PR2, N_PR2, ZERO1, N_PR2, ZERO1, ZERO1, N_SE2],
    'reg2': [N_SE1, N_SE1, N_PR2, ZERO1, N_SE1, ZERO1, ZERO1, N_SE1],
    'reg3': [N_PR2, N_PR2, N_PR2, ZERO1, N_PR2, ZERO1, ZERO1, N_SE2],
    'reg4': [N_SE2, N_SE1, N_PR2, ZERO1, N_SE2, ZERO1, ZERO1, N_SE2],
    'reg5': [N_SE1, N_PR2, N_PR1, ZERO1, N_SE1, ZERO1, ZERO1, N_RA1],
    'reg6': [N_SE1, N_PR2, N_PR1, N_RA1, N_SE1, ZERO1, ZERO1, N_SE2],
    'reg7': [N_SE1, N_SE2, N_PR1, ZERO1, N_RA1, N_RA1, N_RA1, N_SE2],
    'reg8': [N_SE1, N_SE1, N_PR2, ZERO1, N_PR2, N_RA1, N_RA1, N_RA1],
    'reg0': [N_SE1, N_SE1, N_PR2, ZERO1, N_PR2, ZERO1, ZERO1, N_SE2]
};

// ==============================================================================
// 4. HISTORICAL STABLE SAMPLES (ALERT-CLEANED)
// ==============================================================================

// Load database vector alerts structure
var dbAlertas = ee.FeatureCollection(ASSET_ALERTS);

// Alert footprint: every deforestation alert detected up to the end of the series.
var alertasHistoricos = dbAlertas.filter(ee.Filter.lt('ANODETEC', 2026))
                                 .filter(ee.Filter.eq('BIOMA', 'Pantanal'));

// Convert vectors into raster geometry flags (ID 27 representing structural alert pixels)
var rasterAlertsHist = ee.Image().byte().paint(alertasHistoricos, 27).rename('reference');
rasterAlertsHist = rasterAlertsHist.reproject({crs: imgStableBase.projection(), scale: 30});

// Compute binary persistence mask layer (1 where valid, 0 where alert disrupted)
var maskAlertsHist = rasterAlertsHist.unmask().neq(27);

// Remove alert footprints from the stable base: a pixel flagged by a deforestation
// alert cannot be treated as stable, whatever the collections say.
var imgStableCleaned = imgStableBase.updateMask(maskAlertsHist);

Map.addLayer(maskAlertsHist, {}, 'Alert mask (1 = valid)', false);
Map.addLayer(imgStableBase, visParamsOriginal, 'Stable pixels (raw)', false);
Map.addLayer(imgStableCleaned, visParamsOriginal, 'Stable pixels (alerts removed)', false);

/**
 * Functional Routine: Iterates across the defined regional collection to extract
 * clean stratified spatial sample markers.
 */
var regionalStablePoints = Object.keys(STRATA_ALLOCATION).map(function(regId) {
    var subRegionBoundary = regioesCollection.filter(ee.Filter.eq('id_reg', regId));
    var pointsDistribution = STRATA_ALLOCATION[regId];

    var stratifiedPoints = imgStableCleaned.stratifiedSample({
        'numPoints': 0,
        'classBand': 'reference',
        'region': subRegionBoundary,
        'classValues': CLASS_VALUES,
        'classPoints': pointsDistribution,
        'scale': 30,
        'seed': 1,
        'geometries': true
    });

    return stratifiedPoints.map(function(feature) {
        return feature.set('id_reg', regId);
    });
});

// Flatten mapped regional collections into a unified database feature matrix
var trainingEstavelBase = ee.FeatureCollection(regionalStablePoints).flatten();
print('Historical Base Cleaned Sample Collection Size:', trainingEstavelBase.size());

// Export Historical baseline stable features table to asset storage
Export.table.toAsset({
    'collection': trainingEstavelBase,
    'description': 'samples_stable_v' + VERSION_OUT + '_regs',
    'assetId': DIR_OUT + 'samples_stable_v' + VERSION_OUT + '_regs'
});


/**
 * Main Loop Process: Maps over the expanded multi-year timeline array to filter,
 * clean, extract, and export specialized individual yearly validation training assets.
 */
for (var i_ano = 0; i_ano < YEARS.length; i_ano++) {
    var anoString = YEARS[i_ano];

    // Select accurate historical slice from the cross-collection stability map asset
    var imgAnnualStable = imgStable8910.select('classification_' + anoString).rename('reference');


    // Nested Extraction Strategy across geographic stratum blocks
    var regionalAnnualPoints = Object.keys(STRATA_ALLOCATION).map(function(regId) {
        var subRegionBoundary = regioesCollection.filter(ee.Filter.eq('id_reg', regId));
        var pointsDistribution = STRATA_ALLOCATION[regId];

        var stratifiedPoints = imgAnnualStable.stratifiedSample({
            'numPoints': 0,
            'classBand': 'reference',
            'region': subRegionBoundary,
            'classValues': CLASS_VALUES,
            'classPoints': pointsDistribution,
            'scale': 30,
            'seed': 1,
            'geometries': true
        });

        return stratifiedPoints.map(function(feature) {
            return feature.set('id_reg', regId);
        });
    });

    // Collapse list of arrays down into an optimized FeatureCollection
    var trainingEstavelAnnual = ee.FeatureCollection(regionalAnnualPoints).flatten();

    // Construct uniform identification strings for output tracking
    var taskName = 'samples_stable8910_v' + VERSION_OUT + '_' + anoString;

    // Initialize parallel backend automated processing task routines
    Export.table.toAsset({
        'collection': trainingEstavelAnnual,
        'description': taskName,
        'assetId': DIR_OUT + taskName
    });
}

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias — ArcPlan — mariana@arcplan.com.br
 * MapBiomas Collection 11 | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
