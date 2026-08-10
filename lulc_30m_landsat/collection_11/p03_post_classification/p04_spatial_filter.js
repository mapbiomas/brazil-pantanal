/**
 * ==============================================================================
 * p04 | Spatial filter and edge-year rules
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Two stages that run in sequence.
 *   
 *   Stage 1 fixes the two ends of the series, where the classifier has no
 *   neighbouring year on one side to lean on, then projects irrigated agriculture
 *   detected in 1986 across the whole series, applies the 2025 deforestation
 *   alerts, and finally smooths the map spatially: any patch below the minimum
 *   mapping unit is replaced by the majority class of its 3x3 neighbourhood.
 *   
 *   Stage 2 applies three further rules on the smoothed result: savanna
 *   reconciliation for 1985-1987, conversion of any remaining water pixels to
 *   grassland, and removal of one-year pasture interruptions in the 12-21-12
 *   trajectory.
 *
 * INPUTS
 *   - PANT_col11_Anual_v32 (from p03)
 *   - MapBiomas deforestation alerts 2019-2025
 *
 * OUTPUTS
 *   - PANT_col11_Anual_v{VERSION_OUT} (one band per year, 1985-2025)
 *
 * NOTES
 *   - The two stages were concatenated in one file in the original folder, with
 *     the same variable names declared twice. They are kept in one file here,
 *     in sequence, with distinct names.
 *
 * PIPELINE
 *   p03 post-classification | step 4 of 9  ->  p06_trajectory_filter
 * ==============================================================================
 */

/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var REGIONS_EXACT_FC = ee.FeatureCollection("projects/ee-arcplan-df/assets/col11/regions_t"),
    REGIONS_BUFFER_FC = ee.FeatureCollection("projects/ee-arcplan-df/assets/col11/regions_buffer");
/***** End of imports. If edited, may not auto-convert in the playground. *****/

// ==============================================================================
// 1. INITIAL PARAMETERS & ASSETS
// ==============================================================================

var BIOME = "PANTANAL";

var VERSION_OUT = '33'; // Adjust according to the output version
var COL_ID = 11.0;
var DESCRIPTION = 'Temporal corrections (85-86, 24-25), Agri rule, Alerts, and Spatial Filter (podres+mask)';
var DIR_OUT = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/';
var PREFIX_OUT = 'PANT_col11_Anual_v';

// Load base classification image (Collection 11 up to 2025)
var vAtual = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/PANT_col11_Anual_v32');
var geometry = vAtual.geometry();

// Load modules and palettes
var palettes = require('users/mapbiomas/modules:Palettes.js');
var vis = { min: 0, max: 62, palette: palettes.get('classification8') };

// ==============================================================================
// 2. SPECIFIC TEMPORAL RULES (1985-1986 & 2024-2025)
// ==============================================================================

// Extract base bands for initial and final years
var c85 = vAtual.select('classification_1985');
var c86 = vAtual.select('classification_1986');
var c24 = vAtual.select('classification_2024'); // Updated from 2023
var c25 = vAtual.select('classification_2025'); // Updated from 2024

// --- Rules for 1985 and 1986 ---
var flo85 = c85.eq(3);
var flo86 = c86.eq(3);
var sav85 = c85.eq(4);
var sav86 = c86.eq(4);

// If forest in 85 and savanna in 86 -> 85 becomes savanna
var savcorr85 = sav86.and(flo85).remap([1], [4], 0).selfMask();
var ano85 = c85.blend(savcorr85).rename('classification_1985');

// If forest in 86 and savanna in 85 -> 86 becomes savanna
var savcorr86 = flo86.and(ano85.eq(4)).remap([1], [4], 0).selfMask();
var ano86 = c86.blend(savcorr86).rename('classification_1986');

// If savanna in 86 and not savanna in 85 -> adjust deforestation
var corrigeDesmat = ano86.eq(4).and(ano85.neq(4)).remap([1], [4], 0).selfMask();
ano85 = ano85.blend(corrigeDesmat).rename('classification_1985');

// If savanna in 86 and in 85 is not forest nor savanna -> becomes savanna
var corrigeSavn = ano86.eq(4).and(ano85.neq(4)).remap([1], [4], 0).selfMask();
ano85 = ano85.blend(corrigeSavn).rename('classification_1985');

// --- Rules for 2024 and 2025 ---
// If forest in 24 and not forest in 25 -> 25 becomes forest
var corrigeFloUltimo = c24.eq(3).and(c25.neq(21)).remap([1], [3], 0).selfMask();
var ano25 = c25.blend(corrigeFloUltimo).rename('classification_2025');

