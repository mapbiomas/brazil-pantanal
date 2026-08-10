/**
 * ==============================================================================
 * p08 | Custom consistency rules
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   A short set of rules that encode things known about the Pantanal but not
 *   learnable from spectral data alone.
 *   
 *     A. 1985 pasture that is not pasture in 1986 takes the 1986 class: the first
 *        year of the Landsat 5 series is the least reliable in the whole map.
 *     B. forest mapped where the pixel has been water or wetland at any point in
 *        the series becomes grassland, since forest does not stand on ground that
 *        floods; a trajectory rule also converts forest to savanna where the
 *        trajectory codes disagree.
 *     C. an isolated 2011 wetland year with no wetland on either side is removed.
 *     D. agriculture (19) and non-vegetated areas (25) are made irreversible: once
 *        a pixel is converted it stays converted for the rest of the series.
 *
 * INPUTS
 *   - PANT_col11_Anual_v35 (from p07)
 *   - trajectories_3_col11_v4 and trajectories_4_col11_v4
 *
 * OUTPUTS
 *   - PANT_col11_Anual_v{VERSION_OUT} (one band per year, 1985-2025)
 *
 * PIPELINE
 *   p03 post-classification | step 8 of 9  ->  p09_pasture_outcrop_filter
 * ==============================================================================
 */

/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var REGIONS_BUFFER_FC = ee.FeatureCollection("projects/ee-arcplan-df/assets/col11/regions_buffer");
/***** End of imports. If edited, may not auto-convert in the playground. *****/

// ==============================================================================
// 1. PARAMETERS AND CONSTANTS
// ==============================================================================

var VERSION_OUT = '36';
var COLLECTION_ID = 11.0;
var DIR_OUT = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/';
var PREFIX_OUT = 'PANT_col11_Anual_v';
var DESCRIPTION = 'Custom consistency rules - Col 11';

// Generate temporal scope for Collection 11 (1985 to 2025)
var years = [];
for (var y = 1985; y <= 2025; y++) years.push(y);

// Import MapBiomas palettes
var palettes = require('users/mapbiomas/modules:Palettes.js');
var visClassification = {
    'min': 0,
    'max': 62,
    'palette': palettes.get('classification7')
};

// ==============================================================================
// 2. ASSETS
// ==============================================================================

var baseCollection = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/PANT_col11_Anual_v35');

// ==============================================================================
// 3. RULE A & B: BASE YEAR ADJUSTMENTS AND CONTEXTUAL RECLASS
// ==============================================================================

// Rule A: If class is 21 in 1985 AND NOT 21 in 1986, copy 1986 value into 1985
var class1985 = baseCollection.select('classification_1985');
var class1986 = baseCollection.select('classification_1986');
var conditionRuleA = class1985.eq(21).and(class1986.neq(21));
var fixed1985 = class1985.where(conditionRuleA, class1986);

var preparedCollection = baseCollection.addBands(fixed1985, null, true);

// Rule: where the savanna trajectory is coded 1, 3 or 5 and the forest trajectory
// is coded 2, 4 or 6, the pixel is savanna that the model read as forest.
var trajalagag = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-temp/trajectories_4_col11_v4')
var trajFlo = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-temp/trajectories_3_col11_v4')

// Apply the substitution across every year.
var trajectoryProcessedList = years.map(function(year) {
    var imgYear = preparedCollection.select('classification_' + year);
    // Replace class 3 with 4 based on the trajectory condition
    var updatedImg = imgYear.where(imgYear.eq(3).and(trajalagag.eq(1).or(trajalagag.eq(3)).or(trajalagag.eq(5)).and(trajFlo.eq(2).or(trajFlo.eq(4)).or(trajFlo.eq(6)))), 4);
    return updatedImg.rename('class');
});
var collectionRuleD = ee.ImageCollection.fromImages(trajectoryProcessedList).toBands()
    .rename(years.map(function(y) { return 'classification_' + y; }));

