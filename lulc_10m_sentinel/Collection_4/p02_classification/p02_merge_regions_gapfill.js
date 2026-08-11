/**
 * ==============================================================================
 * p02 | Merge the regional classifications and fill temporal gaps
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Assembles the nine regional classifications into one seamless biome-wide map,
 *   then fills the pixels no year could classify.
 *   
 *   Regions are classified over buffered boundaries, so neighbouring outputs
 *   overlap. Three pixel situations are handled separately:
 *     A. inside exactly one official boundary, no overlap -> take it directly;
 *     B. inside an official boundary but also under a neighbour buffer -> weighted
 *        vote, with a bonus for the region that officially owns the pixel;
 *     C. only under overlapping buffers -> weighted vote driven by REGION_ORDER.
 *   
 *   Weighting the vote instead of painting one region over another is what removes
 *   the visible seams a plain z-order mosaic leaves along region borders.
 *   
 *   The gap fill then propagates values forward and backward in time, so a pixel
 *   with no valid observation in a year inherits its nearest classified neighbour.
 *
 * INPUTS
 *   - PANT_col4_reg0_v* ... PANT_col4_reg8_v* (from p01)
 *   - Region exact boundaries (regions_t) and buffered boundaries (regions_buffer)
 *
 * OUTPUTS
 *   - PANT_col4_Anual_GapFill_{VERSION_OUT} (one band per year, 2017-2025)
 *
 * NOTES
 *   - REGION_ORDER runs bottom to top: the last entry wins the most votes.
 *   - EXACT_BONUS is the extra weight a region gets inside its official boundary.
 *   - One entry of REGION_ORDER had lost its label in the source; the order itself
 *     is unchanged.
 *
 * PIPELINE
 *   p02 classification | merge step  ->  p03_post_classification
 * ==============================================================================
 */

/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var REGIONS_BUFFER_FC = ee.FeatureCollection("projects/ee-arcplan-df/assets/col11/regions_buffer");
/***** End of imports. If edited, may not auto-convert in the playground. *****/

// ==============================================================================
// 1. PARAMETERS & CONSTANTS
// ==============================================================================

// Export extent: the union of all buffered regions.
var roi = REGIONS_BUFFER_FC;

// Region outlines, hidden by default, for visual checking.
var regionIds = ['reg0', 'reg1', 'reg2', 'reg3', 'reg4', 'reg5', 'reg6', 'reg7', 'reg8'];
regionIds.forEach(function(regId) {
    var regFeature = REGIONS_BUFFER_FC.filter(ee.Filter.eq('id_reg', regId));
    Map.addLayer(regFeature, {}, regId, false); // Hidden by default to avoid visual clutter
});

// -- Geometries --------------------------------------------------------------
// Exact (official) boundaries - one feature per region, referenced by 'id_reg'
var regionsExact = ee.FeatureCollection('projects/ee-arcplan-df/assets/col11/regions_t');

// Buffered boundaries - referenced by 'id_reg'
var regionsBuffer = ee.FeatureCollection('projects/ee-arcplan-df/assets/col11/regions_buffer');

// Temporal Scope for Collection 4
var START_YEAR = 2017;
var END_YEAR   = 2025;
var YEARS      = ee.List.sequence(START_YEAR, END_YEAR);

// Z-Index hierarchy. BOTTOM -> TOP: last entry has the highest priority (most votes)
var REGION_ORDER = [
  'reg0',  // rank 0 -> 1 base vote
  'reg6',  // rank 1 -> 2 base votes
  'reg7',  // rank 2 -> 3 base votes
  'reg8',  // rank 3 -> 4 base votes
  'reg1',  // rank 4 -> 5 base votes
  'reg3',  // rank 5 -> 6 base votes
  'reg5',  // rank 6 -> 7 base votes
  'reg4',  // rank 7 -> 8 base votes
  'reg2',  // rank 8 -> 9 base votes
];

// Additional votes granted when a pixel falls inside the EXACT boundary of a region.
// Ensures official limits overcome overlapping neighboring buffers.
var EXACT_BONUS = 5;

// Collection metadata constants
var BIOME            = 'PANTANAL';
var COL_VERSION      = 4.0;
var VERSION_OUT      = '3';
var DESCRIPTION      = 'Consolidated Mosaic - Buffer Modal Consensus + Gap Fill - Col 4';
var DIR_ASSETS       = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan';
var ASSET_PREFIX_OUT = 'PANT_col4_Anual_GapFill_';
var ASSET_BIOMES     = 'projects/mapbiomas-workspace/AUXILIAR/biomas-raster-41_old';

// Styling and palettes
var palettes  = require('users/mapbiomas/modules:Palettes.js');
var visParams = { min: 0, max: 62, palette: palettes.get('classification7') };

// ==============================================================================
// 2. RASTERIZE EXACT & BUFFER GEOMETRIES PER REGION
// ==============================================================================

