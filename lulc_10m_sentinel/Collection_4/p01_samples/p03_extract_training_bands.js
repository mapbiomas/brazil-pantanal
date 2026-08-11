/**
 * ==============================================================================
 * p03 | Extract the predictor values at the sample points
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Reads the values the Random Forest will actually learn from.
 *   
 *   The predictor stack has four sources, assembled in createAnnualComposite:
 *     - Google AlphaEarth annual satellite embeddings, 64 bands (A00-A63);
 *     - Sentinel-2 mosaic bands plus the indices computed by the ArcPlan module;
 *     - terrain, from MERIT DEM and Geomorpho90m;
 *     - scaled longitude and latitude, which let the model learn regional context.
 *   
 *   Sampling is batched region by region: a single biome-wide sampleRegions call
 *   over this many bands at 10 m exceeds the Earth Engine memory limit.
 *   
 *   Run the script twice, once per point table, switching ASSET_STABLE_POINTS and
 *   OUTPUT_PREFIX together.
 *
 * INPUTS
 *   - samples_stable91011_v2_regs or samples_stable_v2_regs (from p02)
 *   - Sentinel-2 mosaics (mapbiomas-mosaics and nexgenmap, mosaics-3)
 *   - GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL
 *   - MERIT DEM and Geomorpho90m (aspect, convergence, roughness, eastness,
 *     northness, dxx, cti)
 *
 * OUTPUTS
 *   - {OUTPUT_PREFIX}{VERSION_OUT}_{year}_all_regions (one table per year)
 *
 * NOTES
 *   - INCLUDE_TOPOGRAPHY and INCLUDE_COORDINATES switch the ancillary blocks off
 *     if a lighter table is needed.
 *
 * PIPELINE
 *   p01 samples | step 3 of 5  ->  p04_clean_outliers
 * ==============================================================================
 */

// ---------------------------------------------------------------------
// USER PARAMETERS
// ---------------------------------------------------------------------
var VERSION_OUT = '1';
var DIR_OUT = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/SAMPLES/PANTANAL/trained/';

var YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

var REGIONS_LIST = ['reg0', 'reg1', 'reg2', 'reg3', 'reg4', 'reg5', 'reg6', 'reg7', 'reg8'];

// Toggles for optional ancillary datasets (Topography and Coordinates)
var INCLUDE_TOPOGRAPHY = true;
var INCLUDE_COORDINATES = true;

// ---------------------------------------------------------------------
// INPUT DATA
// ---------------------------------------------------------------------
// Point table to extract. Run this script once per source, switching the constant
// and the OUTPUT_PREFIX below: the two sources feed different classes in p02.
//   samples_stable91011_v2_regs -> Landsat-derived  -> pontos_trained_stable91011_
//   samples_stable_v2_regs      -> Sentinel-derived -> pontos_trained_stable_
var ASSET_STABLE_POINTS = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/SAMPLES/PANTANAL/samples_stable91011_v2_regs';
var OUTPUT_PREFIX = 'pontos_trained_stable91011_v';

var ASSET_REGIONS = 'projects/ee-arcplan-df/assets/col11/regions_buffer';

var regionsCollection = ee.FeatureCollection(ASSET_REGIONS);
Map.addLayer(regionsCollection, {color: '#D2DE2CFF'}, 'Operational Regions Boundary', false);
var processingRoi = regionsCollection.geometry().bounds();

// Base Sentinel-2 Mosaic configuration
var bandsSentinel = [
  "blue_median", "blue_median_wet", "blue_median_dry", "blue_stdDev", "green_median",
  "green_median_dry", "green_median_wet", "green_median_texture", "green_min", "green_stdDev",
  "red_median", "red_median_dry", "red_min", "red_median_wet", "red_stdDev", "nir_median",
  "nir_median_dry", "nir_median_wet", "nir_stdDev", "red_edge_1_median", "red_edge_1_median_dry",
  "red_edge_1_median_wet", "red_edge_1_stdDev", "red_edge_2_median", "red_edge_2_median_dry",
  "red_edge_2_median_wet", "red_edge_2_stdDev", "red_edge_3_median", "red_edge_3_median_dry",
  "red_edge_3_median_wet", "red_edge_3_stdDev", "red_edge_4_median", "red_edge_4_median_dry",
  "red_edge_4_median_wet", "red_edge_4_stdDev", "swir1_median", "swir1_median_dry",
  "swir1_median_wet", "swir1_stdDev", "swir2_median", "swir2_median_wet", "swir2_median_dry", "swir2_stdDev"
];

var mosaicAsset1 = ee.ImageCollection('projects/mapbiomas-mosaics/assets/SENTINEL/BRAZIL/mosaics-3');
var mosaicAsset2 = ee.ImageCollection('projects/nexgenmap/MapBiomas2/SENTINEL/mosaics-3').select(bandsSentinel);
var unifiedMosaics = mosaicAsset1.merge(mosaicAsset2);
var annualEmbeddings = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL');

