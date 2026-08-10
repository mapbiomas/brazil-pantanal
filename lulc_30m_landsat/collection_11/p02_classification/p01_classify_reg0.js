/**
 * ==============================================================================
 * p01 | Regional classification - region 0
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Annual land use and land cover classification for Region 0 - biome-wide baseline.
 *   
 *   One Random Forest is trained per year on the predictor stack assembled in
 *   p01, using the stable and complementary samples that fall inside this
 *   region. Each region has its own band list, taken from the feature-importance
 *   run in p01/p04, and its own per-class sample quotas, so that a class which
 *   dominates one part of the Pantanal does not swamp the regions where it is
 *   scarce. The agricultural quota grows through the series to follow the real
 *   expansion of cropland.
 *   
 *   Region 0 covers the whole biome and acts as the fallback layer under
 *   every other region during the merge in p02.
 *
 * INPUTS
 *   - Landsat monthly mosaics (mosaicos_mensais_do_Google_v1 module)
 *   - MapBiomas Landsat mosaic asset (nexgenmap mosaics-2)
 *   - MERIT DEM and Geomorpho90m terrain layers
 *   - pts_trained_stable_v{samplesVersion}_regiao_0_trained
 *   - pts_trained_stable8910_v{samplesVersion}_regiao_0_trained
 *
 * OUTPUTS
 *   - PANT_col11_reg0_v{outputVersion} (one band per year, 1985-2025)
 *
 * NOTES
 *   - Set flagCollectionSamples to true to preview a few years on the map
 *     without queueing an export.
 *
 * PIPELINE
 *   p02 classification | region 0 of 0-8  ->  p02_merge_regions_gapfill
 * ==============================================================================
 */

// ==============================================================================
// 1. PARAMETERS AND CONSTANTS
// ==============================================================================

var flagCollectionSamples = false;
// Define the list of years for targeted analysis execution
var targetedYearsList = [2025];

// Target analysis geometry limits and metadata configuration
var targetBiome = 'PANTANAL';
var targetRegion = '0';
var outputVersion = '1';
var randomSeed = 1;

// Output asset and input sample directories updated for Collection 11
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

// Load historical integrated references from Collection 10 for interactive data validation
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

