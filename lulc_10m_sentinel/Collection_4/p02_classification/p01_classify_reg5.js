/**
 * ==============================================================================
 * p01 | Regional classification - region 5
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Annual land use and land cover classification for Region 5 - Pocone.
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
 *   - pontos_trained_stable_cleaned_v{samplesVersion}_reg5_trained
 *   - pontos_trained_stable91011_cleaned_v{samplesVersion}_reg5_trained
 *   - Hand-drawn reinforcement polygons (imports block)
 *
 * OUTPUTS
 *   - PANT_col4_reg5_v{outputVersion} (one band per year, 2017-2025)
 *
 * NOTES
 *   - Set flagCollectionSamples to true to preview targetedYearsList on the map
 *     without queueing an export.
 *   - The year ladders were inherited from the 1985-2025 Landsat pipeline; the
 *     branches that could never fire in a 2017-2025 series have been collapsed,
 *     leaving the same values per year.
 *
 * PIPELINE
 *   p02 classification | region 5 of 0-8  ->  p02_merge_regions_gapfill
 * ==============================================================================
 */

/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var MANUAL_SAMPLES_SAVANNA = /* color: #d63000 */ee.FeatureCollection(
        [ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.36981907956353, -17.178542301743178],
                  [-57.370334063694386, -17.179700572123096],
                  [-57.36949721448174, -17.17960832076524],
                  [-57.36877838246575, -17.178675554456255]]]),
            {
              "reference": 4,
              "system:index": "0"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.394129740216385, -16.985859866326837],
                  [-57.39446233413423, -16.984997956241397],
                  [-57.395867811658036, -16.985192912440652],
                  [-57.39777754447664, -16.98516212989635],
                  [-57.39905427596773, -16.98627029830884],
                  [-57.396157490231644, -16.987973581436577],
                  [-57.394666182019364, -16.986424210070542]]]),
            {
              "reference": 4,
              "system:index": "1"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.38997768066133, -16.987327156528636],
                  [-57.38981674812044, -16.987111681064224],
                  [-57.39006351134981, -16.986701250923343],
                  [-57.39101837775911, -16.986660207859856],
                  [-57.39233802459444, -16.986485774739872],
                  [-57.39245604179109, -16.987645238904616],
                  [-57.39157627723421, -16.98808644904917],
                  [-57.38998840949739, -16.987398981628438]]]),
            {
              "reference": 4,
              "system:index": "2"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.40120004317964, -16.984977434524428],
                  [-57.40156482360567, -16.986393427728295],
                  [-57.39951561591829, -16.98622925515104],
                  [-57.400384651639115, -16.984782478101238]]]),
            {
              "reference": 4,
              "system:index": "3"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.50039700426719, -16.87271816048737],
                  [-57.50286463656089, -16.873005635708804],
                  [-57.50362101950309, -16.87362678603266],
                  [-57.503063120027996, -16.87498714944141],
                  [-57.4993724004235, -16.874581608167198],
                  [-57.50037554659507, -16.87288756558151]]]),
            {
              "reference": 4,
              "system:index": "4"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.44904879488609, -16.931846699123806],
                  [-57.44820121683738, -16.930558592720253],
                  [-57.451157011171794, -16.930640703351667],
                  [-57.45097462095878, -16.931636291907296],
                  [-57.449418939730144, -16.931708138300355]]]),
            {
              "reference": 4,
              "system:index": "5"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.46354345240257, -16.930607345911973],
                  [-57.46181610979698, -16.931053821922497],
                  [-57.46013570659981, -16.930353318007416],
                  [-57.46086929552733, -16.928975395868736],
                  [-57.46522251524589, -16.929226855915392],
                  [-57.46499184527061, -16.930402069229903],
                  [-57.46469680227897, -16.930822886187222],
                  [-57.463623918673015, -16.930802358552587]]]),
            {
              "reference": 4,
              "system:index": "6"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.44526044884988, -16.81951013742657],
                  [-57.44779245415994, -16.819489597690637],
                  [-57.4517835811741, -16.820454962874102],
                  [-57.44978801766702, -16.825137941210762],
                  [-57.44695560494729, -16.82542548874076],
                  [-57.44476692239114, -16.821071150845817]]]),
            {
              "reference": 4,
              "system:index": "7"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.59566017822854, -16.817326148469714],
                  [-57.594329802557155, -16.81925689595717],
                  [-57.59222695068948, -16.819729309900865],
                  [-57.587356059118434, -16.8220648758216],
                  [-57.58737751679055, -16.820462791328435],
                  [-57.58924433426492, -16.8176488409113],
                  [-57.592570273443386, -16.81631374033551],
                  [-57.59576746658914, -16.81709426181383]]]),
            {
              "reference": 4,
              "system:index": "8"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.54802836702696, -16.87937132000202],
                  [-57.547867434486065, -16.8807059756693],
                  [-57.546655076011334, -16.880069448758555],
                  [-57.545356886848126, -16.880726508759736],
                  [-57.54405869768492, -16.880808641099097],
                  [-57.5434793405377, -16.879648518493735],
                  [-57.54217042253843, -16.878406255411978],
                  [-57.540153401359234, -16.879063321200633],
                  [-57.53942384050718, -16.87730771844016],
                  [-57.54153742121092, -16.877174250896086],
                  [-57.544874089225445, -16.876506911760803],
                  [-57.546633618339214, -16.87877585519942]]]),
            {
              "reference": 4,
              "system:index": "9"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.40542916754935, -17.06940623195186],
                  [-57.406577153007724, -17.0702267285156],
                  [-57.40493564109061, -17.070278009431043],
                  [-57.40163115958426, -17.07001134851686],
                  [-57.400547547142246, -17.0694882817706],
                  [-57.39937810401175, -17.06818573663852],
                  [-57.40125565032218, -17.068052404734082],
                  [-57.40299372176383, -17.068472912724534],
                  [-57.40547208289359, -17.069047263570713]]]),
            {
              "reference": 4,
              "system:index": "10"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.39272892113664, -17.08238242955112],
                  [-57.39293276902177, -17.08120304146922],
                  [-57.393769618234415, -17.080700517324395],
                  [-57.396011944970866, -17.081223552630036],
                  [-57.396001216134806, -17.083161847145764],
                  [-57.39420950051286, -17.08417200852222],
                  [-57.39182904001214, -17.083965618127532],
                  [-57.39156081911065, -17.083106723969],
                  [-57.39281609292962, -17.082429861307062]]]),
            {
              "reference": 4,
              "system:index": "11"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.385567932016535, -16.686994371063296],
                  [-57.390031127817316, -16.688309825106682],
                  [-57.38591125477044, -16.694229256248217]]]),
            {
              "reference": 4,
              "system:index": "12"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.611817626840754, -16.74683835462301],
                  [-57.616280822641535, -16.74913967118746],
                  [-57.61216094959466, -16.753742220860417]]]),
            {
              "reference": 4,
              "system:index": "13"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.354325561411066, -16.661341208431026],
                  [-57.359818725473566, -16.65870992036341],
                  [-57.35672882068841, -16.667590372641108]]]),
            {
              "reference": 4,
              "system:index": "14"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.416810302622004, -16.82703923845311],
                  [-57.42264678943841, -16.82901096439278],
                  [-57.41784027088372, -16.83131128538298]]]),
            {
              "reference": 4,
              "system:index": "15"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.54727294910638, -16.769850268073988],
                  [-57.54521301258294, -16.76590556630858],
                  [-57.55001953113763, -16.76590556630858],
                  [-57.550362853891535, -16.772151306311315]]]),
            {
              "reference": 4,
              "system:index": "16"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.38694122303216, -16.657723178015377],
                  [-57.39174774158685, -16.653447235754367],
                  [-57.390031127817316, -16.663314650748948]]]),
            {
              "reference": 4,
              "system:index": "17"
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
var manualSamplesLimit = 200;

// Define the list of years for targeted analysis execution
var targetedYearsList = [2023];

// Target analysis geometry limits and metadata configuration
var targetBiome = 'PANTANAL';
var targetRegion = '5';
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

// Define maximum sample allocations for stable training databases (Region 5 - Preserving Legacy Balance)
var samplesForestLimit       = 1000;
var samplesSavannaLimit      = 1700;
var samplesGrasslandLimit    = 500;
var samplesAgricultureLimitBase = 300;
var samplesWaterLimit        = 900;
var samplesNonVegetatedLimit = 200;

// Define sample thresholds for complementary datasets (Region 5 - Preserving Legacy Balance)
var compCaveLimit      = 1;
var compSavannaLimit   = 1700;
var compGrasslandLimit = 700;
var compForestLimit    = 700;
var compAgroLimit      = 10;
var compWaterLimit     = 1;
// Region 5 excludes class 19 entirely, preserving the Collection 10 behaviour.
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
var rawImageCollection10 = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-10/GENERAL/classification-pan/PANT_col10_Anual_5');

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
//       bands ranked highest for region 5 in the feature-importance run (p01/p05).
var bandNamesList = ee.List([
      'A00','A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22',
      'A23','A24','A25','A26','A27','A28','A29','A30','A31','A32','A33','A34','A35','A36','A37','A38','A39','A40','A41','A42','A43','A44','A45',
      'A46','A47','A48','A49','A50','A51','A52','A53','A54','A55','A56','A57','A58','A59','A60','A61','A62','A63',
      'latitude','longitude',
      'ndci_median_wet','red_edge_1_median_wet','green_median','red_edge_1_median','tgsi_median_wet','gari_median_wet','red_edge_1_median_dry',
      'ireci_median_wet','spri_median_wet','brightness_median','iia_median_wet','avi_median_wet','brba_median_wet','tgsi_median','spri_median',
      'mndwi_median_wet','swir2_median','red_edge_4_median_wet','swir2_median_dry','green_median_wet','wetness_median','cvi_median_wet',
      'brightness_median_dry','red_edge_3_median','ndviRed_median_wet','gari_median','tgsi_median_dry','osavi_median','red_edge_2_median',
      'red_edge_3_median_wet','cai_median','gcvi_median_wet','ireci_median','lswi_median_wet','red_edge_4_median','hallcover_median',
      'ndwi_median_dry','evi_median_wet','blue_median','ndvi_median_wet','swir1_median_dry','hallheight_median_dry','mbi_median_wet',
      'mndwi_median','bsi_median_wet','brightness_median_wet','hallcover_median_wet','red_edge_2_median_dry','nir_median','iia_median',
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

    // Dynamic adjustment of training allocation parameters (Region 5 progression - Preserving Legacy Balance)
    // The original Landsat ladder used else-if in ascending order, so the later
    // Rewritten as sequential ifs; the unreachable branches have been collapsed.
    // Over the 2017-2025 series the base value resolves to 900.
    var currentSamplesAgricultureLimit = 900;

    if (flagCollectionSamples) {
        Map.addLayer(finalRegionalImage, {
            bands: ['swir1_median_dry', 'nir_median', 'red_edge_1_median'],
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

    // Split the pool by class. (Region 5 source mapping)
    var classForestSamples    = samplesLandsat.filter(ee.Filter.eq("reference", 3));
    var classSavannaSamples   = samplesSentinel.filter(ee.Filter.eq("reference", 4));
    var classGrasslandSamples = samplesSentinel.filter(ee.Filter.eq("reference", 12));
    var classAgroSamples      = samplesLandsat.filter(ee.Filter.eq("reference", 21));
    var classWaterSamples     = samplesSentinel.filter(ee.Filter.eq("reference", 33));
    var classNonVegSamples    = samplesSentinel.filter(ee.Filter.eq("reference", 25));

    // Shuffle, then cap each class at its regional quota. (Region 5 constraints)
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

    // Isolate, shuffle, and parameterize regional complementary vector maps (Region 5 constraints)
    // Region 5 excludes class 19 entirely, as Collection 10 did.
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
    var annuallyClassifiedImage = finalRegionalImage.classify(spatialClassifierModel);
    annuallyClassifiedImage = annuallyClassifiedImage
                                .select(['classification'], ['classification_' + operationalYear])
                                .clip(analysisGeometry)
                                .toByte();

    if (flagCollectionSamples) {
        Map.addLayer(annuallyClassifiedImage, visualizationParams, 'RF Output ' + operationalYear, false);
        Map.addLayer(assetCollection10.select('classification_' + operationalYear), visualizationParams, 'Col10 Integrated ' + operationalYear, false);
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
