/**
 * ==============================================================================
 * p07 | PRODES and MapBiomas alerts masks
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Last step of the chain. Brings in two independent datasets to settle the
 *   cases the model cannot resolve from imagery alone, in opposite directions.
 *   
 *   The non-pasture mask, adjusted by PRODES, is restrictive: inside areas known
 *   not to hold pasture and with no PRODES clearing recorded up to that year,
 *   pasture and cropland revert to grassland. Where PRODES did record clearing,
 *   the pixel has genuinely been converted and the mask stands down.
 *   
 *   The MapBiomas alerts are permissive in the other direction: an alerted pixel
 *   is confirmed clearing, so native vegetation becomes pasture from the detection
 *   year onward, and stays pasture in every later year. Only water is left alone.
 *   
 *   The output of this script is the asset delivered to the national integration.
 *
 * INPUTS
 *   - PANT_col4_Anual_df_filter_6 (from p06)
 *   - PRODES accumulated deforestation to 2000 and yearly increments
 *   - MapBiomas deforestation alerts 2019-2025
 *   - Non-pasture mask (mask_sem_pasto)
 *
 * OUTPUTS
 *   - PANT_col4_Anual_sp_filter_{version_out} (one band per year, 2017-2025)
 *   - This is the asset delivered to the MapBiomas national integration.
 *
 * NOTES
 *   - Alerts are cumulative: a 2020 alert keeps the pixel as pasture in 2021,
 *     2022 and every later year.
 *   - A scratch block that loaded several published Landsat and Sentinel versions
 *     for side-by-side inspection was removed from the top of the file.
 *
 * PIPELINE
 *   p03 post-classification | step 7 of 7  ->  national integration
 * ==============================================================================
 */

var roi  = ee.FeatureCollection('projects/ee-arcplan-df/assets/col11/regions_buffer');
var anos = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

var imgEntrada = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/PANT_col4_Anual_df_filter_6');

// How long an alert keeps the pixel as pasture, counting the detection year
var ALERT_WINDOW = 4;

var palettes = require('users/mapbiomas/modules:Palettes.js');
var vis = { min: 0, max: 62, palette: palettes.get('classification8') };


// ======================================================================
// ASSETS
// ======================================================================
var PRODES_2000      = ee.FeatureCollection('users/gee_arcplan/col9/accumulated_deforestation_2000');
var PRODES_INC       = ee.FeatureCollection('users/gee_arcplan/col9/prodes_pos2000');
var ALERTS           = ee.FeatureCollection('projects/ee-arcplan-df/assets/col11/alertas_19-25');
var MASK_NON_PASTURE = ee.FeatureCollection('users/gee_arcplan/col8/mask_sem_pasto');
var BIOMES           = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-raster-41_old');

var pantanalMask = BIOMES.mask(BIOMES.eq(3));
var geometry     = pantanalMask.geometry();


// ======================================================================
// BASE MASKS, COMPUTED ONCE OUTSIDE THE LOOP
// ======================================================================

// "No pasture" areas, clipped to the Pantanal
var maskNonPasture = ee.Image(1).mask(pantanalMask)
                      .clip(MASK_NON_PASTURE)
                      .neq(0).remap([1], [1], 0).toByte().selfMask();

// PRODES accumulated to 2000: ground already converted before the Landsat series
var maskProdes2000 = PRODES_2000
                      .reduceToImage(['year'], 'mean')
                      .neq(0).remap([1], [100], 0).toByte().selfMask();

// Base mask: "no pasture" and no PRODES clearing recorded up to 2000.
// Where PRODES already recorded clearing the blend writes 100 and .eq(1) drops it,
// so the correction does not act on ground that was already converted.
var baseProdesMask = maskNonPasture.blend(maskProdes2000).eq(1).selfMask();

// Visual check
Map.addLayer(maskNonPasture, { palette: ['orange'] },   'Mask sem pasto',   false);
Map.addLayer(maskProdes2000, { palette: ['red'] },      'PRODES 2000',      false);
Map.addLayer(baseProdesMask, { palette: ['darkred'] },  'Base PRODES mask', false);


