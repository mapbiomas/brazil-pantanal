/**
 * ==============================================================================
 * p02 | Temporal filter, three and four year windows
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Removes single-year and two-year flicker: a pixel that leaves a class and comes
 *   straight back to it almost never changed on the ground.
 *   
 *   The three-year window looks at t-1, t and t+1. If the class is present on both
 *   sides but absent in the middle, the middle year is corrected.
 *   
 *   The four-year window looks at t-2, t-1, t and t+1 and catches two-year gaps.
 *   It is run twice, over odd and even years, so that overlapping windows do not
 *   overwrite each other mid-pass.
 *   
 *   Both filters are applied class by class, in a fixed order, so that a correction
 *   to one class is visible to the next.
 *   
 *   Before the windows run, a water-class correction converts residual class 33
 *   pixels to grassland, since standing water is handled separately in p07.
 *
 * INPUTS
 *   - PANT_col11_Anual_30 (from p01)
 *
 * OUTPUTS
 *   - PANT_col11_Anual_{VERSION_OUT} (one band per year, 1985-2025)
 *
 * NOTES
 *   - Filter order: 19 (agriculture), 4, 12, 21, 3 for the three-year window;
 *     19, 21, 4, 12, 3, 25 for the four-year window.
 *   - The first and last years of the series are never altered by these windows.
 *
 * PIPELINE
 *   p03 post-classification | step 2 of 9  ->  p03_masks_prodes_alerts
 * ==============================================================================
 */

// ==============================================================================
// 1. INPUT PARAMETERS AND CONSTANTS
// ==============================================================================

// Input asset from Collection 11 (update path as needed to the actual Col11 asset)
var ASSET_IN = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/PANT_col11_Anual_30';
var DIR_OUT = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/';
var PREFIX_OUT = 'PANT_col11_Anual_';
var VERSION_OUT = '31';
var DESCRIPTION = 'Temporal Filter 3 and 4 years - Collection 11';

var START_YEAR = 1985;
var END_YEAR = 2025; // Updated to Collection 11 temporal range

var imgInput = ee.Image(ASSET_IN);

// Import palettes module
var palettes = require('users/mapbiomas/modules:Palettes.js');

var visParams = {
    'min': 0,
    'max': 69,
    'palette': palettes.get('classification9')
};

var visParamsSingle = {
    'bands': 'classification_2017',
    'min': 0,
    'max': 69,
    'palette': palettes.get('classification9')
};

// ==============================================================================
// 2. WATER CLASS CORRECTION (SERVER-SIDE OPTIMIZATION)
// ==============================================================================

// Generate full list of years
var years = ee.List.sequence(START_YEAR, END_YEAR);

// Function to correct specific classes (e.g., water) across all years
var correctClasses = function(y) {
    var yearStr = ee.Number(y).format('%04d');
    var bandName = ee.String('classification_').cat(yearStr);

    var imgYear = imgInput.select(bandName);

    // Create a mask for Water (class 33) and map it to 100
    var imgWater = imgYear.eq(33).multiply(100).selfMask();

    // Remap values based on the added mask logic
    var yearCorr = imgYear.add(imgWater).remap(
        [3, 4, 12, 19, 21, 29, 25, 33, 103, 104, 112, 119, 121, 129, 125, 133],
        [3, 4, 12, 19, 21, 29, 25, 33,  12,  12,  12,  12,  12,  12,  25,  12]
    );

    return imgYear.blend(yearCorr).rename(bandName);
};

// Apply correction and cast back to multiband image
var imgCorrected = ee.ImageCollection(years.map(correctClasses)).toBands();

// Standardize band names (removing toBands() prefix)
var bandNamesList = years.map(function(y) {
    return ee.String('classification_').cat(ee.Number(y).format('%04d'));
});
imgCorrected = imgCorrected.rename(bandNamesList);

Map.addLayer(imgCorrected, visParamsSingle, '1. Water Corrected Image', false);


// ==============================================================================
// 3. THREE-YEAR TEMPORAL FILTER
// ==============================================================================

/**
 * Applies a 3-year moving window filter.
 * Analyzes (year - 1), (central year), and (year + 1).
 * Replaces central year with the previous year's class if it differs from both,
 * but (year - 1) and (year + 1) match each other.
 */

// Define years for 3-year window (excludes first and last years)
var years3W = ee.List.sequence(START_YEAR + 1, END_YEAR - 1);

var window3y = function (img, targetClass) {
    var classWind = ee.ImageCollection(years3W.map(function(ano) {
        ano = ee.Number(ano);
        var anoStr = ano.format('%04d');
        var bandName = ee.String('classification_').cat(anoStr);

        var classCentral = img.select(bandName);
        var classPrev = img.select(ee.String('classification_').cat(ano.subtract(1).format('%04d')));
        var classNext = img.select(ee.String('classification_').cat(ano.add(1).format('%04d')));

        // Identify spatial inconsistency (Prev == target AND Next == target AND Central != target)
        var mask3 = classNext.eq(targetClass)
                        .and(classCentral.neq(targetClass))
                        .and(classPrev.eq(targetClass));

        // Update central pixel to target classes restricted by the mask
        var maskedPrev = classPrev.remap(
            [3, 4, 12, 21, 19],
            [3, 4, 12, 21, 19]
        ).updateMask(mask3);

        return classCentral.blend(maskedPrev.rename(bandName));
    })).toBands();

    // Preserve first and last years unaltered
    var classFirst = img.select(ee.String('classification_').cat(ee.Number(START_YEAR).format('%04d')));
    var classLast = img.select(ee.String('classification_').cat(ee.Number(END_YEAR).format('%04d')));

    var classFinal = classFirst.addBands(classWind).addBands(classLast);

    // Rename to clean standard
    return classFinal.rename(bandNamesList);
};

