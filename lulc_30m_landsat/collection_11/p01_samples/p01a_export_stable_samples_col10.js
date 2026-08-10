/**
 * ==============================================================================
 * p01a | Stable samples from MapBiomas Collection 10.1
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Builds the stable-pixel reference map used to train Collection 11.
 *   For every target class the script counts, pixel by pixel, how many years
 *   of the Collection 10.1 series carry that class. Pixels that hold the same
 *   class for at least the number of years declared in CLASS_FREQUENCY are
 *   considered temporally stable and are kept as candidate training pixels.
 *
 * INPUTS
 *   - MapBiomas Collection 10.1 national coverage (1985-2024)
 *   - IBGE 250k biome boundaries
 *
 * OUTPUTS
 *   - PANT_amostras_estaveis85a24_col11_v{VERSION_OUT} (single-band image, "reference")
 *
 * NOTES
 *   - CLASS_FROM / CLASS_TO collapse the full MapBiomas legend into the eight
 *     classes actually modelled in the Pantanal: 3, 4, 12, 19, 21, 25, 29, 33.
 *   - DIR_OUT now ends with a slash; the original run was missing it and wrote
 *     the asset as ".../PANTANALPANT_amostras_estaveis85a24_col11_v1".
 *
 * PIPELINE
 *   p01 samples | step 1a of 4  ->  p02_stratified_sampling
 * ==============================================================================
 */

/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var GEOMETRY_BIOME = 
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
    GEOMETRY_EXTENT = 
    /* color: #d63000 */
    /* shown: false */
    ee.Geometry.Polygon(
        [[[-58.52447025997013, -17.424997598469123],
          [-57.87627690059513, -17.613578719503654],
          [-57.61260502559513, -18.157256401758104],
          [-57.85430424434513, -18.94881631613083],
          [-58.26079838497013, -19.798673028629086],
          [-58.20586674434513, -20.48972460682532],
          [-58.18389408809513, -22.188345355827543],
          [-57.54668705684513, -22.310365386723024],
          [-57.42583744747013, -22.167998358453733],
          [-57.07427494747013, -21.331261069560075],
          [-57.01934330684513, -20.952128413839258],
          [-56.86553471309513, -20.12910885003183],
          [-56.68975346309513, -20.479432983643242],
          [-55.58013432247013, -20.58231809780354],
          [-55.08574955684513, -19.664236562385838],
          [-54.56939213497013, -18.438888085169584],
          [-54.63671769641178, -16.54474949322897],
          [-55.47167863391178, -15.785013561268716],
          [-56.13635148547428, -15.303420839376638],
          [-57.08117570422428, -15.388177819281145],
          [-56.43847550891178, -14.406112990409577],
          [-56.48242082141178, -14.161239158978026],
          [-57.11962785266178, -14.065346772913282],
          [-57.46020402453678, -14.203845019424252],
          [-58.80602921984928, -14.841958516436778],
          [-58.97082414172428, -15.107289155368754],
          [-59.63549699328678, -16.049140990402364],
          [-59.81127824328678, -16.318190561823457],
          [-58.53137101672428, -16.423599668674502]]]);
/***** End of imports. If edited, may not auto-convert in the playground. *****/

// ==============================================================================
// 1. PARAMETERS AND CONSTANTS
// ==============================================================================

// Output configuration variables
var VERSION_OUT = '1';
var DIR_OUT = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/';

// Base assets definitions for Collection 11 preparation
var ASSET_BIOMES_VECTOR = 'projects/mapbiomas-workspace/AUXILIAR/biomas_IBGE_250mil';
var ASSET_COL10 = 'projects/mapbiomas-public/assets/brazil/lulc/collection10_1/mapbiomas_brazil_collection10_1_coverage_v1';

// Full temporal scope for Collection 11 (1985 to 2025)
var YEARS = [
    '1985','1986','1987','1988','1989','1990','1991','1992','1993','1994','1995','1996','1997','1998','1999',
    '2000','2001','2002','2003','2004','2005','2006','2007','2008','2009','2010','2011','2012','2013','2014',
    '2015','2016','2017','2018','2019','2020','2021','2022','2023','2024',//'2025'
];

// Reclassification rules for stable training target classes (From MapBiomas keys -> Grouped Training IDs)
var CLASS_FROM = [3, 4, 5, 9, 11, 12, 15, 18, 19, 20, 36, 39, 40, 41, 21, 22, 23, 24, 25, 26, 29, 30, 31, 32, 33];
var CLASS_TO   = [3, 4, 3, 3, 12, 12, 21, 19, 19, 19, 19, 19, 19, 19, 21, 25, 25, 25, 25, 33, 29, 25, 12, 12, 33];

// Frequency constraints for a pixel to be deemed "stable" over the 41-year period
// Threshold adjusted to 41 iterations (1985-2025) to ensure high statistical reliability
var CLASS_FREQUENCY = {
    "3": 40, "4": 40, "12": 39,
    "19": 40, "21": 40, "25": 40, "29": 40, "33": 39
};

// ==============================================================================
// 2. GEOMETRY AND REGION FILTERING
// ==============================================================================