// ======================================================================
// LOOP POR ANO
// ======================================================================
for (var i = 0; i < anos.length; i++) {
  var ano   = anos[i];
  var banda = 'classification_' + ano;
  var cls   = imgEntrada.select(banda);

  // -- RULE A: no-pasture mask adjusted by PRODES up to this year --------
  //
  // Year by year, drop from the mask the areas where PRODES has since recorded
  // clearing: there the conversion is real and pasture is legitimate.
  //
  // Result: the "no pasture" area with no PRODES record up to this year
  //
  var incProdes = PRODES_INC
    .filter(ee.Filter.lte('year', ano))
    .reduceToImage(['year'], 'mean')
    .neq(0).remap([1], [100], 0).toByte().selfMask();

  // incProdes entra com valor 100 -> o blend coloca 100 sobre o baseProdesMask (=1)
  // and .eq(1) drops the areas with a PRODES increment
  var maskAno = baseProdesMask.blend(incProdes).eq(1).selfMask();

  // Where the mask applies its value is 100, which is added to the class
  // so masked pixels carry class + 100
  // The remap only touches the class+100 values; the blend with cls preserves
  // restaura os demais pixels ao valor original.
  var regA = cls
    .add(maskAno.remap([1], [100]))
    .remap(
      // Original class plus 100, inside the mask
      [103, 104, 107, 111, 112, 119, 121, 125, 129, 133],
      // Correction:
      //  21 -> 12  (pasture in a no-pasture area becomes grassland)
      //  19 -> 12  (cropland in a no-pasture area becomes grassland)
      //  3,4,7,11,12,25,29,33 -> permanecem
      [  3,   4,   7,  11,  12,  12,  12,  25,  29,  33]
    ).rename(banda);

  // Only the pixels inside the mask carry a value in regA; the rest stays masked
  cls = cls.blend(regA);

  // -- REGRA B: Alertas MapBiomas - janela deslizante de ALERT_WINDOW anos --
  //
  // The pixel is held as pasture for ALERT_WINDOW years from the detection year.
  // After that the original value applies again, since the pixel may have
  // regrown or the classifier may have improved there.
  //
  // Janela ativa: [ano - (ALERT_WINDOW-1), ano]
  //
  // Exemplos com ALERT_WINDOW = 4:
  //   2020 -> window [2019, 2020]; alerts only start in 2019
  //   2022 -> window [2019, 2022], the full four years
  //   ano 2023 -> janela [2020, 2023]  -> alerta de 2019 sai da janela
  //   ano 2025 -> janela [2022, 2025]  -> alertas 2019-2021 liberados
  //
  if (ano >= 2019) {
    var anoInicioJanela = Math.max(2019, ano - (ALERT_WINDOW - 1));

    var alertsMask = ALERTS
      .filter(ee.Filter.gte('ANODETEC', anoInicioJanela))
      .filter(ee.Filter.lte('ANODETEC', ano))
      .reduceToImage(['ANODETEC'], 'mean')
      .neq(0).remap([1], [100]).toByte().selfMask();

    var regB = cls
      .add(alertsMask)
      .remap(
        // Original class plus 100, inside the alert footprint
        [103, 104, 107, 111, 112, 119, 121, 125, 129, 133],
        // Everything becomes pasture except water (33)
        [ 21,  21,  21,  11,  21,  21,  21,  21,  21,  33]
      ).rename(banda);

    // Blend: pixels dentro do alerta usam regB; demais usam cls atual
    cls = cls.blend(regB);
  }

  cls = cls.rename(banda);

  if (i === 0) { var outFinal = cls; }
  else { outFinal = outFinal.addBands(cls); }
}

print('Final result - masks applied', outFinal);


// ======================================================================
// VISUAL CHECK (uncomment as needed)
// ======================================================================
for (var i = 0; i < anos.length; i++) {
  var ano = anos[i];
   Map.addLayer(imgEntrada.select('classification_' + ano), vis, 'Entrada ' + ano, false);
   Map.addLayer(outFinal.select('classification_'   + ano), vis, 'Output '  + ano, false);
}


// ======================================================================
// EXPORT - one task per year, run in parallel
// ======================================================================
var version_out = '7';
var dirout      = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/';
var prefixo_out = 'PANT_col4_Anual_sp_filter_';

  Export.image.toAsset({
    image: outFinal.toByte()
      .set('territory',    'BRAZIL')
      .set('biome',        'PANTANAL')
      .set('source',       'arcplan')
      .set('version',      version_out)
      .set('year',         version_out)
      .set('collection_id', 4.0)
      .set('description',  'msk asset final'),
    description:      prefixo_out + version_out,
    assetId:          dirout + prefixo_out + version_out,
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
