/**
 * ==============================================================================
 * p03 | Temporal filter, moving windows and edge years
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Removes flicker: a pixel that leaves a class and comes straight back to it
 *   almost never changed on the ground.
 *   
 *   Four stages:
 *     1. three-year window, which catches a single anomalous year between two
 *        matching neighbours;
 *     2. four-year window, which catches an anomalous pair;
 *     3. edge-year correction. The first and last years have a neighbour on one
 *        side only, so small clearing and regrowth patches there are checked
 *        against the adjacent year and reverted if they are below the minimum
 *        mapping unit;
 *     4. pair-to-pair transition filter, which reverts clearing and regrowth
 *        patches of 25 pixels or fewer between consecutive years.
 *   
 *   Both windows are applied class by class, in a fixed order, so a correction to
 *   one class is visible to the next.
 *
 * INPUTS
 *   - PANT_col4_Anual_moda_filter_2 (from p02)
 *
 * OUTPUTS
 *   - PANT_col4_Anual_temp_filter_{version_out} (one band per year, 2017-2025)
 *
 * NOTES
 *   - Water (33) is excluded from the window filters on purpose: seasonal
 *     flooding is real change and is handled in p01 and p05.
 *   - Changed from the source: the export now uses class_corrigido rather than
 *     filtered, so stages 3 and 4 actually reach the output asset. See the note
 *     above the export block.
 *
 * PIPELINE
 *   p03 post-classification | step 3 of 7  ->  p04_trajectory_filter
 * ==============================================================================
 */

/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var REGIONS_BUFFER_FC = ee.FeatureCollection("projects/ee-arcplan-df/assets/col11/regions_buffer");
/***** End of imports. If edited, may not auto-convert in the playground. *****/

var geometry = REGIONS_BUFFER_FC;
var col8 = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/PANT_col4_Anual_moda_filter_2');

var ANOS_JS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

// Display palette
var palettes = require('users/mapbiomas/modules:Palettes.js');
var vis  = { min: 0, max: 69, palette: palettes.get('classification9') };
var vis2 = { bands: 'classification_2017', min: 0, max: 69, palette: palettes.get('classification9') };
Map.addLayer(col8, vis2, 'sem filtro');


// =============================================================================
// TEMPORAL FILTER - THREE-YEAR WINDOW
// Detects and corrects isolated single years.
// Condition: class[t-1] == target AND class[t] != target AND class[t+1] == target
// Correction: class[t] takes class[t-1]
// Runs over 2018-2024: the interior years, which have a neighbour on both sides.
// =============================================================================
var imgCol = ee.Image(col8);

// Interior years, server-side, for the ee.ImageCollection map
var anosInner3 = ee.List.sequence(2018, 2024).map(function(y) { return ee.Number(y).int(); });

var window3y = function(img, classe) {
  var classWind = ee.ImageCollection(anosInner3.map(function(ano) {
    ano = ee.Number(ano);
    var nomeBanda = ee.String('classification_').cat(ano.format());

    var class_Ano = img.select(nomeBanda);
    var classPrev = img.select(ee.String('classification_').cat(ano.subtract(1).format()));
    var classNext = img.select(ee.String('classification_').cat(ano.add(1).format()));

    // Pattern [target, not target, target]: the middle year is anomalous
    var mask_3 = classPrev.eq(classe)
      .and(class_Ano.neq(classe))
      .and(classNext.eq(classe));

    // Valid classes only; water (33) is excluded to avoid artefacts
    mask_3 = classPrev.remap([3, 4, 12, 21, 19, 25, 29],
                             [3, 4, 12, 21, 19, 25, 29]).updateMask(mask_3);

    return class_Ano.blend(mask_3.rename(nomeBanda));
  })).toBands();

  // First and last years are carried through unchanged
  var n      = anosInner3.size();
  var ultimo = ee.Number(anosInner3.get(n.subtract(1))).add(1);

  var class_pri   = img.select('classification_2017').rename('00_classification_2017');
  var class_ult   = img.select(ee.String('classification_').cat(ultimo))
                       .rename(ee.String('00_classification_').cat(ultimo));
  var class_full  = class_pri.addBands(classWind).addBands(class_ult);

  // Strip the numeric prefix that toBands() adds
  var corrIndx = function(im) {
    var orig = im.bandNames();
    var clean = orig.map(function(nome) {
      return ee.String(nome).split('_').slice(1).join('_');
    });
    return im.select(orig, clean);
  };

  return corrIndx(class_full);
};