// If savanna in 24 and not savanna in 25 -> 25 becomes savanna
var corrigeSavUltimo = c24.eq(4).and(c25.neq(21)).remap([1], [4], 0).selfMask();
ano25 = ano25.blend(corrigeSavUltimo).rename('classification_2025');

// If grassland in 24 and not grassland in 25 -> 25 becomes grassland
var corrigeCampUltimo = c24.eq(12).and(c25.neq(12)).remap([1], [12], 0).selfMask();
ano25 = ano25.blend(corrigeCampUltimo).rename('classification_2025');

// If forest in 25 and not forest in 24 -> 24 becomes forest
var corrigeFloPenultimo = c24.neq(3).and(ano25.eq(3)).remap([1], [3], 0).selfMask();
var ano24 = c24.blend(corrigeFloPenultimo).rename('classification_2024');

// Overwrite the specific years in the base image
var vModified = vAtual
    .addBands(ano85, null, true)
    .addBands(ano86, null, true)
    .addBands(ano24, null, true)
    .addBands(ano25, null, true);

// ==============================================================================
// 3. PERSISTENT RULES (AGRICULTURE & ALERTS)
// ==============================================================================

// Agriculture rule: If agriculture in 86, project to the entire series
var agri86 = ano86.eq(19);
var vAgri86Mask = agri86.remap([1], [1], 0).selfMask();
var targetClassesAgri = [3, 4, 12, 19, 21, 29, 25, 33];

// Deforestation alerts mask for 2025
var alertas = ee.FeatureCollection('projects/ee-arcplan-df/assets/col11/alertas_19-25');
var alertas25 = alertas.filterMetadata('ANODETEC', 'equals', 2025);
var maskAlert25 = alertas25.reduceToImage(['ANODETEC'], 'mean').neq(0).remap([1], [1], 0).selfMask();
var targetClassesAlerts = [3, 4, 12, 19, 21, 29, 25]; // Excludes 33 as it remains 33

// ==============================================================================
// 4. STAGE 1 - AGRICULTURE, ALERTS AND SPATIAL SMOOTHING
// ==============================================================================

var years = ee.List.sequence(1985, 2025);

// Map operations over years to avoid client-side for-loops and addBands
var processedCollection = ee.ImageCollection.fromImages(years.map(function(y) {
    var yearStr = ee.Number(y).format('%04d');
    var bandName = ee.String('classification_').cat(yearStr);

    // 4.1 Base year extraction (with early/late year corrections applied)
    var imgYear = vModified.select(bandName);

    // Irrigated agriculture present in 1986 is projected across the whole series:
    // centre-pivot systems do not appear and disappear.
    var isTargetAgri = imgYear.remap(targetClassesAgri, ee.List.repeat(1, targetClassesAgri.length), 0);
    imgYear = imgYear.where(vAgri86Mask.and(isTargetAgri), 19);

    // 2025 deforestation alerts force the pixel to pasture in the last year.
    var isTargetAlert = imgYear.remap(targetClassesAlerts, ee.List.repeat(1, targetClassesAlerts.length), 0);
    imgYear = ee.Image(ee.Algorithms.If(
        ee.Number(y).eq(2025),
        imgYear.where(maskAlert25.and(isTargetAlert), 21),
        imgYear
    ));

    // ------------------------------------------------------------------------------
    // Spatial smoothing: patches smaller than the minimum mapping unit are replaced
    // by the majority class of their 3x3 neighbourhood.
    // ------------------------------------------------------------------------------
    var MIN_CONNECT_PIXEL = 6;

    var imgUnmasked = imgYear.unmask(0);

    // maxSize 10 is enough to resolve the threshold of 6 and keeps the count cheap.
    var connected = imgUnmasked.connectedPixelCount(10, true)
                               .reproject('epsg:4326', null, 30);

    var moda = imgUnmasked.focal_mode(1, 'square', 'pixels')
                          .mask(connected.lte(MIN_CONNECT_PIXEL));

    var finalYearImg = imgUnmasked.blend(moda)
                                  .updateMask(imgUnmasked.neq(0))
                                  .rename(bandName);

    return finalYearImg.set('year', y);
}));

// Convert collection back to a single multi-band image
var spatialFilteredStack = processedCollection.toBands().rename(
    years.map(function(y) { return ee.String('classification_').cat(ee.Number(y).format('%04d')); })
);

// Stage 1 output; metadata and export are handled at the end of stage 2.
Map.addLayer(vAtual.select('classification_1985'), vis, 'Input - 1985', false);
Map.addLayer(spatialFilteredStack.select('classification_1985'), vis, 'Stage 1 output - 1985', false);
Map.addLayer(vAtual.select('classification_2025'), vis, 'Input - 2025', false);
Map.addLayer(spatialFilteredStack.select('classification_2025'), vis, 'Stage 1 output - 2025', false);


