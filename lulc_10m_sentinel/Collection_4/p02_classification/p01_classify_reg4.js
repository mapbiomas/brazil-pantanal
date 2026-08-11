/**
 * ==============================================================================
 * p01 | Regional classification - region 4
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Annual land use and land cover classification for Region 4 - Caceres.
 *   
 *   One Random Forest is trained per year on the predictor stack described in
 *   p01/p03, restricted to the bands this region actually needs. Training draws
 *   on two independent sample tables and assigns classes between them
 *   deliberately: the Sentinel-derived table supplies the classes whose value
 *   lies in fine spatial detail, the Landsat-derived table supplies those that
 *   need a longer record to be reliable.
 *   
 *   Per-class quotas are regional, so a class that dominates one part of the
 *   Pantanal cannot swamp the regions where it is scarce, and the agricultural
 *   quota grows through the series to follow real expansion.
 *   
 *   This region also trains on hand-drawn polygons stored in the imports
 *   block, used to reinforce classes the automatic sampling misses here.
 *
 * INPUTS
 *   - Sentinel-2 mosaics (mapbiomas-mosaics and nexgenmap, mosaics-3)
 *   - GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL
 *   - MERIT DEM and Geomorpho90m terrain layers
 *   - pontos_trained_stable_cleaned_v{samplesVersion}_reg4_trained
 *   - pontos_trained_stable91011_cleaned_v{samplesVersion}_reg4_trained
 *   - Hand-drawn reinforcement polygons (imports block)
 *
 * OUTPUTS
 *   - PANT_col4_reg4_v{outputVersion} (one band per year, 2017-2025)
 *
 * NOTES
 *   - Set flagCollectionSamples to true to preview targetedYearsList on the map
 *     without queueing an export.
 *   - The year ladders were inherited from the 1985-2025 Landsat pipeline; the
 *     branches that could never fire in a 2017-2025 series have been collapsed,
 *     leaving the same values per year.
 *
 * PIPELINE
 *   p02 classification | region 4 of 0-8  ->  p02_merge_regions_gapfill
 * ==============================================================================
 */

