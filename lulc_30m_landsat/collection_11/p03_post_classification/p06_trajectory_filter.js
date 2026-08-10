/**
 * ==============================================================================
 * p06 | Trajectory and frequency filter
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Corrects classes using how a pixel behaves across the whole series rather
 *   than in any single year.
 *   
 *   Three metrics, precomputed per class and stored as assets, drive the rules:
 *     - number_of_presence: in how many years the class occurs;
 *     - number_of_changes: how many times the pixel switches class;
 *     - trajectories: a coded pattern describing the shape of the series.
 *   
 *   The rules resolve the confusions the classifier makes most often in the
 *   Pantanal: forest against savanna, savanna against grassland, and pasture or
 *   agriculture against seasonally flooded grassland. A class that appears in only
 *   a handful of years, or whose trajectory is coded as unstable, is replaced by
 *   the class the pixel actually spends most of its time in.
 *   
 *   Rocky outcrops (29) get a dedicated pass: the temporal mode decides whether
 *   the outcrop is real for the whole series or spurious everywhere.
 *
 * INPUTS
 *   - PANT_col11_Anual_v33 (from p04)
 *   - trajectories_{class}_col11_v{VERSION_IN}
 *   - number_of_presence_{class}_col11_v{VERSION_IN}
 *   - number_of_changes_{class}_col11_v{VERSION_IN}
 *
 * OUTPUTS
 *   - PANT_col11_Anual_v{VERSION_OUT} (one band per year, 1985-2025)
 *
 * NOTES
 *   - Trajectory code 6 marks an unstable series; code 7 marks a stable one.
 *   - The classification-pan-temp metrics must be regenerated whenever the input
 *     version changes.
 *
 * PIPELINE
 *   p03 post-classification | step 6 of 9  ->  p07_include_wetland
 * ==============================================================================
 */

/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var REGIONS_BUFFER_FC = ee.FeatureCollection("projects/ee-arcplan-df/assets/col11/regions_buffer");
/***** End of imports. If edited, may not auto-convert in the playground. *****/

// ==============================================================================
// 1. INITIALIZATION & ASSET LOADING
// ==============================================================================
// Create a list of years for Collection 11
var years = ee.List.sequence(1985, 2025);
var palettes = require('users/mapbiomas/modules:Palettes.js');
var visParams = {
    'min': 0,
    'max': 62,
    'palette': palettes.get('classification7')
};

// Define Collection 11 parameters
var VERSION_OUT = '34';
var COLLECTION_ID = 11.0;
var DESC_OUT = 'Trajectory filter Col11 v' + VERSION_OUT;
var DIR_OUT = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/';
var PREFIX_OUT = 'PANT_col11_Anual_v';

// Load the base classification image (Collection 11 input)
// Note: Update the asset path to the actual Collection 11 asset location
var baseClassification = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/PANT_col11_Anual_v33');
Map.addLayer(baseClassification, {}, 'Base classification (Col 11)', false);

// Temporal mode: the class each pixel holds most often across the series. Every
// band is renamed to the same name so the reducer can run over them.
var collectionFromBands = ee.ImageCollection(
    years.map(function(y) {
        return baseClassification
            .select(ee.String('classification_').cat(ee.Number(y).format('%d')))
            .rename('classification');
    })
);
var modeCol = collectionFromBands.reduce(ee.Reducer.mode());

// Load trajectory and spatial frequency metrics for each target class
var dirMetrics = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-temp/';
var VERSION_IN = '3'
var trajForest = ee.Image(dirMetrics + 'trajectories_3_col11_v' + VERSION_IN);
var presForest = ee.Image(dirMetrics + 'number_of_presence_3_col11_v' + VERSION_IN);
var chgForest  = ee.Image(dirMetrics + 'number_of_changes_3_col11_v' + VERSION_IN);

var trajSavanna = ee.Image(dirMetrics + 'trajectories_4_col11_v' + VERSION_IN);
var presSavanna = ee.Image(dirMetrics + 'number_of_presence_4_col11_v' + VERSION_IN);

var trajPasture = ee.Image(dirMetrics + 'trajectories_21_col11_v' + VERSION_IN);
var presPasture = ee.Image(dirMetrics + 'number_of_presence_21_col11_v' + VERSION_IN);

var trajCampo = ee.Image(dirMetrics + 'trajectories_12_col11_v' + VERSION_IN);
var presCampo = ee.Image(dirMetrics + 'number_of_presence_12_col11_v' + VERSION_IN);

var trajAgri = ee.Image(dirMetrics + 'trajectories_19_col11_v' + VERSION_IN);
var presAgri = ee.Image(dirMetrics + 'number_of_presence_19_col11_v' + VERSION_IN);

var presAnv = ee.Image(dirMetrics + 'number_of_presence_25_col11_v' + VERSION_IN);
var trajAnv = ee.Image(dirMetrics + 'trajectories_25_col11_v' + VERSION_IN);
// ==============================================================================
// 2. BUILD MASKS / RULES
// ==============================================================================

// Rule 1: Where savanna presence >= forest presence -> Forest becomes Savanna
var maskSavGTForest = presSavanna.subtract(presForest).gte(0);

var maskForestGTSav = presForest.subtract(presSavanna).gte(0);

// Rule 2: Any forest with trajectory 6 -> Forest becomes Savanna
var maskTrajForest6 = trajForest.eq(6);

// Rule 3: Savanna trajectory 6 AND presence < 6 -> Savanna becomes Campo (12)
var maskSavannaToCampo = presSavanna.lt(6).and(trajSavanna.eq(6));

