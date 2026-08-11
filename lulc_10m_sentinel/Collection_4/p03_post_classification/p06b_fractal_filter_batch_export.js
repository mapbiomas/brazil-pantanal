/**
 * ==============================================================================
 * p06b | Fractal filter, batched export (optional)
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Alternative to the fractal filter stage of p06, for when that script exceeds
 *   the Earth Engine time limit.
 *   
 *   Instead of building the whole chain lazily and exporting one image, this reads
 *   an already-materialised asset and queues one task per year, so the graph each
 *   task has to evaluate starts small. Option B in the file splits further, into
 *   quadrants, which cuts the cost of connectedComponents by roughly four.
 *   
 *   The filter itself is identical to the one in p06.
 *
 * INPUTS
 *   - A materialised asset of the preceding step
 *
 * OUTPUTS
 *   - PANT_col4_Anual_df_filter_{version_out}_{year} (one asset per year)
 *
 * NOTES
 *   - Both export blocks ship commented out: uncomment the one you want.
 *   - The input asset in this file points at a development lineage
 *     (PANT_step2_filtro_anual_v6); repoint it before running.
 *
 * PIPELINE
 *   p03 post-classification | optional variant of step 6
 * ==============================================================================
 */

var roi  = ee.FeatureCollection('projects/ee-arcplan-df/assets/col11/regions_buffer');
var anos = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

var AREA_THRESHOLD_HA     = 5;
var AREA_THRESHOLD_M2     = AREA_THRESHOLD_HA * 10000;
var FD_THRESHOLD          = 1.35;
var AREA_THRESHOLD_PIXELS = Math.round(AREA_THRESHOLD_M2 / 100); // 500 px a 10m
var MAX_PIXELS_PATCH      = Math.round(AREA_THRESHOLD_PIXELS * 1.2); // 600 px

// Materialised result of the previous step: the graph starts here, so it stays light
var step2 = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/PANT_step2_filtro_anual_v6');


var applyFractalFilter21 = function (image, banda) {
  var patchMask    = image.eq(21);
  var weights      = [[0,1,0],[1,0,1],[0,1,0]];
  var kernel       = ee.Kernel.fixed({ width: 3, height: 3, weights: weights });
  var exposedEdges = ee.Image(4).subtract(patchMask.convolve(kernel)).multiply(patchMask);
  var pixelSide    = ee.Image.pixelArea().sqrt();
  var pixelPerim   = exposedEdges.multiply(pixelSide).rename('perimeter');
  var patchOnly    = patchMask.selfMask();
  var patchIds     = patchOnly.connectedComponents({
    connectedness: ee.Kernel.square(1), maxSize: MAX_PIXELS_PATCH
  }).select('labels');
  var pixelArea  = ee.Image.pixelArea().updateMask(patchOnly).rename('area');
  var patchArea  = pixelArea.addBands(patchIds).reduceConnectedComponents({
    reducer: ee.Reducer.sum(), labelBand: 'labels', maxSize: MAX_PIXELS_PATCH
  });
  var patchPerim2 = pixelPerim.updateMask(patchOnly).addBands(patchIds).reduceConnectedComponents({
    reducer: ee.Reducer.sum(), labelBand: 'labels', maxSize: MAX_PIXELS_PATCH
  });
  var fd = ee.Image(2).multiply(patchPerim2.log()).divide(patchArea.log()).rename('fd');
  return image.where(patchArea.lt(AREA_THRESHOLD_M2).and(fd.gt(FD_THRESHOLD)), 12).rename(banda);
};

var version_out = '6';
var dirout      = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/';
var prefixo_out = 'PANT_col4_Anual_df_filter_';

// -- OPTION A (default): one task per year, nine tasks in parallel -----------
//for (var i = 0; i < anos.length; i++) {
//  var ano   = anos[i];
//  var banda = 'classification_' + ano;
//  var corrigida = applyFractalFilter21(step2.select(banda), banda);
//
//  Export.image.toAsset({
//    image:            corrigida.toByte()
//                        .set('territory','BRAZIL').set('biome','PANTANAL')
//                        .set('source','arcplan').set('version',version_out)
//                        .set('year', ano).set('collection_id', 4.0)
//                        .set('description','Filtro fractal'),
//    description:      prefixo_out + version_out + '_' + ano,
//    assetId:          dirout + prefixo_out + version_out + '_' + ano,
//    scale:            10,
//    pyramidingPolicy: { '.default': 'mode' },
//    maxPixels:        1e13,
//    region:           roi
//  });
//}

// -- OPTION B: split the ROI into four quadrants (36 tasks, roughly 4x faster)
// Uncomment this block and comment out option A above.
//
 var bounds  = roi.geometry().bounds();
 var coords  = ee.List(bounds.coordinates().get(0));
 var xmin    = ee.Number(ee.List(coords.get(0)).get(0));
 var ymin    = ee.Number(ee.List(coords.get(0)).get(1));
 var xmax    = ee.Number(ee.List(coords.get(2)).get(0));
 var ymax    = ee.Number(ee.List(coords.get(2)).get(1));
 var xmid    = xmin.add(xmax).divide(2);
 var ymid    = ymin.add(ymax).divide(2);

 var quadrantes = [
   { nome: 'SW', geom: ee.Geometry.Rectangle([xmin, ymin, xmid, ymid]) },
   { nome: 'SE', geom: ee.Geometry.Rectangle([xmid, ymin, xmax, ymid]) },
   { nome: 'NW', geom: ee.Geometry.Rectangle([xmin, ymid, xmid, ymax]) },
   { nome: 'NE', geom: ee.Geometry.Rectangle([xmid, ymid, xmax, ymax]) }
 ];

 for (var i = 0; i < anos.length; i++) {
   var ano   = anos[i];
   var banda = 'classification_' + ano;
   var corrigida = applyFractalFilter21(step2.select(banda), banda);

   for (var q = 0; q < quadrantes.length; q++) {
     var quad = quadrantes[q];
     Export.image.toAsset({
       image:       corrigida.clip(quad.geom).toByte(),
       description: prefixo_out + version_out + '_' + ano + '_' + quad.nome,
       assetId:     dirout + prefixo_out + version_out + '_' + ano + '_' + quad.nome,
       scale:       10,
       pyramidingPolicy: { '.default': 'mode' },
       maxPixels:   1e13,
       region:      quad.geom
     });
   }
 }

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias - ArcPlan - mariana@arcplan.com.br
 * MapBiomas Collection 4 (10 m) | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