/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var MANUAL_SAMPLES_SAVANNA = /* color: #d63000 */ee.FeatureCollection(
        [ee.Feature(
            ee.Geometry.Polygon(
                [[[-58.05149427385758, -16.70488576034625],
                  [-58.05415511229684, -16.710804871439407],
                  [-58.049605936911796, -16.71039382799327],
                  [-58.04883343544858, -16.70669439708865]]]),
            {
              "reference": 4,
              "system:index": "0"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.885596232749265, -16.471591116811698],
                  [-57.88450182131025, -16.475068831512292],
                  [-57.88222716221632, -16.47338142742884],
                  [-57.884823707025824, -16.47175574376851]]]),
            {
              "reference": 4,
              "system:index": "1"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.896806152927866, -16.404984634199423],
                  [-57.89912358151673, -16.40432594132223],
                  [-57.898093613255014, -16.405931501304487]]]),
            {
              "reference": 4,
              "system:index": "2"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.89611950742005, -16.400744259786475],
                  [-57.89646283017396, -16.39917982648241],
                  [-57.897063644993295, -16.4004560756488],
                  [-57.89624825345277, -16.402020498696416]]]),
            {
              "reference": 4,
              "system:index": "3"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.91375771390199, -16.406425517095606],
                  [-57.91259899960755, -16.406260845304583],
                  [-57.912041100132456, -16.404861129454765],
                  [-57.91418686734437, -16.406260845304583]]]),
            {
              "reference": 4,
              "system:index": "4"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.89526120053529, -16.409101414167992],
                  [-57.894359978306284, -16.4084427352261],
                  [-57.89521828519105, -16.407166538430733],
                  [-57.895819100010385, -16.408319232676245]]]),
            {
              "reference": 4,
              "system:index": "5"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.9228557668805, -16.41120093841273],
                  [-57.921267899143686, -16.41120093841273],
                  [-57.92092457638978, -16.409760090879963],
                  [-57.92264119015931, -16.410459932442993]]]),
            {
              "reference": 4,
              "system:index": "6"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.9338420950055, -16.40197932982992],
                  [-57.932812126743784, -16.400785428914183],
                  [-57.935558708775034, -16.4004560756488],
                  [-57.934528740513315, -16.402555693168367]]]),
            {
              "reference": 4,
              "system:index": "7"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.96151080316566, -16.859195241173463],
                  [-57.965630676212534, -16.858045253631285],
                  [-57.963914062443, -16.861002350321762]]]),
            {
              "reference": 4,
              "system:index": "8"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.9664889830973, -16.86478079544618],
                  [-57.96339907831214, -16.864287959061176],
                  [-57.96477236932777, -16.861330913765585],
                  [-57.966832305851206, -16.862809442195807]]]),
            {
              "reference": 4,
              "system:index": "9"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.967347289982065, -16.881043675003504],
                  [-57.96494403070472, -16.874965792964627],
                  [-57.96751895135902, -16.872830274462085],
                  [-57.9694072265055, -16.881043675003504]]]),
            {
              "reference": 4,
              "system:index": "10"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-58.02920915869123, -16.581741136229773],
                  [-58.03453066137678, -16.57729897495357],
                  [-58.030067465575996, -16.58733482306948]]]),
            {
              "reference": 4,
              "system:index": "11"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.97153093603498, -16.62582813537235],
                  [-57.97753908422834, -16.627144009649715],
                  [-57.972904227050606, -16.632571895642517]]]),
            {
              "reference": 4,
              "system:index": "12"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.96672441748029, -16.57614728677478],
                  [-57.952476523193184, -16.575818231743728],
                  [-57.966896078857246, -16.568907946168434]]]),
            {
              "reference": 4,
              "system:index": "13"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.976680777343574, -16.602469865867658],
                  [-57.97221758154279, -16.593750910607568],
                  [-57.97874071386701, -16.60066030390452]]]),
            {
              "reference": 4,
              "system:index": "14"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-58.02268602636701, -16.60395040389045],
                  [-58.01976778295881, -16.600989316437904],
                  [-58.02371599462873, -16.598850724903034],
                  [-58.026119253906074, -16.601976350658454]]]),
            {
              "reference": 4,
              "system:index": "15"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-58.036075613769356, -16.56824981079841],
                  [-58.03727724340803, -16.56430095134984],
                  [-58.03899385717756, -16.571046870587114],
                  [-58.03676225927717, -16.571046870587114]]]),
            {
              "reference": 4,
              "system:index": "16"
            })]);
/***** End of imports. If edited, may not auto-convert in the playground. *****/

// ---------------------------------------------------------------------
// USER PARAMETERS
// ---------------------------------------------------------------------
var flagCollectionSamples = false;
var includeTopography = true;
var includeCoordinates = true;

// Manual polygon sampling configuration parameters
var flagManualPolygons = true;
var manualPolygonsAsset = MANUAL_SAMPLES_SAVANNA;
var manualSamplesLimit = 350;

// Define the list of years for targeted analysis execution
var targetedYearsList = [2023];

// Target analysis geometry limits and metadata configuration
var targetBiome = 'PANTANAL';
var targetRegion = '4';
var outputVersion = '1';
var randomSeed = 1;

// Output asset and input sample directories updated for Collection 4 (10m Sentinel)
var outputDirectory = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan/';
var samplesDirectory = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/SAMPLES/PANTANAL/trained/';

var samplesVersion = 5;
var processingVersionPt = samplesVersion;
var randomForestTrees = 200;

// Fewer trees while collecting samples interactively; the map is only a preview.
if (flagCollectionSamples) {
    randomForestTrees = 20;
}

