/**
 * ==============================================================================
 * p01 | Regional classification - region 2
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Annual land use and land cover classification for Region 2 - Taquari alluvial fan.
 *   
 *   One Random Forest is trained per year on the predictor stack assembled in
 *   p01, using the stable and complementary samples that fall inside this
 *   region. Each region has its own band list, taken from the feature-importance
 *   run in p01/p04, and its own per-class sample quotas, so that a class which
 *   dominates one part of the Pantanal does not swamp the regions where it is
 *   scarce. The agricultural quota grows through the series to follow the real
 *   expansion of cropland.
 *
 * INPUTS
 *   - Landsat monthly mosaics (mosaicos_mensais_do_Google_v1 module)
 *   - MapBiomas Landsat mosaic asset (nexgenmap mosaics-2)
 *   - MERIT DEM and Geomorpho90m terrain layers
 *   - pts_trained_stable_v{samplesVersion}_regiao_2_trained
 *   - pts_trained_stable8910_v{samplesVersion}_regiao_2_trained
 *
 * OUTPUTS
 *   - PANT_col11_reg2_v{outputVersion} (one band per year, 1985-2025)
 *
 * NOTES
 *   - Set flagCollectionSamples to true to preview a few years on the map
 *     without queueing an export.
 *
 * PIPELINE
 *   p02 classification | region 2 of 0-8  ->  p02_merge_regions_gapfill
 * ==============================================================================
 */

// ==============================================================================
// 1. PARAMETERS AND CONSTANTS
// ==============================================================================

var flagCollectionSamples = false;
// Define the list of years for the targeted analysis execution (standardized as numbers)
var targetedYearsList = [2024];

// Set execution geometry limits and metadata configuration
var targetBiome = 'PANTANAL';
var targetRegion = '2';
var outputVersion = '3';
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
var biomesRaster = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-raster-41');
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
  "ui_median", "ui_median_dry", "ui_median_wet", "wetness_median", "wetness_median_dry", "wetness_median_wet"
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
  'swir1_median', 'nir_median', 'red_median'
];

// Load historical references from Collection 10 for interactive data validation
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

