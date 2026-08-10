/**
 * ==============================================================================
 * p01 | Temporal stabiliser
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   First post-classification step. Works only on the time dimension: it looks at
 *   what each pixel was in the neighbouring years and rolls back transitions that
 *   are physically implausible over a 41-year series.
 *   
 *   Four passes, in order:
 *     - backward pass (1996 down to 1986) and a dedicated 1985 rule, since the
 *       early Landsat 5 years carry the most classification noise;
 *     - forest override: a pixel that is forest in both 1985 and 2025 is forced to
 *       forest throughout;
 *     - forward pass over the last years of the series;
 *     - mode-based stabilisation for water, pasture, savanna, grassland and forest.
 *
 * INPUTS
 *   - PANT_col11_Anual_GapFill_5 (from p02)
 *
 * OUTPUTS
 *   - PANT_col11_Anual_{VERSION_OUT} (one band per year, 1985-2025)
 *
 * PIPELINE
 *   p03 post-classification | step 1 of 9  ->  p02_temporal_filter
 * ==============================================================================
 */

// ==============================================================================
// 1. INITIALIZATION & PARAMETERS
// ==============================================================================
var palettes = require('users/mapbiomas/modules:Palettes.js');

var VIS_PARAMS = {
    'min': 0,
    'max': 45,
    'palette': palettes.get('classification5')
};

var YEAR_START = 1985;
var YEAR_END = 2025; // Updated to Collection 11 scope

// Generate temporal array automatically
var YEARS = ee.List.sequence(YEAR_START, YEAR_END).getInfo();

// Paths and assets
var ASSET_COL_IN = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan/PANT_col11_Anual_GapFill_5'; // Update path as needed
var ASSET_MOSAICS = 'projects/nexgenmap/MapBiomas2/LANDSAT/BRAZIL/mosaics-2';
var DIR_OUT = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/';
var PREFIX_OUT = 'PANT_col11_Anual_';
var VERSION_OUT = '30';

// Load base image
var col11 = ee.Image(ASSET_COL_IN);
Map.addLayer(col11.select('classification_' + YEAR_START), VIS_PARAMS, 'Original ' + YEAR_START, false);

// ==============================================================================
// 2. BACKWARD CORRECTION (1996 down to 1986)
// ==============================================================================
// Rule: a pixel mapped as pasture that turns into forest or savanna in the two
// following years was almost certainly never pasture; roll the later class back.
var correctedBands = col11;

for (var y = 1996; y >= 1986; y--) {
    var currClass = correctedBands.select('classification_' + y);
    var next1Class = correctedBands.select('classification_' + (y + 1));
    var next2Class = correctedBands.select('classification_' + (y + 2));

    // If current is pasture, and next 2 years are forest -> forest
    var fixForest = currClass.eq(21)
        .and(next1Class.eq(3).and(next2Class.eq(3)))
        .remap([1], [3], 0).selfMask();

    // If current is pasture, and at least one of next 2 years is savanna -> savanna
    var fixSavanna = currClass.eq(21)
        .and(next1Class.eq(4).or(next2Class.eq(4)))
        .remap([1], [4], 0).selfMask();

    var baseMask = currClass.eq(3).remap([1], [3], 0).selfMask();
    var combinedMask = fixSavanna.blend(fixForest.blend(baseMask)).mask(currClass.eq(21)).selfMask();

    var correctedImg = currClass.blend(combinedMask).rename('classification_' + y);

    // Update the collection graph with the corrected year
    correctedBands = correctedBands.addBands(correctedImg, null, true);
}

// ==============================================================================
// 3. SPECIAL BACKWARD CORRECTION (1985) - FIXED CLASS 21 RETENTION
// ==============================================================================
var class85 = correctedBands.select('classification_1985');
var class86 = correctedBands.select('classification_1986');
var class87 = correctedBands.select('classification_1987');

// Rule 1: Correct Pasture (21) -> Forest (3) if subsequent years are Forest
var fix85Flo = class85.eq(21).and(class86.eq(3).or(class87.eq(3))).remap([1], [3], 0).selfMask();

// Rule 2: Correct Pasture (21) -> Savanna (4) if subsequent years are Savanna
var fix85Sav = class85.eq(21).and(class86.eq(4).and(class87.eq(4))).remap([1], [4], 0).selfMask();