// Define maximum sample allocations for stable training databases (Region 4 - Preserving Legacy Balance)
var samplesForestLimit       = 1000;
var samplesSavannaLimit      = 2000;
var samplesGrasslandLimit    = 200;
var samplesAgricultureLimitBase = 500;
var samplesWaterLimit        = 900;
var samplesNonVegetatedLimit = 200;

// Define sample thresholds for complementary datasets (Region 4 - Preserving Legacy Balance)
var compCaveLimit      = 1;
var compSavannaLimit   = 2000;
var compGrasslandLimit = 550;
var compForestLimit    = 500;
var compAgroLimit      = 10;
var compWaterLimit     = 1;
// Region 4 excludes class 19 entirely, preserving the Collection 10 behaviour.
//       There is no compStrictAgricLimit here.

// Optimal spatial resolution scale for Sentinel data extraction
var samplingScale = 10;

// Chronological timeline scope constrained by Sentinel-2 data availability
var historicalYearsArray = [
    2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025
];

if (flagCollectionSamples) {
    historicalYearsArray = targetedYearsList;
}

// ---------------------------------------------------------------------
// INPUT DATA
// ---------------------------------------------------------------------
// Pantanal biome mask, used for on-screen reference only.
var biomesRaster = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-raster-41_old');
var pantanalBiomeMask = biomesRaster.mask(biomesRaster.eq(3));
Map.addLayer(pantanalBiomeMask, {}, 'Pantanal Biome Boundary', false);

// Published Landsat maps, loaded only for side-by-side visual checking.
var assetCollection10 = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection10_1/mapbiomas_brazil_collection10_1_coverage_v1')
                          .mask(pantanalBiomeMask);
var rawImageCollection10 = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-10/GENERAL/classification-pan/PANT_col10_Anual_4');

// Import visualization modules
var palettesModule = require('users/mapbiomas/modules:Palettes.js');
var visualizationParams = {
    'min': 0,
    'max': 62,
    'palette': palettesModule.get('classification7')
};

// Define explicit model classification features
// A00-A63: Google Satellite Embedding bands (fixed across all regions)
// The spectral block below is inherited from region 0. Replace it with the
//       bands ranked highest for region 4 in the feature-importance run (p01/p05).
var bandNamesList = ee.List([
      'A00','A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22',
      'A23','A24','A25','A26','A27','A28','A29','A30','A31','A32','A33','A34','A35','A36','A37','A38','A39','A40','A41','A42','A43','A44','A45',
      'A46','A47','A48','A49','A50','A51','A52','A53','A54','A55','A56','A57','A58','A59','A60','A61','A62','A63',
      'latitude','longitude',
      'red_edge_3_median_wet','merit_dem','red_edge_1_median','ndci_median_wet','tgsi_median','red_edge_2_median_wet','ireci_median_wet','gari_median_wet',
      'tgsi_median_wet','roughness','red_edge_4_median','iia_median_wet','spri_median_dry','cvi_median_wet','green_median','msavi_median_wet',
      'red_edge_4_median_wet','brightness_median_wet','evi_median_wet','iia_median','ndvi_median_wet','evi2_median_wet','hallheight_median','spri_median',
      'spri_median_wet','avi_median','wetness_median','cvi_median','red_edge_1_median_wet','red_edge_2_median','swir1_median','hallcover_median_wet',
      'red_median_wet','red_median','rvi_median_wet','brba_median_wet','ireci_median','red_edge_3_median','hallcover_median_dry','osavi_median_wet',
      'cai_median_wet','gcvi_median_wet','nir_median_dry','lswi_median_wet','red_edge_3_median_dry','avi_median_dry','avi_median_wet','sfdvi_median_wet',
      'gcvi_median','hallheight_median_wet',

]);

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