var biomesRaster = ee.Image(ASSET_BIOMES);
var pantanalMask = biomesRaster.mask(biomesRaster.eq(3));

// Regional fragments written by p01, identified by the 'reg' tag in their id.
var rawFragmentedCol = ee.ImageCollection(DIR_ASSETS)
  .filter(ee.Filter.stringContains('system:index', 'reg'));

var bandNames = YEARS.map(function(y) {
  return ee.String('classification_').cat(ee.Number(y).format('%d'));
});

var makeExactMask = function(regId) {
  var geom = regionsExact.filter(ee.Filter.eq('id_reg', regId)).geometry();
  return ee.Image.constant(1).clip(geom).unmask(0).toByte().rename('exact');
};

var makeBufferMask = function(regId) {
  var geom = regionsBuffer.filter(ee.Filter.eq('id_reg', regId)).geometry();
  return ee.Image.constant(1).clip(geom).unmask(0).toByte().rename('buffer');
};

// Pre-compute and map mask images for all regions
var exactMasks = ee.ImageCollection.fromImages(
  REGION_ORDER.map(function(regId) {
    return makeExactMask(regId).set('regId', regId);
  })
);

var bufferMasks = ee.ImageCollection.fromImages(
  REGION_ORDER.map(function(regId) {
    return makeBufferMask(regId).set('regId', regId);
  })
);

// ---------------------------------------------------------------------------
// Coverage Count Rasters for Z-Index Logic
// ---------------------------------------------------------------------------

var exactCount = exactMasks.sum().rename('exactCount');
var bufferCount = bufferMasks.sum().rename('bufferCount');

// FIX: Robust logic restored to correctly flag overlaps even when exact boundaries cross.
// A pixel needs consensus if more than 1 buffer overlaps, OR if it's strictly in a buffer strip.
var needsConsensus = bufferCount.gt(1)
  .or(bufferCount.gt(0).and(exactCount.eq(0)))
  .rename('needsConsensus')
  .toByte();

// Identify pixels belonging exclusively to ONE region's exact boundary
var isExclusiveExact = exactCount.eq(1).and(needsConsensus.not())
  .rename('exclusiveExact')
  .toByte();

// ==============================================================================
// 3. HELPERS: LOAD ONE REGION's CLASSIFICATION FOR ONE YEAR
// ==============================================================================

var loadRegionYear = function(regId, bName) {
  var safeRegId = regId + '_';
  var regFragments = rawFragmentedCol
    .filter(ee.Filter.stringContains('system:index', safeRegId));

  return ee.Image(
    ee.Algorithms.If(
      regFragments.size().gt(0),
      regFragments.map(function(img) {
        return ee.Image(
          ee.Algorithms.If(
            img.bandNames().contains(ee.String(bName)),
            img.select([ee.String(bName)]).toByte(),
            ee.Image.constant(0).mask(0).rename([ee.String(bName)]).toByte()
          )
        );
      }).mosaic(),
      ee.Image.constant(0).mask(0).rename([ee.String(bName)]).toByte()
    )
  );
};

// ==============================================================================
// 4. ASSEMBLE YEAR-BY-YEAR MOSAIC
// ==============================================================================

var yearlyMosaicsList = YEARS.map(function(year) {
  var bName = ee.String('classification_').cat(ee.Number(year).format('%d'));

  // -- 4a. Exclusive-Exact Zone ----------------------------------------------
  var exclusiveParts = ee.ImageCollection.fromImages(
    REGION_ORDER.map(function(regId) {
      var regImg = loadRegionYear(regId, bName);
      var thisExact = makeExactMask(regId);
      var exclusiveHere = thisExact.and(isExclusiveExact);
      return regImg.updateMask(exclusiveHere);
    })
  ).mosaic();

  // -- 4b. Consensus Zone ----------------------------------------------------
  var allVoteImages = ee.List(
    REGION_ORDER.map(function(regId, i) {
      var rank      = i;
      var regImg    = loadRegionYear(regId, bName);
      var thisExact = makeExactMask(regId);
      var thisBuf   = makeBufferMask(regId);

      var regImgInBuf = regImg.updateMask(thisBuf.and(needsConsensus));
      var baseVotes   = ee.List.sequence(0, rank).map(function(_) { return regImgInBuf; });

      var regImgInExact = regImg.updateMask(thisExact.and(needsConsensus));
      var bonusVotes    = ee.List.sequence(0, ee.Number(EXACT_BONUS).subtract(1))
        .map(function(_) { return regImgInExact; });

      return baseVotes.cat(bonusVotes);
    })
  ).flatten();

  var consensusImage = ee.ImageCollection.fromImages(allVoteImages)
    .mode()
    .rename([bName])
    .toByte()
    .updateMask(needsConsensus);

  // -- 4c. Combine Exclusive + Consensus Spatial Zones -----------------------
  var combined = ee.ImageCollection.fromImages([
    exclusiveParts,
    consensusImage
  ]).mosaic().rename([bName]).toByte();

  return combined.set('year', year);
});