// Specific legacy conditions (tests):
// Rule 3: Correct Campo (12) -> Savanna (4) based on 1986 being Forest
var fix85Test1 = class85.eq(12).and(class86.eq(3)).remap([1], [4], 0).selfMask();

// Rule 4: Correct Savanna (4) -> Forest (3) based on 1986 being Forest
var fix85Test2 = class85.eq(4).and(class86.eq(3)).remap([1], [3], 0).selfMask();

// Consolidate all corrections ensuring class 21 rules are prioritized and NOT overwritten
var corr85_final = class85
    .blend(fix85Sav)
    .blend(fix85Flo)
    .blend(fix85Test1)
    .blend(fix85Test2)
    .rename('classification_1985');

correctedBands = correctedBands.addBands(corr85_final, null, true);
Map.addLayer(corr85_final, VIS_PARAMS, 'Corrected 1985 (class 21 preserved)', false);

// ==============================================================================
// 4. FOREST OVERRIDE (WHOLE SERIES)
// ==============================================================================
// A pixel that is forest at both ends of the series is treated as permanent forest:
// anything else in between is model noise rather than real change.
var forestMask = correctedBands.select('classification_' + YEAR_START).eq(3)
    .and(correctedBands.select('classification_' + YEAR_END).eq(3)).selfMask();
var forestStabilizer = forestMask.remap([1], [100], 0);

var integratedBands = correctedBands.select('classification_' + YEAR_END);

for (var i = 0; i < YEARS.length; i++) {
    var year = YEARS[i];
    var currentClass = correctedBands.select('classification_' + year);

    var stabilizedClass = currentClass.add(forestStabilizer)
        .remap([3, 4, 12, 19, 21, 29, 25, 33, 103, 104, 112, 119, 121, 129, 125, 133],
               [3, 4, 12, 19, 21, 29, 25, 33,   3,   3,  12,   3,  21,   3,   3,  33])
        .rename('classification_' + year);

    var blendedYear = currentClass.blend(stabilizedClass);
    integratedBands = integratedBands.addBands(blendedYear, null, true);
}

// ==============================================================================
// 5. FORWARD CORRECTION (2018 to 2025)
// ==============================================================================
for (var y = 2018; y < YEAR_END; y++) {
    var cClass = integratedBands.select('classification_' + y);
    var n1Class = integratedBands.select('classification_' + (y + 1));
    var n2Class = (y + 2 <= YEAR_END) ? integratedBands.select('classification_' + (y + 2)) : n1Class;

    var fixForwardFlo = cClass.neq(3).and(n1Class.eq(3).or(n2Class.eq(3))).remap([1], [3], 0).selfMask();
    var fixForwardSav = cClass.neq(4).and(n1Class.eq(4).or(n2Class.eq(4))).remap([1], [4], 0).selfMask();

    var maskForward = fixForwardSav.blend(fixForwardFlo.blend(cClass.eq(3).remap([1], [3], 0).selfMask()))
        .mask(cClass.eq(21)).selfMask();

    var correctedForward = cClass.blend(maskForward).rename('classification_' + y);
    integratedBands = integratedBands.addBands(correctedForward, null, true);
}

// ==============================================================================
// 6. MODE-BASED STABILISATION (water, pasture, savanna, grassland, forest)
// ------------------------------------------------------------------------------
// The temporal mode is the class a pixel holds most often across the 41 years. Where
// the mode is unambiguous it is used to pull isolated dissenting years back into
// line. Each entry in "stabs" is a mask plus the remap that applies under it: the
// mask adds 100 to the pixel value, so 103 means "class 3 under this mask" and the
// remap decides what it becomes.
// ==============================================================================
var finalCollectionList = YEARS.map(function(y) {
    return integratedBands.select('classification_' + y).rename('class');
});
var tempCol = ee.ImageCollection.fromImages(finalCollectionList);

var modeImg = tempCol.mode();
var waterSum = tempCol.map(function(img) { return img.eq(33); }).sum();
var waterMask = waterSum.gte(1).remap([1], [100]).toByte().selfMask();

var outBands = integratedBands;

