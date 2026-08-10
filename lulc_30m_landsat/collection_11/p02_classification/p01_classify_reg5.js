/**
 * ==============================================================================
 * p01 | Regional classification - region 5
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Annual land use and land cover classification for Region 5 - Pocone.
 *   
 *   One Random Forest is trained per year on the predictor stack assembled in
 *   p01, using the stable and complementary samples that fall inside this
 *   region. Each region has its own band list, taken from the feature-importance
 *   run in p01/p04, and its own per-class sample quotas, so that a class which
 *   dominates one part of the Pantanal does not swamp the regions where it is
 *   scarce. The agricultural quota grows through the series to follow the real
 *   expansion of cropland.
 *   
 *   This region also trains on hand-drawn polygons stored in the imports
 *   block, used to reinforce classes the automatic sampling misses here.
 *
 * INPUTS
 *   - Landsat monthly mosaics (mosaicos_mensais_do_Google_v1 module)
 *   - MapBiomas Landsat mosaic asset (nexgenmap mosaics-2)
 *   - MERIT DEM and Geomorpho90m terrain layers
 *   - pts_trained_stable_v{samplesVersion}_regiao_5_trained
 *   - pts_trained_stable8910_v{samplesVersion}_regiao_5_trained
 *   - Hand-drawn reinforcement polygons (imports block)
 *
 * OUTPUTS
 *   - PANT_col11_reg5_v{outputVersion} (one band per year, 1985-2025)
 *
 * NOTES
 *   - Set flagCollectionSamples to true to preview a few years on the map
 *     without queueing an export.
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

// ==============================================================================
// 1. PARAMETERS AND CONSTANTS
// ==============================================================================

var flagCollectionSamples = false;
var flagManualPolygons = true; // Set to false to train without them.
var manualPolygonsAsset = MANUAL_SAMPLES_SAVANNA; // Polygons defined in the imports block.
var manualSamplesLimit = 200; // Pixels drawn at random inside the polygons, per year.


// Define the list of years for the targeted analysis execution (standardized as numbers)
var targetedYearsList = [2023];

// Set execution geometry limits and metadata configuration
var targetBiome = 'PANTANAL';
var targetRegion = '5';
var outputVersion = '4';
var randomSeed = 1;

// Define the output asset and input sample directories updated for Collection 11
var outputDirectory = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan/';
var samplesDirectory = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/';

var samplesVersion = 5;
var processingVersionPt = samplesVersion;
var randomForestTrees = 200;

// Fewer trees while collecting samples interactively; the map is only a preview.
if (flagCollectionSamples) {
    randomForestTrees = 20;
}

// Load the official MapBiomas biomes raster and generate a strict mask for the Pantanal biome (ID: 3)
var biomesRaster = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-raster-41_old');
var pantanalBiomeMask = biomesRaster.mask(biomesRaster.eq(3));
Map.addLayer(pantanalBiomeMask, {}, 'Pantanal Biome Boundary', false);

// Define band processing separation schemas (On-the-fly calculated vs Pre-computed Assets)
var bandasOnTheFly = [
  "green_median_dry", "afvi_median", "afvi_median_dry", "afvi_median_wet", "ano",
  "aspect", "avi_median", "avi_median_dry", "avi_median_wet", "blue_median_wet", "brba_median", "brba_median_dry",
  "brba_median_wet", "brightness_median", "brightness_median_dry", "brightness_median_wet",
  "bsi_median", "bsi_median_dry", "bsi_median_wet", "co2flux_median", "convergence", "cti",
  "cvi_median", "cvi_median_dry", "cvi_median_wet", "dswi5_median", "dswi5_median_dry",
  "dswi5_median_wet", "dxx", "eastness", "evi_median", "evi_median_dry", "evi_median_wet",
  "gli_median", "gli_median_dry", "gli_median_wet", "green_median_texture", "green_median_wet",
  "gvmi_median", "gvmi_median_dry", "gvmi_median_wet", "hallcover_median_dry", "hallcover_median_wet",
  "hallheigth_median_dry", "hallheigth_median_wet", "iia_median", "iia_median_dry", "iia_median_wet",
  "lai_median", "latitude", "longitude", "lswi_median", "lswi_median_dry", "lswi_median_wet",
  "mbi_median", "mbi_median_dry", "mbi_median_wet", "merit_dem", "mndwi_median", "mndwi_median_dry",
  "mndwi_median_wet", "msi_median", "msi_median_dry", "msi_median_wet", "nddi_median", "nddi_median_dry",
  "nddi_median_wet", "ndvi_median_dry", "ndvi_median_wet", "ndwi_median_dry", "ndwi_median_wet",
  "ndwi2_median", "ndwi2_median_dry", "ndwi2_median_wet", "nir_median_dry", "nir_median_wet", "northness",
  "osavi_median", "osavi_median_dry", "osavi_median_wet", "ratio_median", "ratio_median_dry",
  "ratio_median_wet", "red_median_dry", "red_median_wet", "ri_median", "ri_median_dry", "ri_median_wet",
  "roughness", "rvi_median", "rvi_median_dry", "rvi_median_wet", "spri_median", "spri_median_dry",
  "spri_median_wet", "swir1_median_dry", "swir1_median_wet", "swir2_median_dry", "swir2_median_wet",
  "ui_median", "ui_median_dry", "ui_median_wet", "wetness_median", "wetness_median_dry", "wetness_median_wet",
  "gemi_median", "gemi_median_wet", "awei_median", "awei_median_dry", "evi2_median",  "blue_median_dry" // Extras Reg 5
];

var bandasAsset = [
  "cai_median_dry", "cai_stdDev", "cloud_amp", "cloud_max", "cloud_median", "cloud_median_dry",
  "cloud_median_wet", "cloud_min", "cloud_stdDev", "evi2_amp", "evi2_stdDev", "gcvi_median", "gcvi_median_dry",
  "gcvi_median_wet", "gcvi_stdDev", "gvs_amp", "gvs_max", "gvs_median", "gvs_median_dry", "gvs_median_wet", "gvs_min",
  "gvs_stdDev", "hallcover_stdDev", "ndvi_amp", "ndvi_stdDev", "ndwi_amp", "ndwi_stdDev", "npv_amp", "npv_max",
  "npv_median", "npv_median_dry", "npv_median_wet", "npv_min", "npv_stdDev", "pri_median", "pri_median_dry",
  "pri_median_wet", "savi_median", "savi_median_dry", "savi_median_wet", "savi_stdDev", "sefi_median", "sefi_median_dry",
  "sefi_stdDev", "shade_amp", "shade_max", "shade_median", "shade_median_dry", "shade_median_wet", "shade_min",
  "shade_stdDev", "slope", "wefi_amp", "wefi_median", "wefi_median_wet", "wefi_stdDev",
  'swir1_median', 'nir_median', 'red_median', 'blue_median', 'green_median', 'swir2_median' // Extras Reg 5
];

// Load historical references from Collection 10 for interactive data validation
var assetCollection10 = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection10_1/mapbiomas_brazil_collection10_1_coverage_v1')
                          .mask(pantanalBiomeMask);
var rawImageCollection10 = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-10/GENERAL/classification-pan/PANT_col10_Anual_5'); // Assuming _5 for reg 5 comparison

// Import visualization modules
var palettesModule = require('users/mapbiomas/modules:Palettes.js');
var visualizationParams = {
    'min': 0,
    'max': 62,
    'palette': palettesModule.get('classification7')
};

// Define explicit model classification features (Region 5 band list mapped from Collection 10)
var bandNamesList = ee.List([
  "brightness_median", "wetness_median", "avi_median", "wetness_median_wet", "ri_median_wet",
  "longitude", "mndwi_median_wet", "swir1_median_dry", "wetness_median_dry", "gcvi_median_wet",
  "nir_median_wet", "iia_median_wet", "green_median_wet", "merit_dem", "brightness_median_wet",
  "swir1_median_wet", "swir2_median_wet", "brightness_median_dry", "osavi_median", "avi_median_wet",
  "brba_median_wet", "savi_median_wet", "latitude", "nir_median_dry", "gcvi_stdDev", "mndwi_median",
  "brba_median", "swir2_median_dry", "roughness", "red_median_wet", "red_median_dry", "ratio_median_wet",
  "avi_median_dry", "ui_median", "gcvi_median", "ratio_median", "green_median_dry", "bsi_median_wet",
  "co2flux_median", "evi_median_wet", "afvi_median", "ndwi2_median_wet", "evi_median", "nddi_median",
  "ndvi_median_wet", "nddi_median_wet", "afvi_median_dry", "mbi_median_wet", "savi_median_dry", "rvi_median_wet"
 ]);

var mosaicModule = require('users/gee_arcplan/MapBiomas_Col11_Pantanal:mosaicos_mensais_do_Google_v1');
var ASSET_MOSAICS = 'projects/nexgenmap/MapBiomas2/LANDSAT/BRAZIL/mosaics-2';

// Terrain predictors, rescaled and cast to Int16 to keep the stack small.
var dem = ee.Image('MERIT/DEM/v1_0_3').select('dem').toInt16().rename('merit_dem');
var aspect = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/aspect").mosaic().multiply(100).round().toInt16().rename('aspect');
var convergence = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/convergence").mosaic().multiply(1000).round().toInt16().rename('convergence');
var roughness = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/roughness").mosaic().multiply(1000).round().toInt16().rename('roughness');
var eastness = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/eastness").mosaic().multiply(1000).round().toInt16().rename('eastness');
var northness = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/northness").mosaic().multiply(10000).round().toInt16().rename('northness');
var dxx = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/dxx").mosaic().multiply(10000).round().toInt16().rename('dxx');
var cti = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/cti").mosaic().multiply(1000).round().toInt16().rename('cti');

// Static terrain stack, clipped later together with the rest of the predictors.
var terrainBands = dem.addBands([aspect, convergence, roughness, eastness, northness, dxx, cti]);

// Load regional administrative operational zones
var pantanalRegionsFC = ee.FeatureCollection('projects/ee-arcplan-df/assets/col11/regions_buffer');
Map.addLayer(pantanalRegionsFC, {}, 'Pantanal Regions Collection', false);

var selectedRegionId = 'reg' + targetRegion;
var regionFilterLimit = pantanalRegionsFC.filter(ee.Filter.eq('id_reg', selectedRegionId));
var analysisGeometry = regionFilterLimit.geometry();
Map.addLayer(regionFilterLimit, {}, 'Target Analysis Region', false);

// Define maximum sample allocations for stable training databases (Region 5 values)
var samplesForestLimit       = 1000;
var samplesSavannaLimit      = 2000;
var samplesGrasslandLimit    = 500;
var samplesAgricultureLimit  = 300;  // default base; overridden dynamically per year below
var samplesWaterLimit        = 900;
var samplesNonVegetatedLimit = 200;

// Define sample thresholds for complementary datasets (Region 5 values)
var compCaveLimit     = 1;
var compSavannaLimit  = 2000;
var compGrasslandLimit= 700;
var compForestLimit   = 500;
var compAgroLimit     = 10;
var compWaterLimit    = 1;

// Chronological scope for Collection 11. The whole series is classified in a
// single task; comment years out to re-run only part of the timeline.
var historicalYearsArray = [
    1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994,
    1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004,
    2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014,
    2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025
];

if (flagCollectionSamples) {
    historicalYearsArray = targetedYearsList;
}

// ==============================================================================
// 2. HELPER FUNCTIONS
// ==============================================================================

/**
 * Shuffles a FeatureCollection pseudo-randomly using a reproducible seed value.
 * @param {ee.FeatureCollection} collection - Input feature collection to shuffle.
 * @param {number} seed - Deterministic randomizer seed.
 * @return {ee.FeatureCollection} Remapped collection with randomized structural order.
 */