// ==============================================================================
// 6. STAGE 2 - EARLY-YEAR RULES, WATER AND THE 12-21-12 TRAJECTORY
// ==============================================================================

var stage2Base = spatialFilteredStack;

var s2c85 = stage2Base.select('classification_1985');
var s2c86 = stage2Base.select('classification_1986');
var s2c87 = stage2Base.select('classification_1987');

// Rule: If 85 is Savanna (4) and 86 is Grassland (12) -> 85 becomes 12
var maskSav1 = s2c85.eq(4).and(s2c86.eq(12)).remap([1], [12], 0).selfMask();
var c85_mod = s2c85.blend(maskSav1);

// Rule: If 87 is Savanna (4) -> 85 and 86 become Savanna (4)
var maskSav2 = s2c87.eq(4).remap([1], [4], 0).selfMask();
c85_mod = c85_mod.blend(maskSav2).rename('classification_1985');
var c86_mod = s2c86.blend(maskSav2).rename('classification_1986');

// Overwrite 1985 and 1986 in the base image
var stage2Modified = stage2Base
    .addBands(c85_mod, null, true)
    .addBands(c86_mod, null, true);

// ------------------------------------------------------------------------------
// Water to grassland, and the 12-21-12 trajectory
// ------------------------------------------------------------------------------
// Standing water is reinserted properly in p07, so any class 33 left here is
// treated as seasonally flooded grassland. A pixel that is grassland, then
// pasture for exactly one year, then grassland again was never converted.

var START_YEAR = 1985;
var END_YEAR = 2025;
var years = ee.List.sequence(START_YEAR, END_YEAR);

// Process rules simultaneously to avoid loops and redundant memory allocation
var stage2Collection = ee.ImageCollection.fromImages(years.map(function(y) {
    var yearNum = ee.Number(y);
    var yearStr = yearNum.format('%04d');
    var bandName = ee.String('classification_').cat(yearStr);

    // Select current year
    var imgT = stage2Modified.select(bandName);

    // --- RULE A: Transform Water (33) to Grassland (12) ---
    imgT = imgT.where(imgT.eq(33), 12);

    // --- RULE B: Temporal Filter (12-21-12 sequence becomes 12) ---
    // Only applies if it is not the first or last year of the series
    var isInnerYear = yearNum.gt(START_YEAR).and(yearNum.lt(END_YEAR));

    var imgFiltered = ee.Image(ee.Algorithms.If(
        isInnerYear,
        // If it is an inner year, calculate t-1 and t+1
        (function() {
            var bandPrevStr = ee.String('classification_').cat(yearNum.subtract(1).format('%04d'));
            var bandNextStr = ee.String('classification_').cat(yearNum.add(1).format('%04d'));

            var imgPrev = stage2Modified.select(bandPrevStr);
            var imgNext = stage2Modified.select(bandNextStr);

            // To be accurate with sequential logic, t-1 and t+1 must also have water converted to 12
            imgPrev = imgPrev.where(imgPrev.eq(33), 12);
            imgNext = imgNext.where(imgNext.eq(33), 12);

            // Check sequence: 12 (Prev) - 21 (Current) - 12 (Next)
            var mask_12_21_12 = imgPrev.eq(12).and(imgT.eq(21)).and(imgNext.eq(12));

            // Apply correction
            return imgT.where(mask_12_21_12, 12);
        })(),
        // If it is an edge year (1985 or 2025), return with just the Water rule applied
        imgT
    ));

    return imgFiltered.rename(bandName).set('year', yearNum);
}));

// Flatten collection back to a single image
var finalClassification = stage2Collection.toBands().rename(
    years.map(function(y) { return ee.String('classification_').cat(ee.Number(y).format('%04d')); })
);

// ==============================================================================
// 7. METADATA & EXPORT
// ==============================================================================

finalClassification = finalClassification
    .set('territory', 'BRAZIL')
    .set('biome', BIOME)
    .set('source', 'arcplan')
    .set('version', VERSION_OUT)
    .set('collection_id', COL_ID)
    .set('description', DESCRIPTION);

print('Final image for export:', finalClassification);
Map.addLayer(finalClassification.select('classification_2025'), vis, 'Stage 2 output - 2025', false);

Export.image.toAsset({
    image: finalClassification.toByte(),
    description: PREFIX_OUT + VERSION_OUT,
    assetId: DIR_OUT + PREFIX_OUT + VERSION_OUT,
    scale: 30,
    pyramidingPolicy: { '.default': 'mode' },
    maxPixels: 1e13,
    region: REGIONS_BUFFER_FC,
    overwrite:true
});

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias — ArcPlan — mariana@arcplan.com.br
 * MapBiomas Collection 11 | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
