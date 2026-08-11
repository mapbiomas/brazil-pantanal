/**
 * ==============================================================================
 * p01 | Regional classification - region 1
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Annual land use and land cover classification for Region 1 - Paraguay river floodplain.
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
 *   - pontos_trained_stable_cleaned_v{samplesVersion}_reg1_trained
 *   - pontos_trained_stable91011_cleaned_v{samplesVersion}_reg1_trained
 *   - Hand-drawn reinforcement polygons (imports block)
 *
 * OUTPUTS
 *   - PANT_col4_reg1_v{outputVersion} (one band per year, 2017-2025)
 *
 * NOTES
 *   - Set flagCollectionSamples to true to preview targetedYearsList on the map
 *     without queueing an export.
 *   - The year ladders were inherited from the 1985-2025 Landsat pipeline; the
 *     branches that could never fire in a 2017-2025 series have been collapsed,
 *     leaving the same values per year.
 *
 * PIPELINE
 *   p02 classification | region 1 of 0-8  ->  p02_merge_regions_gapfill
 * ==============================================================================
 */

/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var MANUAL_SAMPLES_SAVANNA = /* color: #d63000 */ee.FeatureCollection(
        [ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.47719721515301, -19.96991892681073],
                  [-57.479600474430356, -19.977058048282117],
                  [-57.47374252994183, -19.977118547929937],
                  [-57.473892733646665, -19.969555911997237]]]),
            {
              "reference": 4,
              "system:index": "0"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.44911867957427, -19.95358460353426],
                  [-57.45263773780181, -19.962862325996205],
                  [-57.445256298592824, -19.965605200309202],
                  [-57.44731623511626, -19.955682223295923]]]),
            {
              "reference": 4,
              "system:index": "1"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.52562262479216, -19.903453567060264],
                  [-57.5276825613156, -19.907650109854035],
                  [-57.51875616971404, -19.91023254240286]]]),
            {
              "reference": 4,
              "system:index": "2"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.44425513211638, -20.09702387210338],
                  [-57.455928105749194, -20.093477227860184],
                  [-57.447688359655444, -20.100570436021286]]]),
            {
              "reference": 4,
              "system:index": "3"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.38383032742888, -19.94735034933365],
                  [-57.39344336453826, -19.94735034933365],
                  [-57.38554694119841, -19.951545726689695]]]),
            {
              "reference": 4,
              "system:index": "4"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-57.391726750768726, -19.902162300733092],
                  [-57.39790656033904, -19.907650109854035],
                  [-57.39344336453826, -19.911200943740223]]]),
            {
              "reference": 4,
              "system:index": "5"
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
var manualSamplesLimit = 1000;

// Define the list of years for targeted analysis execution
var targetedYearsList = [2025];

// Target analysis geometry limits and metadata configuration
var targetBiome = 'PANTANAL';
var targetRegion = '1';
var outputVersion = '1';
var randomSeed = 1;

// Output asset and input sample directories updated for Collection 11 (10m Sentinel)
var outputDirectory = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan/';
var samplesDirectory = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/SAMPLES/PANTANAL/trained/';

var samplesVersion = 5;
var processingVersionPt = samplesVersion;
var randomForestTrees = 200;

// Fewer trees while collecting samples interactively; the map is only a preview.
if (flagCollectionSamples) {
    randomForestTrees = 20;
}

// Region 1 Baseline Stable Training Database Limits (Preserving Legacy Balance)
var samplesForestLimit = 500;
var samplesSavannaLimit = 1500;
var samplesGrasslandLimit = 1000;
var samplesAgricultureLimitBase = 800;
var samplesWaterLimit = 900;
var samplesNonVegetatedLimit = 200;

// Region 1 Complementary Tracking Allocation Subsets (Preserving Legacy Balance)
var compCaveLimit = 1;
var compSavannaLimit = 650;
var compGrasslandLimit = 200;
var compForestLimit = 350;
var compAgroLimit = 100;
var compWaterLimit = 1;

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

// Predictor bands for this region: the full 64-band embedding block, both
// coordinate bands, and the fifty spectral and terrain bands that ranked highest
// in the feature-importance run (p01/p05).
var bandNamesList = ee.List([
     'A00','A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22',
      'A23','A24','A25','A26','A27','A28','A29','A30','A31','A32','A33','A34','A35','A36','A37','A38','A39','A40','A41','A42','A43','A44','A45',
      'A46','A47','A48','A49','A50','A51','A52','A53','A54','A55','A56','A57','A58','A59','A60','A61','A62','A63',
      'latitude','longitude',
      'roughness','red_edge_1_median','merit_dem','hallheight_median_dry','brightness_median_dry','red_edge_1_median_dry','tgsi_median_wet','gari_median_wet',
      'gcvi_median_wet','tgsi_median_dry','wetness_median_dry','nir_median_dry','red_edge_2_median_dry','ireci_median_wet','spri_median','wetness_median',
      'swir1_median_dry','tgsi_median','hallheight_median','red_edge_4_median_dry','cvi_median_dry','avi_median_dry','evi2_median_wet','green_median_wet',
      'red_edge_3_median','red_median_wet','red_median_dry','ndci_median_wet','iia_median_wet','red_edge_2_median','green_median_dry','red_median',
      'green_median','msavi_median_wet','red_edge_1_median_wet','red_edge_4_median','avi_median','osavi_median_wet','swir2_median','ireci_median',
      'cvi_median','gari_median','sfdvi_median_wet','nir_median','hallcover_median_dry','red_edge_3_median_dry','swir1_stdDev','swir2_median_dry',
      'grnd_median_dry','evi_median',
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

// Terrain metrics derived from MERIT DEM & Geomorpho90m datasets
var demImage = ee.Image('MERIT/DEM/v1_0_3').select('dem').toInt64().rename('merit_dem');
var aspectImage = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/aspect").mosaic().multiply(10000).round().rename('aspect').toInt64();
var convergenceImage = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/convergence").mosaic().multiply(10000).round().rename('convergence').toInt64();
var roughnessImage = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/roughness").mosaic().multiply(10000).round().rename('roughness').toInt64();
var eastnessImage = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/eastness").mosaic().multiply(10000).round().rename('eastness').toInt64();
var northnessImage = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/northness").mosaic().multiply(10000).round().rename('northness').toInt64();
var dxxImage = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/dxx").mosaic().multiply(10000).round().rename('dxx').toInt64();
var ctiImage = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/cti").mosaic().multiply(10000).round().rename('cti').toInt64();

// Generate coordinate bands dynamically on-the-fly
var lonLatGrid = ee.Image.pixelLonLat();
var customLongitude = lonLatGrid.select('longitude').add(34.8).multiply(-1).multiply(1000).toInt16().rename('longitude');
var customLatitude = lonLatGrid.select('latitude').add(5).multiply(-1).multiply(1000).toInt16().rename('latitude');

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

  var baseMosaic = unifiedMosaics.filterBounds(processingROI).filter(ee.Filter.eq('year', year)).mosaic();
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

    // The agricultural quota grows through the series, following real expansion.
    var currentSamplesAgricultureLimit = samplesAgricultureLimitBase;
    else if (operationalYear == 2001 || operationalYear == 2002) { currentSamplesAgricultureLimit = 130; }
    else if (operationalYear >= 2003 && operationalYear <= 2005) { currentSamplesAgricultureLimit = 150; }
    else if (operationalYear == 2006) { currentSamplesAgricultureLimit = 160; }
    else if (operationalYear == 2007) { currentSamplesAgricultureLimit = 170; }
    else if (operationalYear == 2008) { currentSamplesAgricultureLimit = 180; }
    else if (operationalYear == 2009) { currentSamplesAgricultureLimit = 190; }
    else if (operationalYear == 2010) { currentSamplesAgricultureLimit = 200; }
    else if (operationalYear == 2011) { currentSamplesAgricultureLimit = 210; }
    else if (operationalYear == 2012) { currentSamplesAgricultureLimit = 220; }
    else if (operationalYear == 2013) { currentSamplesAgricultureLimit = 230; }
    else if (operationalYear == 2014 || operationalYear == 2015) { currentSamplesAgricultureLimit = 250; }
    else if (operationalYear == 2016) { currentSamplesAgricultureLimit = 260; }
    else if (operationalYear == 2017) { currentSamplesAgricultureLimit = 280; }
    else if (operationalYear == 2018) { currentSamplesAgricultureLimit = 290; }
    else if (operationalYear == 2019) { currentSamplesAgricultureLimit = 300; }
    else if (operationalYear == 2020) { currentSamplesAgricultureLimit = 310; }
    else if (operationalYear == 2021 || operationalYear == 2022) { currentSamplesAgricultureLimit = 320; }
    else if (operationalYear >= 2023) { currentSamplesAgricultureLimit = 330; }

    if (flagCollectionSamples) {
        Map.addLayer(finalRegionalImage, {
            bands: ['swir1_median_dry', 'nir_median_dry', 'red_median_dry'],
            gain: [0.08, 0.06, 0.2],
            gamma: 0.85
        }, 'Sentinel Mosaic Asset ' + operationalYear, false);
    }

    // Two independent sample sources. Which one feeds which class is deliberate:
    // the Sentinel table carries fine spatial detail, the Landsat table carries
    // classes that need a longer record to be reliable.
    var samplesSentinel = ee.FeatureCollection(samplesDirectory + 'pontos_trained_stable_cleaned_v2_' + selectedRegionId + '_trained')
                                             .filter(ee.Filter.eq('year', operationalYear));
    var samplesLandsat = ee.FeatureCollection(samplesDirectory + 'pontos_trained_stable91011_cleaned_v2_' + selectedRegionId + '_trained')
                                             .filter(ee.Filter.eq('year', operationalYear));

    // Split the pool by class.
    var classForestSamples = samplesLandsat.filter(ee.Filter.eq("reference", 3));
    var classSavannaSamples = samplesSentinel.filter(ee.Filter.eq("reference", 4));
    var classGrasslandSamples = samplesSentinel.filter(ee.Filter.eq("reference", 12));
    var classAgroSamples = samplesLandsat.filter(ee.Filter.eq("reference", 21));
    var classWaterSamples = samplesSentinel.filter(ee.Filter.eq("reference", 33));
    var classNonVegSamples = samplesSentinel.filter(ee.Filter.eq("reference", 25));

    // Apply sampling density thresholds to balance primary database sets (Region 1 constraints)
    classForestSamples = shuffleCollection(classForestSamples, randomSeed).limit(samplesForestLimit);
    classSavannaSamples = shuffleCollection(classSavannaSamples, randomSeed).limit(samplesSavannaLimit);
    classGrasslandSamples = shuffleCollection(classGrasslandSamples, randomSeed).limit(samplesGrasslandLimit);
    classAgroSamples = shuffleCollection(classAgroSamples, randomSeed).limit(currentSamplesAgricultureLimit);
    classWaterSamples = shuffleCollection(classWaterSamples, randomSeed).limit(samplesWaterLimit);
    classNonVegSamples = shuffleCollection(classNonVegSamples, randomSeed).limit(samplesNonVegetatedLimit);

    if (flagCollectionSamples) {
       print('Sample pool sizes for ' + operationalYear, {
         'Forest': classForestSamples.size(),
         'Savanna': classSavannaSamples.size(),
         'Grassland': classGrasslandSamples.size(),
         'Agro': classAgroSamples.size(),
         'Water': classWaterSamples.size()
       });
    }

    // Merge the balanced stable pools.
    var unifiedStablePoints = classForestSamples.merge(classSavannaSamples).merge(classGrasslandSamples)
                                                 .merge(classAgroSamples).merge(classWaterSamples).merge(classNonVegSamples);

    // Dynamic spatial tracking constraints for restrictive auxiliary layers
    var compStrictAgricLimit = 350;

    // Isolate, shuffle, and parameterize regional complementary vector maps (Region 1 constraints)
    var compForestPoints = shuffleCollection(samplesSentinel.filter(ee.Filter.eq('reference', 3)), randomSeed).limit(compForestLimit);
    var compSavannaPoints = shuffleCollection(samplesLandsat.filter(ee.Filter.eq('reference', 4)), randomSeed).limit(compSavannaLimit);
    var compGrasslandPoints = shuffleCollection(samplesLandsat.filter(ee.Filter.eq('reference', 12)), randomSeed).limit(compGrasslandLimit);
    var compAgroPoints = shuffleCollection(samplesSentinel.filter(ee.Filter.eq('reference', 21)), randomSeed).limit(compAgroLimit);
    var compWaterPoints = shuffleCollection(samplesLandsat.filter(ee.Filter.eq('reference', 33)), randomSeed).limit(compWaterLimit);
    var compCavePoints = shuffleCollection(samplesLandsat.filter(ee.Filter.eq('reference', 12)), randomSeed).limit(compCaveLimit);
    var compStrictAgricPoints = shuffleCollection(samplesLandsat.filter(ee.Filter.eq('reference', 19)), randomSeed).limit(compStrictAgricLimit);

    // Consolidate balanced complementary point pools
    var unifiedComplementaryPoints = compForestPoints.merge(compSavannaPoints).merge(compGrasslandPoints)
                                                     .merge(compAgroPoints).merge(compWaterPoints).merge(compCavePoints);

    // Merge baseline pools to establish final signature target point sets
    // Strict agriculture is always available in this series.
    masterPointsPool = masterPointsPool.merge(compStrictAgricPoints);
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

            // Rasterize manual polygon collection where pixel values correspond to target classification reference IDs
            var manualPolygonsImg = manualPolygonsFC.reduceToImage({
                properties: ['reference'],
                reducer: ee.Reducer.first()
            }).rename('reference').toByte();

            // Stratified/random sampling strictly bound inside the manual geometries at a 10m scale matching Sentinel-2
            var manualTrainingSamples = finalRegionalImage.select(bandNamesList)
                .addBands(manualPolygonsImg)
                .sample({
                    region: manualPolygonsFC.geometry(),
                    scale: samplingScale,
                    numPixels: manualSamplesLimit,
                    seed: randomSeed,
                    geometries: false
                });

            // Concat extracted vector statistics to the definitive training signatures collection
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
// Enforce global metadata parameters and write tracking fields to the final composite
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
        "region": analysisGeometry
    });
}

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias - ArcPlan - mariana@arcplan.com.br
 * MapBiomas Collection 4 (10 m) | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
