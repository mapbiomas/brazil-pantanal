/**
 * ==============================================================================
 * p10 | Suspicious patches and final outcrop trajectory filter
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Last step of the chain. Removes what survived every previous filter by looking
 *   at the shape of each patch rather than at its spectral signature or its
 *   trajectory.
 *   
 *   Real pasture patches are compact: fences and machinery produce simple outlines.
 *   Classification noise is small and ragged. The fractal dimension, computed as
 *   2 * ln(perimeter) / ln(area), separates the two. A class 21 patch below five
 *   hectares whose fractal dimension exceeds 1.35 is convoluted enough to be noise
 *   and is reclassified as grassland.
 *   
 *   Two further rules run first: rocky outcrops whose trajectory is not the stable
 *   code are converted to grassland, and 2025 pasture inherits its 2024 state, so
 *   the last year of the series does not end on a spurious conversion.
 *
 * INPUTS
 *   - PANT_col11_Anual_v38 (from p09)
 *   - trajectories_29_col11_v{VERSION_IN_METRICS}
 *
 * OUTPUTS
 *   - PANT_col11_Anual_v{VERSION_OUT} (one band per year, 1985-2025)
 *   - This is the asset delivered to the MapBiomas national integration.
 *
 * NOTES
 *   - AREA_THRESHOLD_HA and FD_THRESHOLD control how aggressive the shape filter
 *     is; raising either one lets more small patches through.
 *
 * PIPELINE
 *   p03 post-classification | final step  ->  national integration
 * ==============================================================================
 */

/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var REGIONS_BUFFER_FC = ee.FeatureCollection("projects/ee-arcplan-df/assets/col11/regions_buffer");
/***** End of imports. If edited, may not auto-convert in the playground. *****/

// ==============================================================================
// 1. PARAMETERS AND CONSTANTS
// ==============================================================================
var VERSION_OUT = '39';
var DIR_OUT = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/';
var EXPORT_NAME_PREFIX = 'PANT_col11_Anual_v';

// Asset paths updated for Collection 11 single multiband image input
var ASSET_COL11_INTEGRATION = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/PANT_col11_Anual_v38';
var ASSET_BIOMES = 'projects/mapbiomas-workspace/AUXILIAR/biomas_IBGE_250mil_old';

// Trajectory metrics directory and version for Rocky Outcrop (Class 29)
var DIR_METRICS = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-temp/';
var VERSION_IN_METRICS = '5';

// Complete historical range for Collection 11 (1985-2025)
var START_YEAR = 1985;
var END_YEAR = 2025;
var YEARS = [];
for (var y = START_YEAR; y <= END_YEAR; y++) {
    YEARS.push(String(y));
}

// Filter Configuration Parameters
var CLASS_PASTURE_MOSAIC = 21; // Mosaic of Agriculture and Pasture
var CLASS_OUTCROP = 29;        // Rocky Outcrop
var TARGET_RECLASS = 12;       // Grassland

// Spatial Filter Parameters for Class 21
var AREA_THRESHOLD_HA = 5;     // Maximum area threshold in hectares
var AREA_THRESHOLD_M2 = AREA_THRESHOLD_HA * 10000; // Conversion to square meters
var FD_THRESHOLD = 1.35;       // Fractal Dimension complexity limit
var MAX_PIXELS_PATCH = 1024;   // Buffer size for patch analysis processing safety

// ==============================================================================
// 2. IMPORTS AND GEOMETRIES
// ==============================================================================
var Palettes = require('users/mapbiomas/modules:Palettes.js');
var palette = Palettes.get('classification9');

// Visualization configuration
var visParams = {
    min: 0,
    max: palette.length - 1,
    palette: palette
};

// Export extent.
var geometry = REGIONS_BUFFER_FC;

// Load the input single multiband image and target trajectory asset
var inputMultibandImage = ee.Image(ASSET_COL11_INTEGRATION);
var trajOutcrop = ee.Image(DIR_METRICS + 'trajectories_29_col11_v' + VERSION_IN_METRICS);

// ==============================================================================
// 3. CONVERT MULTIBAND IMAGE TO IMAGE COLLECTION
// ==============================================================================
// Unpack the multiband image into an ImageCollection for standardized processing
var chronologicalList = YEARS.map(function(year) {
    var bandName = 'classification_' + year;
    var img = inputMultibandImage.select(bandName)
                                 .rename('classification'); // Standardizing band name internally
    return img.set('year', parseInt(year, 10));
});

var initialCollection = ee.ImageCollection.fromImages(chronologicalList);

// ==============================================================================
// 4. STEP 1: APPLY TRAJECTORY FILTER FOR ROCKY OUTCROP (CLASS 29)
// ==============================================================================
// If pixel is classified as 29 and its trajectory is NOT equal to 7, reclassify to 12
var outcropFilteredCollection = initialCollection.map(function(img) {
    var maskOutcropToCorrect = img.eq(CLASS_OUTCROP).and(trajOutcrop.neq(7));
    var correctedImg = img.where(maskOutcropToCorrect, TARGET_RECLASS);
    return correctedImg.copyProperties(img, ['year', 'system:index']);
});

// ==============================================================================
// 5. STEP 2: TEMPORAL CONSISTENCY FILTER FOR CLASS 21 (2024 -> 2025)
// ==============================================================================
// Isolate 2024 and 2025 layers from the outcrop filtered collection to apply persistence rules
var img2024 = outcropFilteredCollection.filter(ee.Filter.eq('year', 2024)).first();
var img2025 = outcropFilteredCollection.filter(ee.Filter.eq('year', 2025)).first();

// Generate a mask where class 21 existed in 2024
var maskClass21_2024 = img2024.eq(CLASS_PASTURE_MOSAIC);

