/**
 * ==============================================================================
 * p01b | Cross-collection agreement samples (Collections 8, 9 and 10.1)
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Second, independent source of stable pixels. Instead of measuring temporal
 *   persistence inside a single collection, this script compares three published
 *   collections year by year and keeps only the pixels where all three agree
 *   after the legend has been normalised. Agreement across independent model
 *   runs is a strong indicator that the pixel is unambiguous on the ground.
 *   Years outside the range of an older collection fall back to Collection 10.1.
 *
 * INPUTS
 *   - MapBiomas Collection 8 national coverage (through 2022)
 *   - MapBiomas Collection 9 national coverage (through 2023)
 *   - MapBiomas Collection 10.1 national coverage (through 2024)
 *
 * OUTPUTS
 *   - PANT_amostras_estaveis_col8910_v{VERSION_OUT} (one band per year)
 *
 * PIPELINE
 *   p01 samples | step 1b of 4  ->  p02_stratified_sampling
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

// Output configuration variables aligned for Collection 11
var VERSION_OUT = '1';
var DIR_OUT = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL';

// Reference Asset paths for cross-collection consistency analysis
var ASSET_COL10_1 = 'projects/mapbiomas-public/assets/brazil/lulc/collection10_1/mapbiomas_brazil_collection10_1_coverage_v1';
var ASSET_COL9    = 'projects/mapbiomas-public/assets/brazil/lulc/collection9/mapbiomas_collection90_integration_v1';
var ASSET_COL8    = 'projects/mapbiomas-public/assets/brazil/lulc/collection8/mapbiomas_collection80_integration_v1';
var ASSET_BIOMES_VECTOR = 'projects/mapbiomas-workspace/AUXILIAR/biomas_IBGE_250mil';

// Complete temporal scope required for Collection 11 training data
var YEARS = [
    '1985','1986','1987','1988','1989','1990','1991','1992','1993','1994','1995','1996','1997','1998','1999',
    '2000','2001','2002','2003','2004','2005','2006','2007','2008','2009','2010','2011','2012','2013','2014',
    '2015','2016','2017','2018','2019','2020','2021','2022','2023','2024'//,'2025'
];


// Reclassification rules for stable training target classes (From MapBiomas keys -> Grouped Training IDs)
var CLASS_FROM = [3, 4, 5, 6, 9, 11, 12, 15, 18, 19, 20, 36, 39, 40, 41, 21, 22, 23, 24, 25, 26, 29, 30, 31, 32, 33];
var CLASS_TO   = [3, 4, 3, 3, 3, 12, 12, 21, 19, 19, 19, 19, 19, 19, 19, 21, 25, 25, 25, 25, 33, 29, 25, 12, 12, 33];

// ==============================================================================
// 2. GEOMETRY AND REGION FILTERING
// ==============================================================================

// Load official IBGE 250k Biome FeatureCollection
var bioma250mil = ee.FeatureCollection(ASSET_BIOMES_VECTOR);

// Isolate Pantanal Biome boundary and extract backend geometry reference
var biomaPantanalVetor = bioma250mil.filter(ee.Filter.eq('Bioma', 'Pantanal'));

// Processing extent: hand-drawn envelope wider than the IBGE polygon so that
// border pixels are still evaluated.
var geometry = GEOMETRY_EXTENT;

// Canvas overlay: Paint vector boundary outline for QA/QC inspection
var blank = ee.Image(0).mask(0);
var outline = blank.paint(biomaPantanalVetor, 'AA0000', 2);
Map.addLayer(outline, {'palette': '000000', 'opacity': 0.6}, 'Biome Boundary (Pantanal)', false);

// ==============================================================================
// 3. MULTI-COLLECTION INGESTION AND RECLASSIFICATION
// ==============================================================================

// Load integration map assets from Collections 8, 9, and 10.1 clipped to region
var classCol10_1 = ee.Image(ASSET_COL10_1).clip(geometry);
var classCol9    = ee.Image(ASSET_COL9).clip(geometry);
var classCol8    = ee.Image(ASSET_COL8).clip(geometry);

// Import official MapBiomas Palette visualization kit
var palettes = require('users/mapbiomas/modules:Palettes.js');
var visParamsOriginal = {
    'min': 0,
    'max': 62,
    'palette': palettes.get('classification8'),
    'format': 'png'
};

// Add baseline verification maps to canvas
Map.addLayer(classCol8.select('classification_2021'), visParamsOriginal, 'Original Baseline Col8 (2021)', false);

// ==============================================================================
// 4. INTERSECTION AND STABILITY PIPELINE (MAP-REDUCE)
// ==============================================================================

/**
 * Functional Mapping Routine: For each year, extracts classifications from Col 8, 9,
 * and 10.1, normalizes their taxonomy, and executes an intersection filter.
 * If a year does not exist in an older collection, it falls back to the newer collection.
 */
var crossCollectionBands = YEARS.map(function (yearString) {
    var bandName = 'classification_' + yearString;

    // Base reference layer always derived from Collection 10.1
    var img10_1 = classCol10_1.select(bandName);
    var reclass10_1 = img10_1.remap(CLASS_FROM, CLASS_TO, 0);

    // Dynamic fallback structure for years beyond the scope of Collection 8 and 9
    // Collection 8 ends in 2022; Collection 9 ends in 2023
    var yearNum = ee.Number.parse(yearString);

    var img9 = ee.Algorithms.If(yearNum.lte(2023), classCol9.select(bandName), img10_1);
    var img8 = ee.Algorithms.If(yearNum.lte(2022), classCol8.select(bandName), img10_1);

    var reclass9 = ee.Image(img9).remap(CLASS_FROM, CLASS_TO, 0);
    var reclass8 = ee.Image(img8).remap(CLASS_FROM, CLASS_TO, 0);

    // Logical Intersection Matrix: Pixel values must match across all evaluated versions
    var match9vs8   = reclass9.eq(reclass8);
    var match10vs98 = reclass10_1.eq(reclass9).and(match9vs8);

    // Build the final cross-collection stable image band for the current year
    var stableYearImage = reclass10_1.mask(match10vs98).selfMask();

    return stableYearImage.int8().rename('classification_' + yearString);
});

// Convert the programmatic list array into a clean multi-band ee.Image stack
var assetMask = ee.Image(crossCollectionBands);

// Print operational diagnostic metadata info to GEE console
print('Processed Cross-Collection Multi-Band Mask:', assetMask);

// Visual verification layers for specific target years
Map.addLayer(assetMask.select('classification_2021'), visParamsOriginal, 'Cross-Collection Intersection Map (2021)', false);

// ==============================================================================
// 5. EXPORT OPERATIONS
// ==============================================================================

var outputName = 'PANT_amostras_estaveis_col8910_v' + VERSION_OUT;

// Initialize automatic cloud processing engine export task
Export.image.toAsset({
    "image": assetMask,
    "description": outputName,
    "assetId": DIR_OUT + '/' + outputName,
    "scale": 30, // Maintained 30-meter pixel footprint matching Landsat series criteria
    "pyramidingPolicy": {
        '.default': 'mode' // Mode restriction keeps integer IDs stable without intermediate filtering
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