// Terrain indices derived from MERIT DEM & Geomorpho90m datasets
var demImage         = ee.Image('MERIT/DEM/v1_0_3').select('dem').toInt64().rename('merit_dem');
var aspectImage      = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/aspect").mosaic().multiply(10000).round().rename('aspect').toInt64();
var convergenceImage = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/convergence").mosaic().multiply(10000).round().rename('convergence').toInt64();
var roughnessImage   = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/roughness").mosaic().multiply(10000).round().rename('roughness').toInt64();
var eastnessImage    = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/eastness").mosaic().multiply(10000).round().rename('eastness').toInt64();
var northnessImage   = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/northness").mosaic().multiply(10000).round().rename('northness').toInt64();
var dxxImage         = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/dxx").mosaic().multiply(10000).round().rename('dxx').toInt64();
var ctiImage         = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/cti").mosaic().multiply(10000).round().rename('cti').toInt64();

// Generate coordinate bands dynamically on-the-fly
var lonLatGrid      = ee.Image.pixelLonLat();
var customLongitude = lonLatGrid.select('longitude').add(34.8).multiply(-1).multiply(1000).toInt16().rename('longitude');
var customLatitude  = lonLatGrid.select('latitude').add(5).multiply(-1).multiply(1000).toInt16().rename('latitude');

var addIndexModule = require('users/gee_arcplan/MapBiomas_Col11_Pantanal:processa_Bandas_Indices_Sentinel');
var palettes = require('users/mapbiomas/modules:Palettes.js');
var visParamsEmbedding = { bands: ['A01', 'A25', 'A50'], max: 0.214, min: -0.236 };

// Load regional administrative operational zones
var pantanalRegionsFC = ee.FeatureCollection('projects/ee-arcplan-df/assets/col11/regions_buffer');
var selectedRegionId = 'reg' + targetRegion;
var regionFilterLimit = pantanalRegionsFC.filter(ee.Filter.eq('id_reg', selectedRegionId));
var analysisGeometry = regionFilterLimit.geometry();
Map.addLayer(regionFilterLimit, {}, 'Target Analysis Region', false);

var processingROI = analysisGeometry.bounds();

// ---------------------------------------------------------------------
// FEATURE ENGINEERING
// ---------------------------------------------------------------------
/**
 * Compiles the annual multi-spectral feature stack by combining Sentinel mosaics,
 * specialized vegetation/water indices, topography, and annual satellite embeddings.
 * @param {number} year - The operational calendar year for analysis.
 * @return {ee.Image} Master feature stack for the Random Forest classifier.
 */
function createAnnualComposite(year) {
  var dateStart = ee.Date.fromYMD(year, 1, 1);

  var baseMosaic    = unifiedMosaics.filterBounds(processingROI).filter(ee.Filter.eq('year', year)).mosaic();
  var indexedMosaic = addIndexModule.get(baseMosaic);

  var embeddingMosaic = annualEmbeddings.filterDate(dateStart, dateStart.advance(1, 'year'))
                                         .filterBounds(processingROI)
                                         .median();

  var masterStack = embeddingMosaic.addBands(indexedMosaic);

  if (includeTopography) {
    masterStack = masterStack.addBands([demImage, aspectImage, convergenceImage, roughnessImage, eastnessImage, northnessImage, dxxImage, ctiImage]);
  }
  if (includeCoordinates) {
    masterStack = masterStack.addBands([customLongitude, customLatitude]);
  }

  return masterStack;
}

// ---------------------------------------------------------------------
// TRAINING
// ---------------------------------------------------------------------
var classifiedTimeSeriesImage;

/**
 * Shuffles a FeatureCollection pseudo-randomly using a reproducible seed value.
 * @param {ee.FeatureCollection} collection - Input feature collection to randomize.
 * @param {number} seed - Deterministic randomizer seed.
 * @return {ee.FeatureCollection} Shuffled collection with randomized structural order.
 */
var shuffleCollection = function(collection, seed) {
    return collection.randomColumn('random', seed || 1).sort('random', true);
};