// =============================================================================
// TEMPORAL FILTER - FOUR-YEAR WINDOW
// Detects and corrects anomalous consecutive PAIRS of years.
// Condition: class[t-1] == target AND class[t] != target AND
//           class[t+1] != alvo  E  class[t+2] == alvo
// Correction: class[t] and class[t+1] take class[t-1]
//
// Client-side implementation:
//   - masks always come from the INPUT image `img`, so there is no cascade
//     within a single call of the function;
//   - addBands(..., null, true) overwrites the existing band with the correction.
//   - t runs from 2018 to 2023, so that t+2 stays within the series.
// =============================================================================
var window4y = function(img, classe) {
  var anosFirst = [2018, 2019, 2020, 2021, 2022, 2023]; // t: primeiro do par
  var imgOut = img;

  anosFirst.forEach(function(ano) {
    // Always read from the original image, so corrections do not cascade
    var classPrev = img.select('classification_' + (ano - 1)); // t-1
    var classT    = img.select('classification_' + ano);       // t
    var classT1   = img.select('classification_' + (ano + 1)); // t+1
    var classT2   = img.select('classification_' + (ano + 2)); // t+2

    // Pattern [target, not, not, target]
    var mask_4 = classPrev.eq(classe)
      .and(classT.neq(classe))
      .and(classT1.neq(classe))
      .and(classT2.eq(classe));

    // Corrected value comes from classPrev, which equals the target
    var corrVal = classPrev.remap([3, 4, 12, 21, 19, 25, 29],
                                  [3, 4, 12, 21, 19, 25, 29]).updateMask(mask_4);

    // Correct both t and t+1 in the output
    var corrT  = classT.blend(corrVal.rename('classification_' + ano));
    var corrT1 = classT1.blend(corrVal.rename('classification_' + (ano + 1)));

    imgOut = imgOut.addBands(corrT,  null, true)
                   .addBands(corrT1, null, true);
  });

  return imgOut;
};


// =============================================================================
// APPLY THE FILTERS
// Order: three-year window first, then four-year
// Class order: agriculture, pasture, savanna, grassland, forest
// =============================================================================

// -- Janela de 3 anos ---------------------------------------------------------
var filtered = window3y(imgCol,   19); // Temporary crops
    filtered = window3y(filtered, 21); // Pastagem
    filtered = window3y(filtered,  4); // Savanna
    filtered = window3y(filtered, 12); // Grassland
    filtered = window3y(filtered,  3); // Forest

// -- Janela de 4 anos ---------------------------------------------------------
    filtered = window4y(filtered, 19); // Temporary crops
    filtered = window4y(filtered, 21); // Pastagem
    filtered = window4y(filtered,  4); // Savanna
    filtered = window4y(filtered, 12); // Grassland
    filtered = window4y(filtered,  3); // Forest

// S2_v2 recebe o resultado de AMBOS os filtros
var S2_v2 = filtered;


// =============================================================================
// EDGE-YEAR NOISE CORRECTION (first and last year of the series)
// Small clearing and regrowth patches in the first and last years are checked
// against the adjacent year, which is the only neighbour they have.
// =============================================================================

// Level 0 hierarchy: native vegetation (1) against anthropogenic and other (10)
for (var i_ano = 0; i_ano < ANOS_JS.length; i_ano++) {
  var ano = ANOS_JS[i_ano];
  var class_nivel0_ano = filtered.select('classification_' + ano)
    .remap([3, 4, 11, 12, 21, 19, 25, 29, 33],
           [1, 1,  1,  1, 10, 10, 10,  1,  1])
    .rename('classification_' + ano);
  if (i_ano === 0) { var class_nivel0 = class_nivel0_ano; }
  else             { class_nivel0 = class_nivel0.addBands(class_nivel0_ano); }
}

var nChanges = class_nivel0.reduce(ee.Reducer.countRuns()).subtract(1);
Map.addLayer(nChanges, {
  min: 0, max: 6,
  palette: ['#ffffff','#fee0d2','#fcbba1','#fb6a4a','#ef3b2c','#a50f15','#67000d'],
  format: 'png'
}, 'nChanges', false);

// -- Last year (2025): clearing and regrowth patches under 1 ha ----------------
var nivel0_ult  = class_nivel0.select('classification_2025');
var nivel0_ult1 = class_nivel0.select('classification_2024');

var desmat_ult = nivel0_ult.eq(10).and(nivel0_ult1.eq(1));
var connDesmatUlt = desmat_ult.selfMask().connectedPixelCount(51, true)
  .reproject('epsg:4326', null, 10);
var ruido_desmat_ult = S2_v2.select('classification_2025').updateMask(connDesmatUlt.lte(50));

var regen_ult = nivel0_ult.eq(1).and(nivel0_ult1.eq(10));
var connRegenUlt = regen_ult.selfMask().connectedPixelCount(51, true)
  .reproject('epsg:4326', null, 10);
var ruido_regen_ult = S2_v2.select('classification_2025').updateMask(connRegenUlt.lte(50));

// -- Primeiro ano (2017): corrige patches < 1 ha de desmat e regen ------------
var nivel0_pri  = class_nivel0.select('classification_2017');
var nivel0_pri1 = class_nivel0.select('classification_2018');

var desmat_pri = nivel0_pri.eq(1).and(nivel0_pri1.eq(10));
var connDesmatPri = desmat_pri.selfMask().connectedPixelCount(101, true)
  .reproject('epsg:4326', null, 10);
var ruido_desmat_pri = S2_v2.select('classification_2017').updateMask(connDesmatPri.lte(100));