// Rule B: Presence Mask (Homogenized)
var presenceList = years.map(function(year) {
    var imgYear = collectionRuleD.select('classification_' + year);
    // All bands share one name so that reduce() can run over them.
    return imgYear.eq(33).or(imgYear.eq(11)).rename('mask');
});

// Reduce requires homogeneous bands
var presenceMask = ee.ImageCollection.fromImages(presenceList).reduce(ee.Reducer.max());

// Rule B: Contextual Reclass (Homogenized)
var contextualProcessedList = years.map(function(year) {
    var imgYear = collectionRuleD.select('classification_' + year);
    // Forest cannot stand where the pixel has been water or wetland at any point.
    var updatedImg = imgYear.where(imgYear.eq(3).and(presenceMask), 12);
    return updatedImg.rename('class');
});

// Convert to bands and rename back to correct temporal names
var collectionRuleB = ee.ImageCollection.fromImages(contextualProcessedList).toBands()
    .rename(years.map(function(y) { return 'classification_' + y; }));

// ==============================================================================
// 4. RULE C: SPECIFIC TEMPORAL CONSTRAINT FOR 2011
// ==============================================================================
var class2010 = collectionRuleB.select('classification_2010');
var class2011 = collectionRuleB.select('classification_2011');
var class2012 = collectionRuleB.select('classification_2012');

var keepWater2011 = class2010.eq(11).or(class2012.eq(11));
var conditionRuleC = class2011.eq(11).and(keepWater2011.not());

var fixed2011 = class2011.where(conditionRuleC, class2010);
var collectionRuleC = collectionRuleB.addBands(fixed2011, null, true);

// ==============================================================================
// 5. RULE D & E: INCREMENTAL PERSISTENCE (CLASSES 19 AND 25)
// ==============================================================================
// Agriculture (19) and non-vegetated areas (25) do not revert: once a pixel has
// been converted it stays converted for the rest of the series.
var finalIncrementalList = [];
var currentYearImg = collectionRuleC.select('classification_1985');

finalIncrementalList.push(currentYearImg.rename('class'));

var cumulative19 = currentYearImg.eq(19);
var cumulative25 = currentYearImg.eq(25);

for (var i = 1; i < years.length; i++) {
    var year = years[i];
    var rawYearImg = collectionRuleC.select('classification_' + year);

    var persistentYearImg = rawYearImg
        .where(cumulative19, 19)
        .where(cumulative25, 25);

    finalIncrementalList.push(persistentYearImg.rename('class'));

    cumulative19 = cumulative19.or(persistentYearImg.eq(19));
    cumulative25 = cumulative25.or(persistentYearImg.eq(25));
}

// Rebuild the multi-band image with the proper band names (1985-2025).
var finalExportImage = ee.ImageCollection.fromImages(finalIncrementalList).toBands()
    .rename(years.map(function(y) { return 'classification_' + y; }))
    .toByte();

Map.addLayer(baseCollection.select('classification_2025'), visClassification, '2025 before', false);
Map.addLayer(finalExportImage.select('classification_2025'), visClassification, '2025 after', true);
// ==============================================================================
// 6. METADATA AND ASSET EXPORT
// ==============================================================================
finalExportImage = finalExportImage
    .set('territory', 'BRAZIL')
    .set('biome', 'PANTANAL')
    .set('source', 'arcplan')
    .set('version', VERSION_OUT)
    .set('collection_id', COLLECTION_ID)
    .set('description', DESCRIPTION);

print('Final image optimized for deployment:', finalExportImage);

Export.image.toAsset({
    "image": finalExportImage,
    "description": PREFIX_OUT + VERSION_OUT,
    "assetId": DIR_OUT + PREFIX_OUT + VERSION_OUT,
    "scale": 30,
    "pyramidingPolicy": { '.default': 'mode' },
    "maxPixels": 1e13,
    "region": REGIONS_BUFFER_FC
});

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias — ArcPlan — mariana@arcplan.com.br
 * MapBiomas Collection 11 | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