// Stack multi-band image (1985 to 2025)
var classificationMosaic = ee.ImageCollection.fromImages(yearlyMosaicsList)
  .toBands()
  .rename(bandNames);

classificationMosaic = classificationMosaic.mask(classificationMosaic.neq(0));

// ==============================================================================
// 5. TEMPORAL GAP FILL FILTER
// ==============================================================================

var applyGapFill = function(image, bNames) {
  // Forward Gap Fill
  var imageFilledForward = bNames.slice(1).iterate(function(bandName, previousImage) {
    var currentImage = image.select(ee.String(bandName));
    previousImage    = ee.Image(previousImage);
    currentImage     = currentImage.unmask(previousImage.select([0]));
    return currentImage.addBands(previousImage);
  }, ee.Image(image.select([bNames.get(0)])));

  imageFilledForward = ee.Image(imageFilledForward);

  // Backward Gap Fill
  var bandNamesReversed = bNames.reverse();
  var imageFilledBackward = bandNamesReversed.slice(1).iterate(function(bandName, previousImage) {
    var currentImage = imageFilledForward.select(ee.String(bandName));
    previousImage    = ee.Image(previousImage);
    currentImage     = currentImage.unmask(
      previousImage.select(previousImage.bandNames().length().subtract(1))
    );
    return previousImage.addBands(currentImage);
  }, ee.Image(imageFilledForward.select([bandNamesReversed.get(0)])));

  return ee.Image(imageFilledBackward).select(bNames);
};

// Filter occurrences to ensure anomalous isolated pixels are properly mapped
var bandsOccurrence = ee.Dictionary(
  bandNames.cat(classificationMosaic.bandNames())
    .reduce(ee.Reducer.frequencyHistogram())
);

var curatedBandsDict = bandsOccurrence.map(function(key, value) {
  return ee.Image(
    ee.Algorithms.If(
      ee.Number(value).eq(2),
      classificationMosaic.select([key]).toByte(),
      ee.Image().rename([key]).toByte().updateMask(classificationMosaic.select(0))
    )
  );
});

var classificationCurated = ee.Image(
  bandNames.iterate(function(band, imageAcc) {
    return ee.Image(imageAcc).addBands(curatedBandsDict.get(ee.String(band)));
  }, ee.Image().select())
);

var finalGapFilled = applyGapFill(classificationCurated, bandNames);
// Optional: finalGapFilled = finalGapFilled.mask(pantanalMask);

// ==============================================================================
// 6. VISUALIZATION & EXPORT
// ==============================================================================
var image = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-3/GENERAL/classification-pan-ft/pant_s2Emb_final_v16')
Map.addLayer(
  classificationMosaic.select('classification_2019'),
  visParams, 'Raw Assembled 2019', false
);
Map.addLayer(
  image.select('classification_2019'),
  visParams, 'V1 2019', false
);
Map.addLayer(
  finalGapFilled.select('classification_2019'),
  visParams, 'Gap Filled 2019', true
);

// Diagnostic Spatial Overlap Layers
Map.addLayer(exactCount,
  { min: 0, max: 4, palette: ['white','yellow','orange','red'] },
  'Diagnostic: Exact boundary overlap count', false);
Map.addLayer(bufferCount,
  { min: 0, max: 4, palette: ['white','lightblue','blue','darkblue'] },
  'Diagnostic: Buffer overlap count', false);
Map.addLayer(needsConsensus,
  { min: 0, max: 1, palette: ['white','purple'] },
  'Diagnostic: Consensus zone (buffer strips + overlaps)', false);
Map.addLayer(isExclusiveExact,
  { min: 0, max: 1, palette: ['white','green'] },
  'Diagnostic: Exclusive exact zone (direct classification)', false);

// Metadata assignment for downstream MapBiomas processing
finalGapFilled = finalGapFilled.toByte().set({
  territory:         'BRAZIL',
  biome:             BIOME,
  source:            'arcplan',
  version:           VERSION_OUT,
  collection_id:     COL_VERSION,
  description:       DESCRIPTION,
  temporal_coverage: START_YEAR + '-' + END_YEAR
});

var outputAssetName = DIR_ASSETS + '/' + ASSET_PREFIX_OUT + VERSION_OUT;

Export.image.toAsset({
  image:            finalGapFilled,
  description:      ASSET_PREFIX_OUT + VERSION_OUT,
  assetId:          outputAssetName,
  scale:            10,
  pyramidingPolicy: { '.default': 'mode' },
  maxPixels:        1e13,
  region:           roi
});

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias - ArcPlan - mariana@arcplan.com.br
 * MapBiomas Collection 4 (10 m) | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