var regen_pri = nivel0_pri.eq(10).and(nivel0_pri1.eq(1));
var connRegenPri = regen_pri.selfMask().connectedPixelCount(101, true)
  .reproject('epsg:4326', null, 10);
var ruido_regen_pri = S2_v2.select('classification_2017').updateMask(connRegenPri.lte(100));

// -- Apply the edge corrections ------------------------------------------------
var class_final;
for (var i_ano = 0; i_ano < ANOS_JS.length; i_ano++) {
  var ano = ANOS_JS[i_ano];
  var class_ano = S2_v2.select('classification_' + ano);
  var class_corr;

  if (ano === 2017) {
    // First year of the series
    class_corr = class_ano.blend(ruido_desmat_pri).blend(ruido_regen_pri);
  } else if (ano === 2025) {
    // Last year of the series
    class_corr = class_ano.blend(ruido_desmat_ult).blend(ruido_regen_ult);
  } else {
    class_corr = class_ano;
  }

  if (i_ano === 0) { class_final = class_corr; }
  else             { class_final = class_final.addBands(class_corr); }
}

print('class_final', class_final);


// =============================================================================
// PAIR-TO-PAIR TRANSITION FILTER
// Reverts spurious transitions between consecutive years:
//   clearing: forest to pasture (321, 421, 1221) in patches of 25 px or fewer
//   regrowth: pasture to forest (2103, 2104, 2112) in patches of 25 px or fewer
// =============================================================================
var anosTransicao = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]; // de ano para ano+1
var class_corrigido = class_final.select('classification_2017');
var class_ano_segui_corr;

for (var i_ano = 0; i_ano < anosTransicao.length; i_ano++) {
  var ano = anosTransicao[i_ano];

  var class_ano_atual = (ano === 2017)
    ? class_final.select('classification_' + ano)
    : class_ano_segui_corr;

  var class_ano_segui = class_final.select('classification_' + (ano + 1));

  var transicao = class_ano_atual.multiply(100).add(class_ano_segui);
  var connTrans = transicao.connectedPixelCount(51, true).reproject('epsg:4326', null, 10);

  // Small clearing patches
  var erro_desmat_03  = transicao.eq(321).and(connTrans.lte(25));   // floresta -> pasto
  var erro_desmat_04  = transicao.eq(421).and(connTrans.lte(25));   // savana   -> pasto
  var erro_desmat_12  = transicao.eq(1221).and(connTrans.lte(25));  // campo    -> pasto

  // Small regrowth patches
  var erro_regen_21   = transicao.eq(2103).and(connTrans.lte(25));  // pasto -> floresta
  var erro_regen_21a  = transicao.eq(2104).and(connTrans.lte(25));  // pasto -> savana
  var erro_regen_21b  = transicao.eq(2112).and(connTrans.lte(25));  // pasto -> campo

  class_ano_segui_corr = class_ano_segui
    .blend(erro_desmat_03.remap([1],[3]))
    .blend(erro_desmat_04.remap([1],[4]))
    .blend(erro_desmat_12.remap([1],[12]))
    .blend(erro_regen_21.remap([1],[21]))
    .blend(erro_regen_21a.remap([1],[21]))
    .blend(erro_regen_21b.remap([1],[21]))
    .rename('classification_' + (ano + 1));

  class_corrigido = class_corrigido.addBands(class_ano_segui_corr);
}

print('class_corrigido', class_corrigido);


// =============================================================================
// VISUAL CHECK
// =============================================================================
Map.addLayer(col8.select('classification_2025'),       vis, 'Input 2025',     false);
Map.addLayer(filtered.select('classification_2025'),   vis, 'Filtrado 2025',  false);
Map.addLayer(class_corrigido.select('classification_2025'), vis, 'Corrigido 2025', true);


// =============================================================================
// EXPORT
// =============================================================================
var vesion_in   = '2';
var version_out = '3';
var descricao   = 'Filtro temporal 3 e 4 anos';
var col         = 4.0;
var prefixo_out = 'PANT_col4_Anual_temp_filter_';
var dirout      = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/';
//projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/PANT_col4_Anual_moda_filter_
// NOTE: the source exported `filtered`, which is the state after the moving
// windows only, so the edge-noise correction and the pair-transition filter below
// were computed, printed and then discarded. Exporting `class_corrigido` applies
// the whole script. Swap it back if the earlier behaviour is what you want.
var finalOutput = class_corrigido
  .set('territory',    'BRAZIL')
  .set('biome',        'PANTANAL')
  .set('source',       'arcplan')
  .set('version',      version_out)
  .set('year',         version_out)
  .set('collection_id', col)
  .set('description',  descricao);

print('Ready to export:', finalOutput);

Export.image.toAsset({
  image:            finalOutput.toByte(),
  description:      prefixo_out + version_out,
  assetId:          dirout + prefixo_out + version_out,
  scale:            10,
  pyramidingPolicy: { '.default': 'mode' },
  maxPixels:        1e13,
  region:           REGIONS_BUFFER_FC
});

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias - ArcPlan - mariana@arcplan.com.br
 * MapBiomas Collection 4 (10 m) | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