var shuffleCollection = function(collection, seed) {
    return collection.randomColumn('random', seed || 1).sort('random', true);
};

// ==============================================================================
// 3. ANNUAL CLASSIFICATION CORE LOOP
// ==============================================================================

var classifiedTimeSeriesImage;

for (var yearIndex = 0; yearIndex < historicalYearsArray.length; yearIndex++) {
    var operationalYear = historicalYearsArray[yearIndex];
    var operationalYearNum = ee.Number(operationalYear);

    // Build the predictor stack for the year, clipped to this region.
    var annualMosaic = mosaicModule.getMosaic(operationalYear, regionFilterLimit);
    var annualMosaicAsset = ee.ImageCollection(ASSET_MOSAICS)
                                .filter(ee.Filter.eq('biome', 'PANTANAL'))
                                .filter(ee.Filter.eq('year', operationalYearNum))
                                .mosaic()
                                .select(bandasAsset, bandasAsset) // Ensures bands exist without error
                                .clip(analysisGeometry);

    var yearMetadataBand = ee.Image.constant(operationalYearNum).int16().rename('ano');

    // Assemble and clip the final predictor stack.
    var finalRegionalImage = annualMosaic
                                .addBands(yearMetadataBand)
                                .addBands(terrainBands)
                                .select(bandasOnTheFly, bandasOnTheFly)
                                .addBands(annualMosaicAsset)
                                .select(bandNamesList)
                                .clip(analysisGeometry);

    // Dynamic adjustment of agriculture training allocation parameters (Region 5 progression preserved)
    if (operationalYear >= 2000) { samplesAgricultureLimit = 600; }
    else if (operationalYear >= 2010) { samplesAgricultureLimit = 700; }
    else if (operationalYear >= 2015) { samplesAgricultureLimit = 900; }

    var compStrictAgricLimit = 50;
    if (operationalYear >= 1990) { compStrictAgricLimit = 150; }
    if (operationalYear >= 2000) { compStrictAgricLimit = 250; }
    if (operationalYear >= 2010) { compStrictAgricLimit = 300; }

    if (flagCollectionSamples) {
        Map.addLayer(annualMosaicAsset, {
            bands: ['swir1_median', 'nir_median', 'red_median'],
            gain: [0.08, 0.06, 0.2],
            gamma: 0.85
        }, 'Landsat Mosaic Asset ' + operationalYear, false);
    }

    // Load regional baseline stable vectors and apply strict temporal filtering by year
    var primaryStableSamplesFC = ee.FeatureCollection(samplesDirectory + 'pts_trained_stable_v' + processingVersionPt + '_regiao_' + targetRegion + '_trained')
                                   .filter(ee.Filter.eq('id_reg', selectedRegionId))
                                   .filter(ee.Filter.eq('ano', operationalYearNum)); // Keep only the samples of the current year.

    var classForestSamples    = primaryStableSamplesFC.filter(ee.Filter.eq('reference', 3));
    var classSavannaSamples   = primaryStableSamplesFC.filter(ee.Filter.eq('reference', 4));
    var classGrasslandSamples = primaryStableSamplesFC.filter(ee.Filter.eq('reference', 12));
    var classAgroSamples      = primaryStableSamplesFC.filter(ee.Filter.eq('reference', 21));
    var classWaterSamples     = primaryStableSamplesFC.filter(ee.Filter.eq('reference', 33));
    var classNonVegSamples    = primaryStableSamplesFC.filter(ee.Filter.eq('reference', 25));

    classForestSamples    = shuffleCollection(classForestSamples,    randomSeed).limit(samplesForestLimit);
    classSavannaSamples   = shuffleCollection(classSavannaSamples,   randomSeed).limit(samplesSavannaLimit);
    classGrasslandSamples = shuffleCollection(classGrasslandSamples, randomSeed).limit(samplesGrasslandLimit);
    classAgroSamples      = shuffleCollection(classAgroSamples,      randomSeed).limit(samplesAgricultureLimit);
    classWaterSamples     = shuffleCollection(classWaterSamples,     randomSeed).limit(samplesWaterLimit);
    classNonVegSamples    = shuffleCollection(classNonVegSamples,    randomSeed).limit(samplesNonVegetatedLimit);

    var unifiedStablePoints = classForestSamples.merge(classSavannaSamples).merge(classGrasslandSamples)
                                                .merge(classAgroSamples).merge(classWaterSamples).merge(classNonVegSamples);

    // Load auxiliary regional complementary point datasets and apply temporal filtering by year
    var complementarySamplesFC = ee.FeatureCollection(samplesDirectory + 'pts_trained_stable8910_v' + processingVersionPt + '_regiao_' + targetRegion + '_trained')
                                   .filter(ee.Filter.eq('id_reg', selectedRegionId))
                                   .filter(ee.Filter.eq('ano', operationalYearNum)); // Keep only the samples of the current year.

    // Isolate, shuffle, and strictly limit complementary variables
    var compCavePoints      = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 12)), randomSeed).limit(compCaveLimit);
    var compSavannaPoints   = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 4)),  randomSeed).limit(compSavannaLimit);
    var compGrasslandPoints = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 12)), randomSeed).limit(compGrasslandLimit);
    var compForestPoints    = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 3)),  randomSeed).limit(compForestLimit);
    var compAgroPoints      = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 21)), randomSeed).limit(compAgroLimit);
    var compWaterPoints     = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 33)), randomSeed).limit(compWaterLimit);

    // NOTE: agric (ref 19) is intentionally commented out/excluded for Region 5 complementary merge, identical to Col 10 script behavior
    // var compStrictAgricPoints = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 19)), randomSeed).limit(compStrictAgricLimit);

    var unifiedComplementaryPoints = compCavePoints.merge(compSavannaPoints).merge(compGrasslandPoints)
                                                   .merge(compForestPoints).merge(compAgroPoints).merge(compWaterPoints);

    // Merge stable and complementary vectors BEFORE extraction
    var masterPointsPool = unifiedStablePoints.merge(unifiedComplementaryPoints);

    // Read the predictor values at every training point.
    var trainingSamples = finalRegionalImage.select(bandNamesList).sampleRegions({
        collection: masterPointsPool,
        properties: ['reference'],
        scale: 30,
        geometries: false
    });
      if (flagManualPolygons) {
        try {
            // Add the 'ano' filter below if the polygons are year-specific rather than
            // valid for the whole series.
            var manualPolygonsFC = ee.FeatureCollection(manualPolygonsAsset)
                                     .filterBounds(analysisGeometry)
                                     //.filter(ee.Filter.eq('ano', operationalYearNum));

            // Burn the polygons into a raster whose pixel value is the class id.
            var manualPolygonsImg = manualPolygonsFC.reduceToImage({
                properties: ['reference'],
                reducer: ee.Reducer.first()
            }).rename('reference').toInt8();

            // Draw pixels at random inside the polygons.
            var manualTrainingSamples = finalRegionalImage.select(bandNamesList)
                .addBands(manualPolygonsImg)
                .sample({
                    region: manualPolygonsFC.geometry(),
                    scale: 30,
                    numPixels: manualSamplesLimit,
                    seed: randomSeed,
                    geometries: false
                });

            // Merge the manual signatures into the standard training pool.
            trainingSamples = trainingSamples.merge(manualTrainingSamples);

            if (flagCollectionSamples) {
                print('Manual polygon samples extracted for ' + operationalYear);
            }
        } catch(e) {
            print('Could not load the manual polygons for ' + operationalYear + '. Check the asset.', e);
        }
    }

    // Train the smileRandomForest model using the optimized extracted training pool
    var spatialClassifierModel = ee.Classifier.smileRandomForest({
        numberOfTrees: randomForestTrees,
        variablesPerSplit: 1
    }).train(trainingSamples, 'reference', bandNamesList);

    // Classify and trim to the valid-data footprint of the mosaic.
    var annuallyClassifiedImage = finalRegionalImage.classify(spatialClassifierModel);
    annuallyClassifiedImage = annuallyClassifiedImage
                                .updateMask(finalRegionalImage.select('brightness_median').mask())
                                .select(['classification'], ['classification_' + operationalYear])
                                .clip(analysisGeometry)
                                .toInt8();
 var imgv1= ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan/PANT_col11_Anual_GapFill_4')
    if (flagCollectionSamples) {
      Map.addLayer(imgv1.select('classification_' + operationalYear), visualizationParams, 'RF Classified v1 Output ' + operationalYear, false);

        Map.addLayer(annuallyClassifiedImage, visualizationParams, 'RF Classified Output ' + operationalYear, false);
        Map.addLayer(rawImageCollection10.select('classification_' + operationalYear), visualizationParams, 'Raw Col10 Layer ' + operationalYear, false);
        Map.addLayer(assetCollection10.select('classification_' + operationalYear), visualizationParams, 'Integrated Col10 Baseline ' + operationalYear, false);
    }

    // Stack the year into the multi-band time series.
    if (yearIndex === 0) {
        classifiedTimeSeriesImage = annuallyClassifiedImage;
    } else {
        classifiedTimeSeriesImage = classifiedTimeSeriesImage.addBands(annuallyClassifiedImage);
    }
}

// ==============================================================================
// 4. METADATA PROVISIONING & INFRASTRUCTURE EXPORTS
// ==============================================================================

// MapBiomas metadata required by the national integration step.
classifiedTimeSeriesImage = classifiedTimeSeriesImage
    .set('territory', 'BRAZIL')
    .set('biome', 'PANTANAL')
    .set('source', 'arcplan')
    .set('version', outputVersion)
    .set('collection_id', 11.0);

// In sample-collection mode nothing is exported: the map is inspected on screen.
if (flagCollectionSamples) {
    print('Sample collection mode. Band structure:', classifiedTimeSeriesImage.bandNames());
} else {
    Export.image.toAsset({
        "image": classifiedTimeSeriesImage,
        "description": 'PANT_col11_reg' + targetRegion + '_v' + outputVersion,
        "assetId": outputDirectory + 'PANT_col11_reg' + targetRegion + '_v' + outputVersion,
        "scale": 30,
        "pyramidingPolicy": {
            '.default': 'mode'
        },
        "maxPixels": 1e13,
        "region": regionFilterLimit.geometry(),
        "overwrite": true
    });
}

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias — ArcPlan — mariana@arcplan.com.br
 * MapBiomas Collection 11 | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
