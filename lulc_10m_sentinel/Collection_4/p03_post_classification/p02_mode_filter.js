/**
 * ==============================================================================
 * p02 | Temporal mode filter
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Uses what a pixel is most of the time to decide what it is in the years where
 *   the model disagreed with itself.
 *   
 *   Nine rules are applied in sequence, each keyed on the temporal mode. Some are
 *   absolute: where the mode is agriculture, rocky outcrop or non-vegetated, that
 *   class holds for the whole series, because none of them appears and disappears
 *   from one year to the next. Others are directional: where the mode is savanna,
 *   forest years become savanna, and where the mode is forest, the reverse.
 *   
 *   The last rule handles pasture, which needs more evidence than a mode alone:
 *   the pixel must be pasture in the first year, in the last year, and modal in
 *   between.
 *
 * INPUTS
 *   - PANT_col4_Anual_au_filter_{VERSION_IN} (from p01)
 *
 * OUTPUTS
 *   - PANT_col4_Anual_moda_filter_{VERSION_OUT} (one band per year, 2017-2025)
 *
 * NOTES
 *   - The source repeated the same nine-line loop nine times, chained through
 *     class_outTotal to class_outTotal9, behind a 6,896-line imports block whose
 *     geometries were never referenced. Both have been removed; the rules are now
 *     a table and the loop runs once. Behaviour is unchanged.
 *
 * PIPELINE
 *   p03 post-classification | step 2 of 7  ->  p03_temporal_filter
 * ==============================================================================
 */

// ==============================================================================
// 1. PARAMETERS
// ==============================================================================
var REGIONS_BUFFER_FC = ee.FeatureCollection('projects/ee-arcplan-df/assets/col11/regions_buffer');
var roi = REGIONS_BUFFER_FC;

var START_YEAR = 2017;
var END_YEAR   = 2025;
var YEARS      = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

var VERSION_IN  = '1';
var VERSION_OUT = '2';
var DIR_ASSETS  = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/';
var PREFIX_IN   = 'PANT_col4_Anual_au_filter_';
var PREFIX_OUT  = 'PANT_col4_Anual_moda_filter_';

var palettes = require('users/mapbiomas/modules:Palettes.js');
var vis = { min: 0, max: 62, palette: palettes.get('classification7') };

// ==============================================================================
// 2. TEMPORAL MODE AND RULE TABLE
// ==============================================================================

var baseImage = ee.Image(DIR_ASSETS + PREFIX_IN + VERSION_IN);

// The temporal mode: the class each pixel holds in most years of the series.
// Every band is renamed to the same name so the reducer can run across them.
var modeImage = ee.ImageCollection(YEARS.map(function(year) {
    return baseImage.select('classification_' + year).rename('class');
})).mode();

Map.addLayer(baseImage, {}, 'Input', false);
Map.addLayer(modeImage, vis, 'Temporal mode', false);

/**
 * Rule table. Each entry is a mask plus the remap that applies under it.
 *
 * The mask adds 100 to the pixel value, so 103 means "class 3 under this mask",
 * and the "to" row says what that combination becomes. Reading the two rows
 * against each other is the quickest way to see what a rule does.
 *
 * Rules are applied in order, each one on the result of the last.
 */
var CLASS_ORDER = [3, 4, 11, 12, 19, 21, 25, 29, 33];
var MASKED_ORDER = [103, 104, 111, 112, 119, 121, 125, 129, 133];

var RULES = [
    {
        name: 'Water',
        note: 'Where the pixel is water most years, everything but water is wet grassland.',
        mask: modeImage.eq(33),
        to:   [12, 12, 12, 12, 12, 12, 12, 12, 33]
    },
    {
        name: 'Agriculture',
        note: 'Cropland does not appear and disappear; the modal class wins outright.',
        mask: modeImage.eq(19),
        to:   [19, 19, 19, 19, 19, 19, 19, 19, 19]
    },
    {
        name: 'Rocky outcrop',
        note: 'Rock is permanent: where it is modal, it holds for the whole series.',
        mask: modeImage.eq(29),
        to:   [29, 29, 29, 29, 29, 29, 29, 29, 29]
    },
    {
        name: 'Not rocky outcrop',
        note: 'And the converse: an outcrop that is not modal was never there.',
        mask: modeImage.neq(29),
        to:   [3, 4, 11, 12, 19, 21, 25, 12, 33]
    },
    {
        name: 'Savanna',
        note: 'Where savanna is modal, forest in other years is savanna misread.',
        mask: modeImage.eq(4),
        to:   [4, 4, 11, 12, 19, 21, 25, 12, 33]
    },
    {
        name: 'Forest',
        note: 'And the converse, for pixels whose modal class is forest.',
        mask: modeImage.eq(3),
        to:   [3, 3, 11, 12, 19, 21, 25, 12, 33]
    },
    {
        name: 'Non-vegetated',
        note: 'Modal non-vegetated areas are built-up or bare and do not revert.',
        mask: modeImage.eq(25),
        to:   [25, 25, 25, 25, 25, 25, 25, 25, 25]
    },
    {
        name: 'Grassland',
        note: 'Where grassland is modal, forest reads as savanna and outcrops as grassland.',
        mask: modeImage.eq(12),
        to:   [4, 4, 11, 12, 19, 21, 12, 12, 33]
    },
    {
        name: 'Persistent pasture',
        note: 'Pasture at both ends of the series and modal in between is real pasture ' +
              'throughout, whatever the model found in individual years.',
        mask: baseImage.select('classification_' + START_YEAR).eq(21)
                .and(baseImage.select('classification_' + END_YEAR).eq(21))
                .and(modeImage.eq(21)),
        to:   [21, 21, 21, 21, 21, 21, 21, 21, 21]
    }
];

// ==============================================================================
// 3. APPLY THE RULES
// ==============================================================================

var result = baseImage;

RULES.forEach(function(rule) {
    var maskOffset = rule.mask.remap([1], [100]).toByte().selfMask();
    var remapFrom = CLASS_ORDER.concat(MASKED_ORDER);
    var remapTo = CLASS_ORDER.concat(rule.to);

    YEARS.forEach(function(year) {
        var bandName = 'classification_' + year;
        var base = result.select(bandName);
        var corrected = base.add(maskOffset).remap(remapFrom, remapTo).rename(bandName);
        result = result.addBands(base.blend(corrected), null, true);
    });
});

// ==============================================================================
// 4. VISUAL CHECK
// ==============================================================================
Map.addLayer(baseImage.select('classification_2025'), vis, '2025 before', false);
Map.addLayer(result.select('classification_2025'), vis, '2025 after', true);

// ==============================================================================
// 5. METADATA AND EXPORT
// ==============================================================================
var finalOutput = result
    .set('territory', 'BRAZIL')
    .set('biome', 'PANTANAL')
    .set('source', 'arcplan')
    .set('version', VERSION_OUT)
    .set('collection_id', 4.0)
    .set('description', 'Temporal mode filter');

Export.image.toAsset({
    'image': finalOutput.toByte(),
    'description': PREFIX_OUT + VERSION_OUT,
    'assetId': DIR_ASSETS + PREFIX_OUT + VERSION_OUT,
    'pyramidingPolicy': { '.default': 'mode' },
    'region': roi.geometry(),
    'scale': 10,
    'maxPixels': 1e13
});

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias - ArcPlan - mariana@arcplan.com.br
 * MapBiomas Collection 4 (10 m) | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