// Rule 4: Forest change > 3 AND trajectory 5 -> Forest becomes Savanna
var maskForestChgToSavanna = chgForest.gt(3).and(trajForest.eq(5));

// Rule 5: Pasture trajectory 6 AND presence < 3 -> Pasture becomes Campo (12)
var maskPastureToCampo = presPasture.lt(10).and(trajPasture.eq(6));

// Rule 6: Agriculture trajectory 6 AND presence < 4 -> Agriculture becomes Campo (12)
var maskAgriToCampo = presAgri.lt(5).and(trajAgri.eq(6));


var maskAnv = presAnv.lt(10).and(trajAnv.eq(6));

var maskStableAnv = baseClassification.select('classification_1985').eq(25).and(baseClassification.select('classification_2025').eq(25))

var maskModeIs29 = modeCol.eq(29);
// Mask where the computed mode is NOT Rocky Outcrop (29)
var maskModeIsNot29 = modeCol.neq(29);

// ==============================================================================
// 3. APPLY THE RULES OVER THE SERIES (1985-2025)
// ==============================================================================
// Mapped server-side to avoid a heavy client-side loop.
var correctedCollection = ee.ImageCollection(years.map(function(year) {
    var yearStr = ee.Number(year).format('%d');
    var bandName = ee.String('classification_').cat(yearStr);
    var imgYear = baseClassification.select(bandName);

    // Apply Rule 1, 2 and 4 (Forest [3] to Savanna [4])
    var conditionForestToSav = maskSavGTForest.or(maskTrajForest6).or(maskForestChgToSavanna);
    imgYear = imgYear.where(imgYear.eq(3).and(conditionForestToSav), 4);

    imgYear = imgYear.where(imgYear.eq(4).and(maskForestGTSav), 3);
    // Apply Rule 3 (Savanna [4] to Campo [12])
    imgYear = imgYear.where(imgYear.eq(4).and(maskSavannaToCampo), 12);

    // Apply Rule 5 (Pasture [21] to Campo [12])
    imgYear = imgYear.where(imgYear.eq(21).and(maskPastureToCampo), 12);

    // Rule 6: agriculture (19) to grassland (12).
    imgYear = imgYear.where(imgYear.eq(19).and(maskAgriToCampo), 12);
    imgYear = imgYear.where(imgYear.eq(19).and(presAgri.lt(4)), 12);


    imgYear = imgYear.where(imgYear.eq(25).and(maskAnv), 21);

    imgYear = imgYear.where(modeCol.eq(25).and(maskStableAnv), 25);

    imgYear = imgYear.where(imgYear.eq(25).and(presAnv.lt(5)), 21);
    imgYear = imgYear.where(maskModeIs29, 29);

    // NEW IMPLEMENTATION - Rule 7b: If outcrop mode is NOT 29, force any existing 29 to become 12 (Campo)
    imgYear = imgYear.where(imgYear.eq(29).and(maskModeIsNot29), 12);

    return imgYear.rename(bandName).toByte();
}));

var finalCorrectedImage = correctedCollection.toBands();

// toBands() prefixes each band with its index, so the names have to be restored.
var newBandNames = years.map(function(y) {
    return ee.String('classification_').cat(ee.Number(y).format('%d'));
});
finalCorrectedImage = finalCorrectedImage.rename(newBandNames);

Map.addLayer(finalCorrectedImage, {}, 'Corrected Collection 11 with Outcrop Rule', false);
print('Final Corrected Image:', finalCorrectedImage);
// ==============================================================================
// 4. VISUAL VALIDATION (MOSAICS)
// ==============================================================================

// Use MapBiomas landsat mosaics asset
var assetMosaics = 'projects/nexgenmap/MapBiomas2/LANDSAT/BRAZIL/mosaics-2';

// Display the first and last year as reference to prevent interface overload
var validationYears = [1985, 2025];

validationYears.forEach(function(year) {
    var mosaicYear = ee.ImageCollection(assetMosaics)
        .filterMetadata('biome', 'equals', 'PANTANAL')
        .filterMetadata('year', 'equals', year)
        .mosaic();

    var bandName = 'classification_' + year;

    Map.addLayer(mosaicYear, {bands: ['swir1_median', 'nir_median', 'red_median'], gain: [0.08, 0.06, 0.2], gamma: 0.85}, 'Mosaic ' + year, false);
    Map.addLayer(baseClassification.select(bandName), visParams, 'Original ' + year, false);
    Map.addLayer(finalCorrectedImage.select(bandName), visParams, 'Corrected ' + year, false);
});

// ==============================================================================
// 5. METADATA SETTING & EXPORT
// ==============================================================================

finalCorrectedImage = finalCorrectedImage
    .set('territory', 'BRAZIL')
    .set('biome', 'PANTANAL')
    .set('source', 'arcplan')
    .set('version', VERSION_OUT)
    .set('collection_id', COLLECTION_ID)
    .set('description', DESC_OUT);

// Export to Asset
var assetIdOut = DIR_OUT + PREFIX_OUT + VERSION_OUT;

Export.image.toAsset({
    "image": finalCorrectedImage.toByte(),
    "description": PREFIX_OUT + VERSION_OUT,
    "assetId": assetIdOut,
    "scale": 30,
    "pyramidingPolicy": {
        '.default': 'mode'
    },
    "maxPixels": 1e13,
    "region": REGIONS_BUFFER_FC
});

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias — ArcPlan — mariana@arcplan.com.br
 * MapBiomas Collection 11 | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