// Ancillary variables definitions (MERIT DEM & Geomorpho90m)
var demImg = ee.Image('MERIT/DEM/v1_0_3').select('dem').toInt64().rename('merit_dem');
var aspectImg = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/aspect").mosaic().multiply(10000).round().rename('aspect').toInt64();
var convergenceImg = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/convergence").mosaic().multiply(10000).round().rename('convergence').toInt64();
var roughnessImg = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/roughness").mosaic().multiply(10000).round().rename('roughness').toInt64();
var eastnessImg = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/eastness").mosaic().multiply(10000).round().rename('eastness').toInt64();
var northnessImg = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/northness").mosaic().multiply(10000).round().rename('northness').toInt64();
var dxxImg = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/dxx").mosaic().multiply(10000).round().rename('dxx').toInt64();
var ctiImg = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/cti").mosaic().multiply(10000).round().rename('cti').toInt64();

var lonLatGrid = ee.Image.pixelLonLat();
var customLong = lonLatGrid.select('longitude').add(34.8).multiply(-1).multiply(1000).toInt16().rename('longitude');
var customLati = lonLatGrid.select('latitude').add(5).multiply(-1).multiply(1000).toInt16().rename('latitude');

var addIndexModule = require('users/gee_arcplan/MapBiomas_Col11_Pantanal:processa_Bandas_Indices_Sentinel');
var palettes = require('users/mapbiomas/modules:Palettes.js');
var visParamsEmbedding = { bands: ['A01', 'A25', 'A50'], max: 0.214, min: -0.236 };

// ---------------------------------------------------------------------
// FEATURE ENGINEERING
// ---------------------------------------------------------------------

/**
 * Builds a multi-band master composite layer for a target year by joining
 * spectral indexes, topography descriptors, coordinates, and neural embeddings.
 */
function createAnnualComposite(year) {
  var dateStart = ee.Date.fromYMD(year, 1, 1);

  var baseMosaic = unifiedMosaics.filterBounds(processingRoi).filter(ee.Filter.eq('year', year)).mosaic();
  var indexedMosaic = addIndexModule.get(baseMosaic);

  var embeddingMosaic = annualEmbeddings.filterDate(dateStart, dateStart.advance(1, 'year'))
                                       .filterBounds(processingRoi)
                                       .median();

  var masterStack = embeddingMosaic.addBands(indexedMosaic);

  if (INCLUDE_TOPOGRAPHY) {
    masterStack = masterStack.addBands([demImg, aspectImg, convergenceImg, roughnessImg, eastnessImg, northnessImg, dxxImg, ctiImg]);
  }
  if (INCLUDE_COORDINATES) {
    masterStack = masterStack.addBands([customLong, customLati]);
  }

  return masterStack;
}

/**
 * Server-side Map-Reduce routine to scale regions sampling without client-side loops.
 */
function performBatchSampling(targetImage, samplePointsCollection, yearValue) {
  var regionalExtractions = REGIONS_LIST.map(function(regionId) {
    var localizedPoints = samplePointsCollection.filter(ee.Filter.eq('id_reg', regionId));

    var sampledFeatures = targetImage.sampleRegions({
      collection: localizedPoints,
      scale: 10,
      tileScale: 16,
      geometries: true
    });

    return sampledFeatures.map(function(feature) {
      return feature.set({'year': yearValue, 'region': regionId});
    });
  });

  return ee.FeatureCollection(regionalExtractions).flatten();
}

// ---------------------------------------------------------------------
// EXTRACTION
// ---------------------------------------------------------------------
// One export task per year. Each task builds the composite once and samples all
// nine regions from it.
YEARS.forEach(function(currentYear) {
  print('Processing Composite and Batch Extraction for Year: ' + currentYear);

  // The heavy mosaic and the embeddings are built exactly once per year.
  var masterComposite = createAnnualComposite(currentYear);
  Map.addLayer(masterComposite, visParamsEmbedding, 'Sentinel-2 Embeddings Master Stack ' + currentYear, false);

  var stablePointsBase = ee.FeatureCollection(ASSET_STABLE_POINTS);

  var extractedSamples = performBatchSampling(masterComposite, stablePointsBase, currentYear);

  var outputAssetName = OUTPUT_PREFIX + VERSION_OUT + '_' + currentYear + '_all_regions';
  var idAsset = DIR_OUT + outputAssetName;

  Export.table.toAsset(extractedSamples, 'Trained_Stable_' + currentYear + '_all_regions', idAsset);
});

// ---------------------------------------------------------------------
// POST-PROCESSING
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// EXPORTS

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias - ArcPlan - mariana@arcplan.com.br
 * MapBiomas Collection 4 (10 m) | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