// Force 2025 pixels to remain 21 if they were 21 in 2024
var img2025Corrected = img2025.where(maskClass21_2024, CLASS_PASTURE_MOSAIC);

// Reconstruct the collection with the corrected 2025 layer
var updatedChronologicalList = YEARS.map(function(year) {
    var currentYearInt = parseInt(year, 10);
    if (currentYearInt === 2025) {
        return img2025Corrected;
    }
    return outcropFilteredCollection.filter(ee.Filter.eq('year', currentYearInt)).first();
});

var temporalConsistentCollection = ee.ImageCollection.fromImages(updatedChronologicalList);

// ==============================================================================
// 6. STEP 3: SPATIAL STRUCTURAL FILTER (FRACTAL DIMENSION & AREA) FOR CLASS 21
// ==============================================================================
/**
 * Processes an individual land cover image, detecting structural noise in
 * class 21 using fractal dimension indices and reclassifying them to class 12.
 * @param {ee.Image} image - Input classification image for a single year.
 * @return {ee.Image} Filtered classification image.
 */
var applyFractalFilter = function(image) {
    var patchMask = image.eq(CLASS_PASTURE_MOSAIC);

    // Compute exposed edges using a fixed neighborhood kernel
    var weights = [
        [0, 1, 0],
        [1, 0, 1],
        [0, 1, 0]
    ];
    var neighborKernel = ee.Kernel.fixed({width: 3, height: 3, weights: weights});
    var neighbors = patchMask.convolve(neighborKernel);
    var exposedEdges = ee.Image(4).subtract(neighbors).multiply(patchMask);

    // Compute total perimeter values metric
    var pixelSide = ee.Image.pixelArea().sqrt();
    var pixelPerimeter = exposedEdges.multiply(pixelSide).rename('perimeter');

    // Separate patches into distinct connected component IDs
    var patchOnly = patchMask.selfMask();
    var patchIds = patchOnly.connectedComponents({
        connectedness: ee.Kernel.square(1),
        maxSize: MAX_PIXELS_PATCH
    }).select('labels');

    // Execute raster zonal statistics for area inside each connected patch
    var pixelArea = ee.Image.pixelArea().updateMask(patchOnly).rename('area');
    var patchArea = pixelArea.addBands(patchIds).reduceConnectedComponents({
        reducer: ee.Reducer.sum(),
        labelBand: 'labels',
        maxSize: MAX_PIXELS_PATCH
    });

    // Execute raster zonal statistics for perimeter inside each connected patch
    var patchTotalPerimeter = pixelPerimeter.updateMask(patchOnly).addBands(patchIds).reduceConnectedComponents({
        reducer: ee.Reducer.sum(),
        labelBand: 'labels',
        maxSize: MAX_PIXELS_PATCH
    });

    // Calculate Fractal Dimension (FD) formula: 2 * ln(Perimeter) / ln(Area)
    var fd = ee.Image(2).multiply(patchTotalPerimeter.log())
                        .divide(patchArea.log())
                        .rename('fractal_dimension');

    // Identify suspicious noise: Small structural area AND highly complex edge morphology
    var suspiciousPatches = fd.gt(FD_THRESHOLD).and(patchArea.lt(AREA_THRESHOLD_M2));

    // Reclassify suspicious areas from class 21 to class 12
    var correctedImage = image.where(suspiciousPatches, TARGET_RECLASS);

    return correctedImage.copyProperties(image, ['year', 'system:index']);
};

// Map the spatial structural filter function across the entire historical series
var finalFilteredCollection = temporalConsistentCollection.map(applyFractalFilter);

// ==============================================================================
// 7. VISUALIZATION AND VALIDATION
// ==============================================================================
// Extract standardized layers for map visualization verification
var checkYearBefore = temporalConsistentCollection.filter(ee.Filter.eq('year', 2025)).first().rename('classification_2025');
var checkYearAfter = finalFilteredCollection.filter(ee.Filter.eq('year', 2025)).first().rename('classification_2025');

Map.addLayer(checkYearBefore, {bands: 'classification_2025', min: 0, max: palette.length - 1, palette: palette}, '1. 2025 Before Spatial Filter', false);
Map.addLayer(checkYearAfter, {bands: 'classification_2025', min: 0, max: palette.length - 1, palette: palette}, '2. 2025 After Spatial Filter (Final)', true);

// ==============================================================================
// 8. EXPORT ARCHIVE
// ==============================================================================
// Dynamically map over the collection to restore the official MapBiomas band naming convention
var exportCollection = finalFilteredCollection.map(function(img) {
    var yearInt = ee.Number(img.get('year')).format('%d');
    var bandName = ee.String('classification_').cat(yearInt);
    return img.rename(bandName);
});

// Flatten the collection back into a single multi-band image for asset export
var exportImage = exportCollection.toBands().regexpRename('.*classification_', 'classification_');
var outputName = EXPORT_NAME_PREFIX + VERSION_OUT;

exportImage = exportImage
    .set('territory', 'BRAZIL')
    .set('biome', 'PANTANAL')
    .set('source', 'arcplan')
    .set('version', VERSION_OUT)
    .set('collection_id', 11.0)
    .set('description', 'Spatial structural filters (Fractal Dimension) and Class 29 Trajectory Filter');

Export.image.toAsset({
    image: exportImage.toInt8(),
    description: outputName,
    assetId: DIR_OUT + outputName,
    scale: 30,
    pyramidingPolicy: { '.default': 'mode' }, // 'mode' is strictly required for discrete categorical maps
    maxPixels: 1e13,
    region: geometry,
    overwrite: true
});

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias — ArcPlan — mariana@arcplan.com.br
 * MapBiomas Collection 11 | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