var stabs = {
    'Water': { mask: waterMask,
               remapIn:  [3, 4, 12, 19, 21, 29, 25, 33, 103, 104, 112, 119, 121, 129, 125, 133],
               remapOut: [3, 4, 12, 19, 21, 29, 25, 33,   4,   4,  12,  19,  21,  12,  12,  33] },

    'Savanna': { mask: modeImg.eq(4).remap([1],[100]).toByte().selfMask(),
                 remapIn:  [3, 4, 12, 19, 21, 29, 25, 33, 103, 104, 112, 119, 121, 129, 125, 133],
                 remapOut: [3, 4, 12, 19, 21, 29, 25, 33,   4,   4,  12,   4,  21,  4,  25,  33] },

    'Campo': { mask: modeImg.eq(12).remap([1],[100]).toByte().selfMask(),
               remapIn:  [3, 4, 12, 19, 21, 29, 25, 33, 103, 104, 112, 119, 121, 129, 125, 133],
               remapOut: [3, 4, 12, 19, 21, 29, 25, 33,   4,   4,  12,  12,  21,  12,  25,  33] },

    'Pasture': { mask: outBands.select('classification_' + YEAR_START).eq(21)
                       .and(outBands.select('classification_' + YEAR_END).eq(21))
                       .and(modeImg.eq(21)).remap([1],[100]).toByte().selfMask(),
                 remapIn:  [3, 4, 12, 19, 21, 29, 25, 33, 103, 104, 112, 119, 121, 129, 125, 133],
                 remapOut: [3, 4, 12, 19, 21, 29, 25, 33,  21,  21,  21,  21,  21,  21,  21,  21] },

    'Forest': { mask: modeImg.eq(3).remap([1],[100]).toByte().selfMask(),
                remapIn:  [3, 4, 12, 19, 21, 29, 25, 33, 103, 104, 112, 119, 121, 129, 125, 133],
                remapOut: [3, 4, 12, 19, 21, 29, 25, 33,   3,   3,  12,   3,  21,  12,  25,  33] }
};

var maskNames = ['Water', 'Savanna', 'Campo', 'Pasture', 'Forest'];

maskNames.forEach(function(maskKey) {
    var rules = stabs[maskKey];
    for (var y = 0; y < YEARS.length; y++) {
        var year = YEARS[y];
        var imgBase = outBands.select('classification_' + year);
        var corrected = imgBase.add(rules.mask)
            .remap(rules.remapIn, rules.remapOut)
            .rename('classification_' + year);

        outBands = outBands.addBands(imgBase.blend(corrected), null, true);
    }
});

// ==============================================================================
// 7. VISUAL CHECK AGAINST THE LANDSAT MOSAICS
// ==============================================================================
// First and last year only, so the map does not get overloaded.
['1985', '2025'].forEach(function(year) {
    var mosaic = ee.ImageCollection(ASSET_MOSAICS)
        .filterMetadata('biome', 'equals', 'PANTANAL')
        .filterMetadata('year', 'equals', ee.Number.parse(year))
        .mosaic();
    Map.addLayer(mosaic, {
        bands: ['swir1_median', 'nir_median', 'red_median'],
        gain: [0.08, 0.06, 0.2],
        gamma: 0.85
    }, 'Landsat mosaic ' + year, false);
});

// ==============================================================================
// 8. METADATA AND EXPORT
// ==============================================================================
var finalExportImage = outBands.set({
    'territory': 'BRAZIL',
    'biome': 'PANTANAL',
    'source': 'arcplan',
    'version': VERSION_OUT,
    'collection_id': 11.0,
    'description': 'Mode filter and iterative temporal stabilisation'
});
Map.addLayer(finalExportImage.select('classification_1985'), VIS_PARAMS, '1985 final', false);

print('Final Image for Export:', finalExportImage);

Export.image.toAsset({
    "image": finalExportImage.toByte(),
    "description": PREFIX_OUT + VERSION_OUT,
    "assetId": DIR_OUT + PREFIX_OUT + VERSION_OUT,
    "scale": 30,
    "pyramidingPolicy": { '.default': 'mode' },
    "maxPixels": 1e13,
    "region": col11.geometry()
});

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias — ArcPlan — mariana@arcplan.com.br
 * MapBiomas Collection 11 | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