// Core timeline loop executing annual classifications sequentially
for (var yearIndex = 0; yearIndex < historicalYearsArray.length; yearIndex++) {
    var operationalYear = historicalYearsArray[yearIndex];

    var finalRegionalImage = createAnnualComposite(operationalYear)
                                                 .select(bandNamesList)
                                                 .clip(analysisGeometry);

    // Dynamic adjustment of training allocation parameters (Region 4 progression - Preserving Legacy Balance)
    var currentSamplesAgricultureLimit = samplesAgricultureLimitBase;
    if (operationalYear <= 2000)      { currentSamplesAgricultureLimit = 1000; }
    else if (operationalYear == 2001) { currentSamplesAgricultureLimit = 1100; }
    else if (operationalYear == 2002) { currentSamplesAgricultureLimit = 1100; }
    else if (operationalYear == 2003) { currentSamplesAgricultureLimit = 1200; }
    else if (operationalYear == 2004) { currentSamplesAgricultureLimit = 1200; }
    else if (operationalYear == 2005) { currentSamplesAgricultureLimit = 1300; }
    else if (operationalYear == 2006) { currentSamplesAgricultureLimit = 1400; }
    else if (operationalYear == 2007) { currentSamplesAgricultureLimit = 1500; }
    else if (operationalYear == 2008) { currentSamplesAgricultureLimit = 1600; }
    else if (operationalYear == 2009) { currentSamplesAgricultureLimit = 1700; }
    else if (operationalYear == 2010) { currentSamplesAgricultureLimit = 1800; }
    else if (operationalYear == 2011) { currentSamplesAgricultureLimit = 1900; }
    else if (operationalYear == 2012) { currentSamplesAgricultureLimit = 2000; }
    else if (operationalYear == 2013) { currentSamplesAgricultureLimit = 2100; }
    else if (operationalYear == 2014) { currentSamplesAgricultureLimit = 2200; }
    else if (operationalYear == 2015) { currentSamplesAgricultureLimit = 2300; }
    else if (operationalYear == 2016) { currentSamplesAgricultureLimit = 2400; }
    else if (operationalYear == 2017) { currentSamplesAgricultureLimit = 2500; }
    else if (operationalYear == 2018) { currentSamplesAgricultureLimit = 2600; }
    else if (operationalYear == 2019) { currentSamplesAgricultureLimit = 2700; }
    else if (operationalYear == 2020) { currentSamplesAgricultureLimit = 2800; }
    else if (operationalYear >= 2021 && operationalYear <= 2022) { currentSamplesAgricultureLimit = 2900; }
    else if (operationalYear >= 2023) { currentSamplesAgricultureLimit = 3000; }

    if (flagCollectionSamples) {
        Map.addLayer(finalRegionalImage, {
            bands: ['swir1_median', 'nir_median_dry', 'red_median'],
            gain: [0.08, 0.06, 0.2],
            gamma: 0.85
        }, 'Sentinel Mosaic Asset ' + operationalYear, false);
    }

    // Two independent sample sources. Which one feeds which class is deliberate:
    // the Sentinel table carries fine spatial detail, the Landsat table carries
    // classes that need a longer record to be reliable.
    var samplesSentinel = ee.FeatureCollection(samplesDirectory + 'pontos_trained_stable_cleaned_v2_' + selectedRegionId + '_trained')
                                             .filter(ee.Filter.eq('year', operationalYear));
    var samplesLandsat  = ee.FeatureCollection(samplesDirectory + 'pontos_trained_stable91011_cleaned_v2_' + selectedRegionId + '_trained')
                                             .filter(ee.Filter.eq('year', operationalYear));

    // Split the pool by class. (Region 4 source mapping)
    var classForestSamples    = samplesLandsat.filter(ee.Filter.eq("reference", 3));
    var classSavannaSamples   = samplesSentinel.filter(ee.Filter.eq("reference", 4));
    var classGrasslandSamples = samplesSentinel.filter(ee.Filter.eq("reference", 12));
    var classAgroSamples      = samplesLandsat.filter(ee.Filter.eq("reference", 21));
    var classWaterSamples     = samplesSentinel.filter(ee.Filter.eq("reference", 33));
    var classNonVegSamples    = samplesSentinel.filter(ee.Filter.eq("reference", 25));

    // Shuffle, then cap each class at its regional quota. (Region 4 constraints)
    classForestSamples    = shuffleCollection(classForestSamples,    randomSeed).limit(samplesForestLimit);
    classSavannaSamples   = shuffleCollection(classSavannaSamples,   randomSeed).limit(samplesSavannaLimit);
    classGrasslandSamples = shuffleCollection(classGrasslandSamples, randomSeed).limit(samplesGrasslandLimit);
    classAgroSamples      = shuffleCollection(classAgroSamples,      randomSeed).limit(currentSamplesAgricultureLimit);
    classWaterSamples     = shuffleCollection(classWaterSamples,     randomSeed).limit(samplesWaterLimit);
    classNonVegSamples    = shuffleCollection(classNonVegSamples,    randomSeed).limit(samplesNonVegetatedLimit);

    if (flagCollectionSamples) {
       print('Sample pool sizes for ' + operationalYear, {
         'Forest':    classForestSamples.size(),
         'Savanna':   classSavannaSamples.size(),
         'Grassland': classGrasslandSamples.size(),
         'Agro':      classAgroSamples.size(),
         'Water':     classWaterSamples.size()
       });
    }

    // Merge the balanced stable pools.
    var unifiedStablePoints = classForestSamples.merge(classSavannaSamples).merge(classGrasslandSamples)
                                                 .merge(classAgroSamples).merge(classWaterSamples).merge(classNonVegSamples);

    // Isolate, shuffle, and parameterize regional complementary vector maps (Region 4 constraints)
    // Region 4 excludes class 19 entirely, as Collection 10 did.
    var compCavePoints      = shuffleCollection(samplesLandsat.filter(ee.Filter.eq('reference', 12)), randomSeed).limit(compCaveLimit);
    var compSavannaPoints   = shuffleCollection(samplesLandsat.filter(ee.Filter.eq('reference', 4)),  randomSeed).limit(compSavannaLimit);
    var compGrasslandPoints = shuffleCollection(samplesLandsat.filter(ee.Filter.eq('reference', 12)), randomSeed).limit(compGrasslandLimit);
    var compForestPoints    = shuffleCollection(samplesSentinel.filter(ee.Filter.eq('reference', 3)), randomSeed).limit(compForestLimit);
    var compAgroPoints      = shuffleCollection(samplesSentinel.filter(ee.Filter.eq('reference', 21)),randomSeed).limit(compAgroLimit);
    var compWaterPoints     = shuffleCollection(samplesLandsat.filter(ee.Filter.eq('reference', 33)), randomSeed).limit(compWaterLimit);

    // Merge the complementary pools (no class 19 in this region).
    var unifiedComplementaryPoints = compCavePoints.merge(compSavannaPoints).merge(compGrasslandPoints)
                                                     .merge(compForestPoints).merge(compAgroPoints).merge(compWaterPoints);

    // Final training pool for this year.
    var masterPointsPool = unifiedStablePoints.merge(unifiedComplementaryPoints);
    masterPointsPool = masterPointsPool.filterBounds(analysisGeometry);

    // Read the predictor values at every training point.
    var trainingSamples = finalRegionalImage.select(bandNamesList).sampleRegions({
        collection: masterPointsPool,
        properties: ['reference'],
        scale: samplingScale,
        geometries: false
    });

    // ------------------------------------------------------------------------------
    // MANUAL POLYGON SAMPLES
    // ------------------------------------------------------------------------------
    if (flagManualPolygons) {
        try {
            var manualPolygonsFC = ee.FeatureCollection(manualPolygonsAsset)
                                     .filterBounds(analysisGeometry);
                                     // Uncomment if the polygons are year-specific:
                                     // .filter(ee.Filter.eq('ano', operationalYear));

            // Burn the polygons into a raster whose pixel value is the class id.
            var manualPolygonsImg = manualPolygonsFC.reduceToImage({
                properties: ['reference'],
                reducer: ee.Reducer.first()
            }).rename('reference').toByte();

            // Draw pixels at random inside the polygons, at Sentinel-2 resolution.
            var manualTrainingSamples = finalRegionalImage.select(bandNamesList)
                .addBands(manualPolygonsImg)
                .sample({
                    region: manualPolygonsFC.geometry(),
                    scale: samplingScale,
                    numPixels: manualSamplesLimit,
                    seed: randomSeed,
                    geometries: false
                });

            // Merge the manual signatures into the training pool.
            trainingSamples = trainingSamples.merge(manualTrainingSamples);

            if (flagCollectionSamples) {
                print('Manual polygon samples extracted for ' + operationalYear);
            }
        } catch(error) {
            print('Error executing manual polygon calculations for operational year: ' + operationalYear, error);
        }
    }

    // Train the model for this year.
    var spatialClassifierModel = ee.Classifier.smileRandomForest({
        numberOfTrees: randomForestTrees,
        variablesPerSplit: 1
    }).train(trainingSamples, 'reference', bandNamesList);

    // ---------------------------------------------------------------------
    // CLASSIFICATION
    // ---------------------------------------------------------------------
    // Classify the year.
     var col11 = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/PANT_col11_Anual_v39')
    var cols2 = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-3/GENERAL/classification-pan-ft/pant_s2Emb_final_v16')

    var annuallyClassifiedImage = finalRegionalImage.classify(spatialClassifierModel);
    annuallyClassifiedImage = annuallyClassifiedImage
                                .select(['classification'], ['classification_' + operationalYear])
                                .clip(analysisGeometry)
                                .toByte();

    if (flagCollectionSamples) {
         Map.addLayer(annuallyClassifiedImage, visualizationParams, 'RF Output ' + operationalYear, false);
        Map.addLayer(col11.select('classification_' + operationalYear), visualizationParams, 'Col11 ' + operationalYear, false);
    Map.addLayer(cols2.select('classification_' + operationalYear), visualizationParams, 'Col S2 v1 ' + operationalYear, false);
  }

    // Stack the year into the multi-band time series.
    if (yearIndex === 0) {
        classifiedTimeSeriesImage = annuallyClassifiedImage;
    } else {
        classifiedTimeSeriesImage = classifiedTimeSeriesImage.addBands(annuallyClassifiedImage);
    }
}

// ---------------------------------------------------------------------
// POST-PROCESSING
// ---------------------------------------------------------------------
// MapBiomas metadata required by the national integration step.
classifiedTimeSeriesImage = classifiedTimeSeriesImage
    .set('territory', 'BRAZIL')
    .set('biome', 'PANTANAL')
    .set('source', 'arcplan')
    .set('version', outputVersion)
    .set('collection_id', 4.0);

// ---------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------
if (flagCollectionSamples) {
    print('Sample collection mode. Band structure:', classifiedTimeSeriesImage.bandNames());
} else {
    Export.image.toAsset({
        "image": classifiedTimeSeriesImage,
        "description": 'PANT_col4_reg' + targetRegion + '_v' + outputVersion,
        "assetId": outputDirectory + 'PANT_col4_reg' + targetRegion + '_v' + outputVersion,
        "scale": samplingScale,
        "pyramidingPolicy": {
            '.default': 'mode'
        },
        "maxPixels": 1e13,
        "region": analysisGeometry,
        "overwrite": true
    });
}

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias - ArcPlan - mariana@arcplan.com.br
 * MapBiomas Collection 4 (10 m) | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