// Import official IBGE 250k Biome boundaries
var bioma250mil = ee.FeatureCollection(ASSET_BIOMES_VECTOR);

// Biome outline used only for on-screen reference.
var biomaPantanalVetor = bioma250mil;

// Processing extent. GEOMETRY_EXTENT is the hand-drawn envelope that covers the
// Pantanal plus the surrounding plateau strip; it is deliberately wider than the
// IBGE biome polygon so that edge pixels are still sampled.
var geometry = GEOMETRY_EXTENT;

// Generate outline mask for visual inspection on the map canvas.
var blank = ee.Image(0).mask(0);
var outline = blank.paint(biomaPantanalVetor, 'AA0000', 2);
Map.addLayer(outline, {'palette': '000000', 'opacity': 0.6}, 'Biome Boundary (Pantanal)', false);

// ==============================================================================
// 3. DATA PROCESSING AND RECLASSIFICATION
// ==============================================================================

// Load MapBiomas historical data source (Collection 10 integration)
var classCol10 = ee.Image(ASSET_COL10).clip(geometry);

// Import official MapBiomas Palette toolkit
var palettes = require('users/mapbiomas/modules:Palettes.js');
var visParamsOriginal = {
    'min': 0,
    'max': 62,
    'palette': palettes.get('classification8'), // Using updated classification color schemes
    'format': 'png'
};

// Visualization layer for the baseline target year (e.g., 2023)
Map.addLayer(classCol10.select('classification_2023'), visParamsOriginal, 'Original Classification MapBiomas Col10 (2023)', false);

// Map over years array to standardize, remap, and cast bands into an efficient List
var colList = YEARS.map(function (yearString) {
    // Select correct band name format dynamically
    var bandName = 'classification_' + yearString;
    var image = classCol10.select(bandName);

    // Apply categorical reclassification rule matrix for training taxonomy normalization
    var reclassifiedImage = image.remap(CLASS_FROM, CLASS_TO, 0);

    // Return explicit Int8 data type to preserve RAM and asset storage allocation
    return reclassifiedImage.int8().rename('classification');
});

// Convert programmatic client-side JS list to a optimized backend ee.ImageCollection
var annualCollection = ee.ImageCollection.fromImages(colList);

// ==============================================================================
// 4. TEMPORAL PERSISTENCE (FREQUENCY FILTER)
// ==============================================================================

/**
 * Calculates a binary/valued spatial mask identifying pixels that remained stable
 * across the entire historical series according to specific class thresholds.
 * * @param {ee.ImageCollection} collection Historical annual classification stacks
 * @param {String} classId Categorical target class identification key
 * @return {ee.Image} Formatted single-band frequency mask containing the stable class ID
 */
var getFrequencyMask = function(collection, classId) {
    var classIdInt = ee.Number.parse(classId);

    // Generate binary indicator flags (1 if pixel matches classIdInt, 0 otherwise) for each year
    var maskCollection = collection.map(function(image) {
        return image.eq(classIdInt);
    });

    // Compute pixel-wise cumulative sum across the timeline
    var frequency = maskCollection.reduce(ee.Reducer.sum());

    // Evaluate persistence against the defined strict threshold condition
    var frequencyMask = frequency.gte(ee.Number(CLASS_FREQUENCY[classId]))
        .multiply(classIdInt)
        .toByte();

    // Mask non-persistent pixels and append clean metadata tags
    return frequencyMask.mask(frequencyMask.eq(classIdInt))
                        .rename('frequency')
                        .set('class_id', classIdInt);
};

// Apply stability mask generation processing across all active targeted classes
var frequencyMasks = Object.keys(CLASS_FREQUENCY).map(function(classId) {
    return getFrequencyMask(annualCollection, classId);
});

// Mosaic and collapse the target structural stack selecting the first non-null observation
var referenceMap = ee.ImageCollection.fromImages(frequencyMasks)
    .reduce(ee.Reducer.firstNonNull())
    .clip(geometry);

// Drop non-target class indicators (e.g., ID 27 if found or remnants) and name standard training band
referenceMap = referenceMap.mask(referenceMap.neq(27)).rename("reference");

// Render persistent training pixels representation onto the canvas
var visParamsReference = {
    'min': 0,
    'max': 62,
    'palette': palettes.get('classification8')
};
Map.addLayer(referenceMap, visParamsReference, 'Stable Training Pixels (1985-2024)', true);

// ==============================================================================
// 5. EXPORT OPERATIONS
// ==============================================================================

var outputName = 'PANT_amostras_estaveis85a24_col11_v' + VERSION_OUT;

// Task initialization for Google Earth Engine Cloud Asset Storage
Export.image.toAsset({
    "image": referenceMap.toInt8(),
    "description": outputName,
    "assetId": DIR_OUT + outputName,
    "scale": 30, // Maintained 30m spatial resolution to match Landsat historical continuum
    "pyramidingPolicy": {
        '.default': 'mode' // Mode method forces spatial pyramid to respect categorical integrity
    },
    "maxPixels": 1e13,
    "region": geometry
});

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias — ArcPlan — mariana@arcplan.com.br
 * MapBiomas Collection 11 | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