// Define explicit model classification features (Spectral bands, terrain parameters, and indices)
var bandNamesList = ee.List([
    'slope', 'longitude',
    "brightness_median", "latitude", "avi_median_wet", "nir_median_dry", "avi_median",
    "brightness_median_dry", "brightness_median_wet", "wetness_median", "merit_dem",
    "swir1_median_wet", "wetness_median_wet", "savi_median_wet", "roughness",
    "green_median_dry", "gcvi_median", "ri_median_wet", "green_median_wet",
    "red_median_dry", "gcvi_stdDev", "evi_median", "savi_stdDev", "ri_median",
    "wetness_median_dry", "nir_median_wet", "osavi_median", "swir2_median_wet",
    "iia_median_wet", "red_median_wet", "evi_median_wet",
    "avi_median_dry", "savi_median", "gcvi_median_wet", "bsi_median_dry",
    "mndwi_median", "ratio_median", "lswi_median_wet", "swir1_median_dry",
    "brba_median", "iia_median", "wefi_median_wet", "ndwi2_median_wet",
    "hallheigth_median_dry", "lai_median", "hallcover_median_dry", "nddi_median_wet",
    "mndwi_median_wet", "ratio_median_dry", "hallcover_median_wet", "ri_median_dry"
]);
// Define band processing separation schemas (On-the-fly calculated vs Pre-computed Assets)
var bandasOnTheFly = [
  "green_median_dry", "afvi_median", "afvi_median_dry", "afvi_median_wet",
   "avi_median", "avi_median_dry", "avi_median_wet", "blue_median_wet", "brba_median", "brba_median_dry",
  "brba_median_wet", "brightness_median", "brightness_median_dry", "brightness_median_wet",
  "bsi_median", "bsi_median_dry", "bsi_median_wet", "co2flux_median",
  "cvi_median", "cvi_median_dry", "cvi_median_wet", "dswi5_median", "dswi5_median_dry",
  "dswi5_median_wet", "evi_median", "evi_median_dry", "evi_median_wet",
  "gli_median", "gli_median_dry", "gli_median_wet", "green_median_texture", "green_median_wet",
  "gvmi_median", "gvmi_median_dry", "gvmi_median_wet", "hallcover_median_dry", "hallcover_median_wet",
  "hallheigth_median_dry", "hallheigth_median_wet", "iia_median", "iia_median_dry", "iia_median_wet",
  "lai_median", "lswi_median", "lswi_median_dry", "lswi_median_wet",
  "mbi_median", "mbi_median_dry", "mbi_median_wet", "mndwi_median", "mndwi_median_dry",
  "mndwi_median_wet", "msi_median", "msi_median_dry", "msi_median_wet", "nddi_median", "nddi_median_dry",
  "nddi_median_wet", "ndvi_median_dry", "ndvi_median_wet", "ndwi_median_dry", "ndwi_median_wet",
  "ndwi2_median", "ndwi2_median_dry", "ndwi2_median_wet", "nir_median_dry", "nir_median_wet",
  "osavi_median", "osavi_median_dry", "osavi_median_wet", "ratio_median", "ratio_median_dry",
  "ratio_median_wet", "red_median_dry", "red_median_wet", "ri_median", "ri_median_dry", "ri_median_wet",
 "rvi_median", "rvi_median_dry", "rvi_median_wet", "spri_median", "spri_median_dry",
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

// Import dynamic monthly Landsat mosaic module and define baseline asset repository
var mosaicModule = require('users/gee_arcplan/MapBiomas_Col11_Pantanal:mosaicos_mensais_do_Google_v1');
var ASSET_MOSAICS_REPOSITORY = 'projects/nexgenmap/MapBiomas2/LANDSAT/BRAZIL/mosaics-2';

// Load regional operational zone vectors
var pantanalRegionsFC = ee.FeatureCollection('projects/ee-arcplan-df/assets/col11/regions_buffer');
var selectedRegionId = 'reg' + targetRegion;
var regionFilterLimit = pantanalRegionsFC.filter(ee.Filter.eq('id_reg', selectedRegionId));
var analysisGeometry = regionFilterLimit.geometry();
Map.addLayer(regionFilterLimit, {}, 'Target Analysis Region', false);

// Per-class caps on the stable sample pool.
var samplesForestLimit = 1250;
var samplesSavannaLimit = 1600;
var samplesGrasslandLimit = 4000;
var samplesAgricultureLimit = 900;
var samplesWaterLimit = 900;
var samplesNonVegetatedLimit = 200;

// Per-class caps on the complementary sample pool.
var compCaveLimit = 1;
var compSavannaLimit = 50;
var compGrasslandLimit = 200;
var compForestLimit = 1000;
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
    var operationalYearNum = ee.Number(operationalYear);

    // Build the predictor stack: live mosaic + stored mosaic asset + terrain.
    var calculatedMosaic = mosaicModule.getMosaic(operationalYear, regionFilterLimit).select(bandasOnTheFly);

    var staticAssetMosaic = ee.ImageCollection(ASSET_MOSAICS_REPOSITORY)
                              //.filter(ee.Filter.eq('biome', 'PANTANAL'))
                              .filter(ee.Filter.eq('year', operationalYearNum))
                              .mosaic().select(bandasAsset)

    // Coordinates as predictors: they let the model learn regional context.
    var geographicCoordinates = ee.Image.pixelLonLat().select(['longitude', 'latitude']);

    // Assemble and clip the final predictor stack.
    var finalRegionalImage = calculatedMosaic.addBands(staticAssetMosaic)
                                             .addBands(geographicCoordinates)
                                             .addBands(terrainBands)
                                             .select(bandNamesList)
                                             .clip(analysisGeometry);

    // Agricultural quota grows through the series, following real cropland expansion.
    if (operationalYear == 2000) { samplesAgricultureLimit = 1000; }
    else if (operationalYear == 2001) { samplesAgricultureLimit = 1100; }
    else if (operationalYear == 2002) { samplesAgricultureLimit = 1100; }
    else if (operationalYear == 2003) { samplesAgricultureLimit = 1200; }
    else if (operationalYear == 2004) { samplesAgricultureLimit = 1200; }
    else if (operationalYear == 2005) { samplesAgricultureLimit = 1300; }
    else if (operationalYear == 2006) { samplesAgricultureLimit = 1400; }
    else if (operationalYear == 2007) { samplesAgricultureLimit = 1500; }
    else if (operationalYear == 2008) { samplesAgricultureLimit = 1600; }
    else if (operationalYear == 2009) { samplesAgricultureLimit = 1700; }
    else if (operationalYear == 2010) { samplesAgricultureLimit = 1800; }
    else if (operationalYear == 2011) { samplesAgricultureLimit = 1900; }
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
           Map.addLayer(staticAssetMosaic, {
            bands: ['swir1_median', 'nir_median', 'red_median'],
            gain: [0.08, 0.06, 0.2],
            gamma: 0.85
        }, 'Landsat Mosaic Asset ' + operationalYear, false);}

    var primaryStableSamplesFC = ee.FeatureCollection(samplesDirectory + 'pts_trained_stable_v' + processingVersionPt + '_regiao_' + targetRegion + '_trained')
                                   .filter(ee.Filter.eq('id_reg', selectedRegionId))
                                   .filter(ee.Filter.eq('ano', operationalYearNum)); // Keep only the samples of the current year.

    // Segregate primary samples into target reference classes
    var classForestSamples = primaryStableSamplesFC.filter(ee.Filter.eq("reference", 3));
    var classSavannaSamples = primaryStableSamplesFC.filter(ee.Filter.eq("reference", 4));
    var classGrasslandSamples = primaryStableSamplesFC.filter(ee.Filter.eq("reference", 12));
    var classAgroSamples = primaryStableSamplesFC.filter(ee.Filter.eq("reference", 21));
    var classWaterSamples = primaryStableSamplesFC.filter(ee.Filter.eq("reference", 33));
    var classNonVegSamples = primaryStableSamplesFC.filter(ee.Filter.eq("reference", 25));

    // Balance feature density limits per class profile
    classForestSamples = shuffleCollection(classForestSamples, 2).limit(samplesForestLimit);
    classSavannaSamples = shuffleCollection(classSavannaSamples, 2).limit(samplesSavannaLimit);
    classGrasslandSamples = shuffleCollection(classGrasslandSamples, 2).limit(samplesGrasslandLimit);
    classAgroSamples = shuffleCollection(classAgroSamples, 2).limit(samplesAgricultureLimit);
    classWaterSamples = shuffleCollection(classWaterSamples, 2).limit(samplesWaterLimit);
    classNonVegSamples = shuffleCollection(classNonVegSamples, 2).limit(samplesNonVegetatedLimit);

    if (flagCollectionSamples) {
       print('Stable Sample Pool Sizes for Year ' + operationalYear, {
         'Forest': classForestSamples.size(),
         'Savanna': classSavannaSamples.size(),
         'Grassland': classGrasslandSamples.size(),
         'Agro': classAgroSamples.size(),
         'Water': classWaterSamples.size()
       });
    }

    // Combine balanced baseline training subsets
    var unifiedStablePoints = classForestSamples.merge(classSavannaSamples).merge(classGrasslandSamples)
                                                .merge(classAgroSamples).merge(classWaterSamples).merge(classNonVegSamples);

    // Fetch year-specific complementary point tracking datasets
       var complementarySamplesFC = ee.FeatureCollection(samplesDirectory + 'pts_trained_stable8910_v' + processingVersionPt + '_regiao_' + targetRegion + '_trained')
                                   .filter(ee.Filter.eq('id_reg', selectedRegionId))
                                   .filter(ee.Filter.eq('ano', operationalYearNum)); // Keep only the samples of the current year.

    // Filter and shuffle complementary tracking layers
    var compCavePoints = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 12)), randomSeed).limit(compCaveLimit);
    var compSavannaPoints = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 4)), randomSeed).limit(compSavannaLimit);
    var compGrasslandPoints = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 12)), randomSeed).limit(compGrasslandLimit);
    var compForestPoints = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 3)), randomSeed).limit(compForestLimit);
    var compAgroPoints = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 21)), randomSeed).limit(compAgroLimit);
    var compWaterPoints = shuffleCollection(complementarySamplesFC.filter(ee.Filter.eq('reference', 33)), randomSeed).limit(compWaterLimit);
    var compStrictAgricPoints = complementarySamplesFC.filter(ee.Filter.eq('reference', 19));

    // Irrigated agriculture (19) is rare early in the series and grows later.
    var compStrictAgricLimit = 50;
    if (operationalYear >= 1990) { compStrictAgricLimit = 100; }
    if (operationalYear >= 2000) { compStrictAgricLimit = 150; }
    if (operationalYear >= 2010) { compStrictAgricLimit = 200; }
    compStrictAgricPoints = shuffleCollection(compStrictAgricPoints, randomSeed).limit(compStrictAgricLimit);

    // Consolidate balanced complementary point pools
    var unifiedComplementaryPoints = compCavePoints.merge(compSavannaPoints).merge(compGrasslandPoints)
                                                     .merge(compForestPoints).merge(compAgroPoints).merge(compWaterPoints);

    // Build the master training feature collection vector pool
    var masterPointsPool = unifiedStablePoints.merge(unifiedComplementaryPoints);
    if (operationalYear >= 2000) {
        masterPointsPool = masterPointsPool.merge(compStrictAgricPoints);
    }
    masterPointsPool = masterPointsPool.filterBounds(analysisGeometry);

    // 3. Signature Extraction and Model Training
    var trainingSamples = finalRegionalImage.select(bandNamesList).sampleRegions({
        collection: masterPointsPool,
        properties: ['reference'],
        scale: 30,
        geometries: false   // Coordinates are not needed for training and slow the model down.
    });

    // Train the smileRandomForest model
    var spatialClassifierModel = ee.Classifier.smileRandomForest({
        numberOfTrees: randomForestTrees,
        variablesPerSplit: 1
    }).train(trainingSamples, 'reference', bandNamesList);

    // Run classification over the integrated raster stack
    var annuallyClassifiedImage = finalRegionalImage.classify(spatialClassifierModel);
    annuallyClassifiedImage = annuallyClassifiedImage
                                //.updateMask(finalRegionalImage.select('green_median').mask())
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

if (flagCollectionSamples) {
    print('Processing verified successfully. Band structure overview:', classifiedTimeSeriesImage.bandNames());
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
        "region": analysisGeometry
    });
}

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias — ArcPlan — mariana@arcplan.com.br
 * MapBiomas Collection 11 | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