// Define explicit model classification features (Region 2 band list)
var bandNamesList = ee.List([
      "longitude", "wetness_median", "brightness_median", "avi_median_wet",
      "nir_median_wet", "avi_median", "merit_dem", "swir1_median_wet", "savi_median_wet",
      "brightness_median_dry", "savi_median", "nir_median_dry", "brightness_median_wet",
      "gcvi_median", "rvi_median_wet", "wetness_median_wet", "swir1_median_dry", "gcvi_median_wet",
      "ratio_median_wet", "nddi_median_wet", "ri_median_wet", "wefi_median_wet",
      "wetness_median_dry", "iia_median", "bsi_median_dry", "hallheigth_median_wet",
      "swir2_median_wet", "green_median_wet", "ratio_median", "msi_median_dry",
      "green_median_dry", "ndvi_median_wet", "osavi_median_wet", "gvmi_median_wet",
      "lswi_median_wet", "ri_median", "evi_median", "msi_median", "red_median_dry",
      "co2flux_median", "bsi_median_wet", "avi_median_dry", "savi_median_dry",
      "dswi5_median_wet", "shade_median", "iia_median_wet", "ndvi_amp",
      "nddi_median", "afvi_median", "gvmi_median"

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

// Define maximum sample allocations for stable training databases (Region 2 values)
var samplesForestLimit = 1800;
var samplesSavannaLimit = 2000;
var samplesGrasslandLimit = 800;
var samplesAgricultureLimit = 600;  // default; overridden dynamically per year below
var samplesWaterLimit = 900;
var samplesNonVegetatedLimit = 200;

// Define sample thresholds for complementary datasets (Region 2 values)
var compCaveLimit = 1;
var compSavannaLimit = 2000;
var compGrasslandLimit = 50;
var compForestLimit = 800;
var compAgroLimit = 50;
var compWaterLimit = 1;

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

    // Standardize input type to integer numbers for server-side processing stability
    var operationalYearNum = ee.Number(operationalYear);

    // Build the predictor stack for the year, clipped to this region.
    var annualMosaic = mosaicModule.getMosaic(operationalYear, regionFilterLimit);
    var annualMosaicAsset = ee.ImageCollection(ASSET_MOSAICS)
                                .filter(ee.Filter.eq('biome', 'PANTANAL'))
                                .filter(ee.Filter.eq('year', operationalYearNum))
                                .mosaic()
                                .select(bandasAsset)
                                .clip(analysisGeometry);

    // The year itself is a predictor: it lets the model absorb sensor drift.
    var yearMetadataBand = ee.Image.constant(operationalYearNum).int16().rename('ano');

    // Assemble and clip the final predictor stack.
    var finalRegionalImage = annualMosaic
                                .addBands(yearMetadataBand)
                                .addBands(terrainBands)
                                .select(bandasOnTheFly)
                                .addBands(annualMosaicAsset)
                                .select(bandNamesList)
                                .clip(analysisGeometry);

    // Dynamic adjustment of training allocation parameters (Region 2 progression)
    if (operationalYear == 2000)      { samplesAgricultureLimit = 500; }
    else if (operationalYear == 2001) { samplesAgricultureLimit = 600; }
    else if (operationalYear == 2002) { samplesAgricultureLimit = 700; }
    else if (operationalYear == 2003) { samplesAgricultureLimit = 800; }
    else if (operationalYear == 2004) { samplesAgricultureLimit = 800; }
    else if (operationalYear == 2005) { samplesAgricultureLimit = 900; }
    else if (operationalYear == 2006) { samplesAgricultureLimit = 900; }
    else if (operationalYear == 2007) { samplesAgricultureLimit = 1000; }
    else if (operationalYear == 2008) { samplesAgricultureLimit = 1200; }
    else if (operationalYear == 2009) { samplesAgricultureLimit = 1300; }
    else if (operationalYear == 2010) { samplesAgricultureLimit = 1350; }
    else if (operationalYear == 2011) { samplesAgricultureLimit = 1500; }
    else if (operationalYear == 2012) { samplesAgricultureLimit = 2000; }
    else if (operationalYear == 2013) { samplesAgricultureLimit = 2100; }
    else if (operationalYear == 2014) { samplesAgricultureLimit = 2200; }
    else if (operationalYear == 2015) { samplesAgricultureLimit = 2300; }
    else if (operationalYear == 2016) { samplesAgricultureLimit = 2400; }
    else if (operationalYear == 2017) { samplesAgricultureLimit = 2500; }
    else if (operationalYear == 2018) { samplesAgricultureLimit = 2600; }
    else if (operationalYear == 2019) { samplesAgricultureLimit = 2700; }
    else if (operationalYear == 2020) { samplesAgricultureLimit = 2800; }
    else if (operationalYear == 2021) { samplesAgricultureLimit = 2900; }
    else if (operationalYear == 2022) { samplesAgricultureLimit = 2900; }
    else if (operationalYear >= 2023) { samplesAgricultureLimit = 3000; }

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

    // Split the pool by class.
    var classForestSamples    = primaryStableSamplesFC.filter(ee.Filter.eq('reference', 3));
    var classSavannaSamples   = primaryStableSamplesFC.filter(ee.Filter.eq('reference', 4));
    var classGrasslandSamples = primaryStableSamplesFC.filter(ee.Filter.eq('reference', 12));
    var classAgroSamples      = primaryStableSamplesFC.filter(ee.Filter.eq('reference', 21));
    var classWaterSamples     = primaryStableSamplesFC.filter(ee.Filter.eq('reference', 33));
    var classNonVegSamples    = primaryStableSamplesFC.filter(ee.Filter.eq('reference', 25));

    // Shuffle, then cap each class at its regional quota.
    classForestSamples    = shuffleCollection(classForestSamples,    randomSeed).limit(samplesForestLimit);
    classSavannaSamples   = shuffleCollection(classSavannaSamples,   randomSeed).limit(samplesSavannaLimit);
    classGrasslandSamples = shuffleCollection(classGrasslandSamples, randomSeed).limit(samplesGrasslandLimit);
    classAgroSamples      = shuffleCollection(classAgroSamples,      randomSeed).limit(samplesAgricultureLimit);
    classWaterSamples     = shuffleCollection(classWaterSamples,     randomSeed).limit(samplesWaterLimit);
    classNonVegSamples    = shuffleCollection(classNonVegSamples,    randomSeed).limit(samplesNonVegetatedLimit);

    // Consolidate limited stable features into a clean single collection
    var unifiedStablePoints = classForestSamples.merge(classSavannaSamples).merge(classGrasslandSamples)
                                                .merge(classAgroSamples).merge(classWaterSamples).merge(classNonVegSamples);

    // Load auxiliary regional complementary point datasets and apply temporal filtering by year
    var complementarySamplesFC = ee.FeatureCollection(samplesDirectory + 'pts_trained_stable8910_v' + processingVersionPt + '_regiao_' + targetRegion + '_trained')
                                   .filter(ee.Filter.eq('id_reg', selectedRegionId))
                                   .filter(ee.Filter.eq('ano', operationalYearNum)); // Keep only the samples of the current year.

    // Irrigated agriculture (19) is rare early in the series and grows later. (Region 2 values)
    var compStrictAgricLimit = 350;
    if (operationalYear >= 1990) { compStrictAgricLimit = 500; }
    if (operationalYear >= 2000) { compStrictAgricLimit = 750; }
    if (operationalYear >= 2010) { compStrictAgricLimit = 900; }
    if (operationalYear >= 2019) { compStrictAgricLimit = 1500; }

    // Isolate, shuffle, and strictly limit complementary variables
    var compCavePoints       = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 12)), randomSeed).limit(compCaveLimit);
    var compSavannaPoints    = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 4)),  randomSeed).limit(compSavannaLimit);
    var compGrasslandPoints  = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 12)), randomSeed).limit(compGrasslandLimit);
    var compForestPoints     = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 3)),  randomSeed).limit(compForestLimit);
    var compAgroPoints       = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 21)), randomSeed).limit(compAgroLimit);
    var compWaterPoints      = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 33)), randomSeed).limit(compWaterLimit);
    var compStrictAgricPoints = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 19)), randomSeed).limit(compStrictAgricLimit);

    // Merge balanced complementary sets into a unified feature block
    var unifiedComplementaryPoints = compCavePoints.merge(compSavannaPoints).merge(compGrasslandPoints)
                                                   .merge(compForestPoints).merge(compAgroPoints).merge(compWaterPoints);

    if (operationalYear >= 2000) {
        unifiedComplementaryPoints = unifiedComplementaryPoints.merge(compStrictAgricPoints);
    }

    // Merge stable and complementary vectors BEFORE extraction
    var masterPointsPool = unifiedStablePoints.merge(unifiedComplementaryPoints);

    // Read the predictor values at every training point.
    var trainingSamples = finalRegionalImage.select(bandNamesList).sampleRegions({
        collection: masterPointsPool,
        properties: ['reference'],
        scale: 30,
        geometries: false
    });

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

    if (flagCollectionSamples) {
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
        "region": regionFilterLimit.geometry()
    });
}

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias — ArcPlan — mariana@arcplan.com.br
 * MapBiomas Collection 11 | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
