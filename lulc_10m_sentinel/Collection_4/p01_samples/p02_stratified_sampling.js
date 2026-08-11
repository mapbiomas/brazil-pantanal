/**
 * ==============================================================================
 * p02 | Stratified sampling of the stable pixels
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Turns the two reference maps from p01 into point tables the classifier can
 *   consume. Both are sampled with the same quotas so that the two sources stay
 *   comparable downstream.
 *   
 *   Allocation is stratified twice: by class and by sub-region. STRATA_ALLOCATION
 *   holds one row per region, with one quota per class in the order of
 *   CLASS_VALUES. Regions where a class does not occur get zero, so no synthetic
 *   samples are invented for it.
 *   
 *   Before sampling, the Sentinel map has every deforestation alert footprint
 *   removed. The Landsat map is not alert-masked: the three-collection agreement
 *   already excludes pixels that changed.
 *
 * INPUTS
 *   - PANT_amostras_estaveis_landsat_2015a2025_col11_v1 (from p01)
 *   - PANT_amostras_estaveis_sentinel_2017a2024_col3_v1 (from p01)
 *   - MapBiomas deforestation alerts 2019-2025
 *   - Operational regions, exact boundaries (regions_t)
 *
 * OUTPUTS
 *   - samples_stable91011_v{VERSION_OUT}_regs (Landsat-derived points)
 *   - samples_stable_v{VERSION_OUT}_regs (Sentinel-derived points)
 *
 * NOTES
 *   - Quota constants: N_PR = primary class in that region, N_SE = secondary,
 *     N_RA = rare, ZERO = class not sampled there.
 *   - The source repeated the whole sampling block once per input map, with the
 *     same variable names declared twice; it is now one function called twice.
 *
 * PIPELINE
 *   p01 samples | step 2 of 5  ->  p03_extract_training_bands
 * ==============================================================================
 */

// ---------------------------------------------------------------------
// USER PARAMETERS
// ---------------------------------------------------------------------
var VERSION_OUT = '2';
var DIR_OUT = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/SAMPLES/PANTANAL/';

// Target legend categories evaluated during stratified sampling allocations
var CLASS_VALUES = [3, 4, 12, 19, 21, 25, 29, 33];

// Sample allocation schemas per class hierarchy (Primary, Secondary, Rare, Omitted)
var N_PR1 = 2500; var N_SE1 = 1000; var N_RA1 = 500;  var ZERO1 = 0;
var N_PR2 = 1500; var N_SE2 = 800;  var N_RA2 = 300;

// Stratified distribution profile assigned per sub-region ID
var STRATA_ALLOCATION = {
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

// ---------------------------------------------------------------------
// INPUT DATA
// ---------------------------------------------------------------------
var ASSET_REGIONS     = 'projects/ee-arcplan-df/assets/col11/regions_t';
var ASSET_ALERTS      = 'projects/ee-arcplan-df/assets/col11/alertas_19-25';
var ASSET_STABLE_91011 = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/SAMPLES/PANTANAL/PANT_amostras_estaveis_landsat_2015a2025_col11_v1';

var ASSET_STABLE_BASE = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/SAMPLES/PANTANAL/PANT_amostras_estaveis_sentinel_2017a2024_col3_v1';

// Ingest vector layers and baseline imagery
var regionsCollection = ee.FeatureCollection(ASSET_REGIONS);
var alertsCollection  = ee.FeatureCollection(ASSET_ALERTS);
var imgStableBase     = ee.Image(ASSET_STABLE_BASE);
var imgStable91011     = ee.Image(ASSET_STABLE_91011);

// Setup visualization context
var palettes = require('users/mapbiomas/modules:Palettes.js');
var visParamsOriginal = {'min': 0, 'max': 69, 'palette': palettes.get('classification9')};

// ---------------------------------------------------------------------
// FEATURE ENGINEERING
// ---------------------------------------------------------------------

// Every deforestation alert recorded in the Pantanal up to the end of the series.
// An alerted pixel is by definition not stable, whatever the collections say.
var historicalAlerts = alertsCollection
    .filter(ee.Filter.lt('ANODETEC', 2026))
    .filter(ee.Filter.eq('BIOMA', 'Pantanal'));

// Convert alert geometries to raster masks aligned with the baseline projection grid
var historicalAlertsRaster = ee.Image().byte().paint(historicalAlerts, 27).rename('reference');
var alignedAlertsRaster = historicalAlertsRaster.reproject({
    crs: imgStableBase.projection(),
    scale: 10
});

var historicalAlertsMask = alignedAlertsRaster.unmask().neq(27);
var cleanedStableImg = imgStableBase.updateMask(historicalAlertsMask);

// Visual verification layers
Map.addLayer(imgStableBase, visParamsOriginal, 'Raw Stable Pixels Base', false);
Map.addLayer(cleanedStableImg, visParamsOriginal, 'Cleaned Stable Pixels (No Alerts)', false);

// ---------------------------------------------------------------------
// STRATIFIED SAMPLING
// ---------------------------------------------------------------------

/**
 * Draws stratified points from a reference map, region by region, using the
 * per-region and per-class quotas declared in STRATA_ALLOCATION.
 *
 * Sampling region by region rather than biome-wide is what keeps a class that is
 * abundant in one part of the Pantanal from swamping the regions where it is rare.
 *
 * @param {ee.Image} referenceImage - single-band 'reference' map of stable pixels.
 * @return {ee.FeatureCollection} points carrying 'reference' and 'id_reg'.
 */
var sampleByRegion = function(referenceImage) {
    var perRegion = Object.keys(STRATA_ALLOCATION).map(function(regId) {
        var subRegionBoundary = regionsCollection.filter(ee.Filter.eq('id_reg', regId));
        var pointsDistribution = STRATA_ALLOCATION[regId];

        var stratifiedPoints = referenceImage.stratifiedSample({
            'numPoints': 0,
            'classBand': 'reference',
            'region': subRegionBoundary,
            'classValues': CLASS_VALUES,
            'classPoints': pointsDistribution,
            'scale': 10,
            'seed': 1,
            'geometries': true
        });

        return stratifiedPoints.map(function(feature) {
            return feature.set('id_reg', regId);
        });
    });

    return ee.FeatureCollection(perRegion).flatten();
};

// Landsat cross-collection map: not alert-masked, because the three-collection
// agreement already excludes pixels that changed.
var samplesLandsat = sampleByRegion(imgStable91011);

// Sentinel persistence map: alert-masked before sampling.
var samplesSentinel = sampleByRegion(cleanedStableImg);

print('Landsat stable sample count:', samplesLandsat.size());
print('Sentinel stable sample count:', samplesSentinel.size());

// ---------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------
Export.table.toAsset({
    'collection': samplesLandsat,
    'description': 'samples_stable91011_v' + VERSION_OUT + '_regs',
    'assetId': DIR_OUT + 'samples_stable91011_v' + VERSION_OUT + '_regs'
});

Export.table.toAsset({
    'collection': samplesSentinel,
    'description': 'samples_stable_v' + VERSION_OUT + '_regs',
    'assetId': DIR_OUT + 'samples_stable_v' + VERSION_OUT + '_regs'
});

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias - ArcPlan - mariana@arcplan.com.br
 * MapBiomas Collection 4 (10 m) | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