// Apply iteratively for distinct classes
var filtered3y = window3y(imgCorrected, 19);

filtered3y = window3y(filtered3y, 4);
filtered3y = window3y(filtered3y, 12);
filtered3y = window3y(filtered3y, 21);
filtered3y = window3y(filtered3y, 3);


// ==============================================================================
// 4. FOUR-YEAR TEMPORAL FILTER
// ==============================================================================

/**
 * Applies a 4-year temporal filter splitting the operation between odd and even years.
 * Analyzes (year - 2), (year - 1), (central year), and (year + 1).
 */

// Dynamically generate lists going backwards for 4-year filter bounds
var yearsOdd = ee.List.sequence(END_YEAR - 2, START_YEAR + 2, -2); // E.g., 2023 down to 1987
var yearsEven = ee.List.sequence(END_YEAR - 1, START_YEAR + 3, -2); // E.g., 2024 down to 1988

var applyWindow4y = function(img, targetClass, isEven) {
    var targetList = isEven ? yearsEven : yearsOdd;

    var classWind = ee.ImageCollection(targetList.map(function(ano) {
        ano = ee.Number(ano);
        var anoStr = ano.format('%04d');
        var bandName = ee.String('classification_').cat(anoStr);
        var prev1Str = ano.subtract(1).format('%04d');
        var prev2Str = ano.subtract(2).format('%04d');

        var classCentral = img.select(bandName);

        var mask4 = img.select(ee.String('classification_').cat(ano.add(1).format('%04d'))).eq(targetClass)
                .and(img.select(bandName).neq(targetClass))
                .and(img.select(ee.String('classification_').cat(prev1Str)).neq(targetClass))
                .and(img.select(ee.String('classification_').cat(prev2Str)).eq(targetClass));

        var maskedPrev2 = img.select(ee.String('classification_').cat(prev2Str))
                             .remap([3, 4, 12, 21, 19,25], [3, 4, 12, 21, 19,25])
                             .updateMask(mask4);

        var classCorrCentral = classCentral.blend(maskedPrev2.rename(bandName));
        var classCorrPrev1 = img.select(ee.String('classification_').cat(prev1Str))
                                .blend(maskedPrev2.rename(ee.String('classification_').cat(prev1Str)));

        return classCorrCentral.addBands(classCorrPrev1);
    })).toBands();

    // Assemble the complete image, appending unaffected temporal boundaries
    var finalImg = img;

    // toBands() prefixes each band with its index; strip the prefix so that
    // addBands(..., null, true) overwrites the matching bands in place.
    var cleanBands = classWind.bandNames().map(function(n) {
        return ee.String(n).replace('^.*classification_', 'classification_');
    });
    classWind = classWind.rename(cleanBands);

    return finalImg.addBands(classWind, null, true); // True = overwrite matching bands
};

// Helper function to sequentially apply the 4-year filter (Odd then Even logic)
var window4y = function(img, targetClass) {
    var outImg = applyWindow4y(img, targetClass, false); // ODD
    outImg = applyWindow4y(outImg, targetClass, true);   // EVEN
    return outImg;
};

// Apply iteratively
var filteredFinal = window4y(filtered3y, 19);
filteredFinal = window4y(filteredFinal, 21);
filteredFinal = window4y(filteredFinal, 4);
filteredFinal = window4y(filteredFinal, 12);
filteredFinal = window4y(filteredFinal, 3);
filteredFinal = window4y(filteredFinal, 25);

// ==============================================================================
// 5. VISUALIZATION AND EXPORT
// ==============================================================================

Map.addLayer(imgInput.select('classification_1986'), visParams, '1986 Original', false);
Map.addLayer(filteredFinal.select('classification_1986'), visParams, '1986 Filtered Final', true);

// Setup Metadata Properties for Collection 11
filteredFinal = filteredFinal
    .set('territory', 'BRAZIL')
    .set('biome', 'PANTANAL')
    .set('source', 'arcplan')
    .set('version', VERSION_OUT)
    .set('year', VERSION_OUT)
    .set('collection_id', 11.0)
    .set('description', DESCRIPTION)
    .toByte();

print('Final Export Image Properties:', filteredFinal);

// Execute Export Task
Export.image.toAsset({
    "image": filteredFinal,
    "description": PREFIX_OUT + VERSION_OUT,
    "assetId": DIR_OUT + PREFIX_OUT + VERSION_OUT,
    "scale": 30,
    "pyramidingPolicy": {
        '.default': 'mode'
    },
    "maxPixels": 1e13,
    "region": imgInput.geometry() // Safely bounds the export to the asset's original geometry
});

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias — ArcPlan — mariana@arcplan.com.br
 * MapBiomas Collection 11 | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
