/**
 * ==============================================================================
 * p04 | Remove outliers from the training samples
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   A stable pixel is not always a clean training sample. Mixed pixels at class
 *   borders, unflagged cloud shadow and burn scars all survive the stability test
 *   but sit far from the spectral centre of their class, and at 10 m they are
 *   numerous enough to distort the model.
 *   
 *   For each region, year and class, this step measures the distribution of five
 *   diagnostic bands and drops the samples in the extreme tails of any of them.
 *   A sample has to be plausible on all five to be kept.
 *   
 *   Output is one table per region, with every year merged, which is the layout
 *   the classification scripts in p02 expect.
 *
 * INPUTS
 *   - pontos_trained_stable_v1_{year}_all_regions (from p03)
 *   - or pontos_trained_stable91011_v1_{year}_all_regions
 *
 * OUTPUTS
 *   - pontos_trained_stable_cleaned_v1_reg{N}_trained (one table per region)
 *
 * NOTES
 *   - Run once per sample source, switching pathEntradaBase and pathSaidaBase
 *     together.
 *   - The source pointed at pontos_trained_stable_v1_ while p03 writes
 *     pontos_trained_stable91011_v1_; check the prefix matches what you ran.
 *
 * PIPELINE
 *   p01 samples | step 4 of 5  ->  p05_feature_importance and p02_classification
 * ==============================================================================
 */

// ==========================================
// 1. PARAMETERS
// ==========================================
var classes   = [3, 4, 12, 19, 21, 25, 29, 33];
var regioes   = [0, 1, 2, 3, 4, 5, 6, 7, 8];
var anoInicio = 2017;
var anoFim    = 2025;

// Run once per sample source, switching both paths together:
//   pontos_trained_stable_       -> pontos_trained_stable_cleaned_
//   pontos_trained_stable91011_  -> pontos_trained_stable91011_cleaned_
var pathEntradaBase = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/SAMPLES/PANTANAL/trained/pontos_trained_stable_v1_';
var pathSaidaBase   = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/SAMPLES/PANTANAL/trained/pontos_trained_stable_cleaned_v1_';

// ==========================================
// 2. BANDS USED TO DETECT OUTLIERS
// ------------------------------------------
// Five bands covering distinct, non-redundant domains. Screening on a small set
// keeps the cost per region near that of the original three-band IQR version
// while covering more of the feature space.
// ==========================================
var BANDAS = [
  'ndvi_median_wet',    // phenology at the wet-season peak
  'ndvi_median_dry',    // phenology under dry-season stress
  'lswi_median_dry',    // leaf moisture in the dry season
  'brightness_median',  // brightness and exposed soil
  'mndwi_median'        // water and flooding
];

var PARAMS = {
  pLow:  2,   // drop the bottom 2% of each band
  pHigh: 98   // drop the top 2% of each band
};

// ==========================================
// 3. OUTLIER REMOVAL
// ------------------------------------------
// Same shape as the original IQR routine, with three changes:
//   - direct percentiles instead of the interquartile range;
//   - size() evaluated once per class rather than once per band, which is what
//     caused the memory error in the earlier version;
//   - null-safe guard for classes that are absent from a region.
// ==========================================
var limparOutliers = function(fcOriginal, listaBandas, idClasse, params) {
  var pLow  = params.pLow  || 2;
  var pHigh = params.pHigh || 98;

  var fcClasse = fcOriginal.filter(ee.Filter.eq('reference', idClasse));

  // Evaluated once and reused across every band.
  var fcVazia = fcClasse.size().eq(0);

  var fcFiltrada = fcClasse;

  listaBandas.forEach(function(banda) {

    // Class percentiles, or wide-open bounds when the class is absent here.
    var limInf = ee.Number(ee.Algorithms.If(
      fcVazia,
      -1e10,
      fcClasse.reduceColumns(ee.Reducer.percentile([pLow]),  [banda]).get('p' + pLow)
    ));

    var limSup = ee.Number(ee.Algorithms.If(
      fcVazia,
      1e10,
      fcClasse.reduceColumns(ee.Reducer.percentile([pHigh]), [banda]).get('p' + pHigh)
    ));

    fcFiltrada = fcFiltrada.filter(ee.Filter.and(
      ee.Filter.gte(banda, limInf),
      ee.Filter.lte(banda, limSup)
    ));
  });

  return fcFiltrada;
};

// ==========================================
// 4. ONE EXPORT TASK PER REGION
// ==========================================
regioes.forEach(function(regiao) {
  var regiaoLimpaTotal = ee.FeatureCollection([]);

  for (var ano = anoInicio; ano <= anoFim; ano++) {
    var assetInput       = pathEntradaBase + ano + '_all_regions';
    var amostrasOriginal = ee.FeatureCollection(assetInput)
                             .filter(ee.Filter.eq('id_reg', 'reg' + regiao));
    var anoLimpoTotal    = ee.FeatureCollection([]);

    for (var i = 0; i < classes.length; i++) {
      var classeLimpa = limparOutliers(amostrasOriginal, BANDAS, classes[i], PARAMS);
      anoLimpoTotal = anoLimpoTotal.merge(classeLimpa);
    }

    regiaoLimpaTotal = regiaoLimpaTotal.merge(anoLimpoTotal);
  }

  Export.table.toAsset({
    collection:  regiaoLimpaTotal,
    description: 'Export_reg' + regiao + '_trained',
    assetId:     pathSaidaBase + 'reg' + regiao + '_trained'
  });
});

print(regioes.length + ' tasks queued, one per region.');

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias - ArcPlan - mariana@arcplan.com.br
 * MapBiomas Collection 4 (10 m) | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
