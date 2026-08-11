/**
 * ==============================================================================
 * p04 | Trajectory filter
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Corrects classes from how a pixel behaves across the whole series rather than
 *   from what it looks like in any single year.
 *   
 *   Three metrics, precomputed and stored as assets, drive the first stage: the
 *   trajectory code, the number of years the class is present, and how many times
 *   the pixel changes class. Pasture whose trajectory is coded unstable and which
 *   appears in only a few years is not pasture; it is grassland the model misread.
 *   
 *   The remaining stages work on the end of the series, where there is no later
 *   year to check against: a class that persisted through 2023 and 2024 may only
 *   continue, or convert to pasture or non-vegetated, in 2025; and new pasture in
 *   2025 has to be corroborated by Landsat Collection 11 to survive.
 *
 * INPUTS
 *   - PANT_col4_Anual_temp_filter_3 (from p03)
 *   - c4_trajectories_21_v1, c4_number_of_presence_21_v1,
 *     c4_number_of_changes_21_v1, c4_number_of_presence_25_v1
 *   - PANT_col11_Anual_v39 (Landsat Collection 11, for the 2025 check)
 *
 * OUTPUTS
 *   - PANT_col4_Anual_traj_filter_{version_out} (one band per year, 2017-2025)
 *
 * NOTES
 *   - Trajectory code 6 marks an unstable series.
 *   - The trajectory metrics must be regenerated whenever the input version
 *     changes, or the filter is applied against a stale series.
 *
 * PIPELINE
 *   p03 post-classification | step 4 of 7  ->  p05_pasture_wetland_filter
 * ==============================================================================
 */

var roi = ee.FeatureCollection('projects/ee-arcplan-df/assets/col11/regions_buffer')
var anos = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

var imgEntrada = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/PANT_col4_Anual_temp_filter_3')


//=======================================================================
// FILTER 1 - TRAJECTORY, PRESENCE AND CHANGE COUNT (classes 21 and 25)
//=======================================================================
// Regras:
//  a) pasture trajectory 6 and present in fewer than 3 years -> 21 becomes 12
//  b) pasture trajectory 6 and more than 3 class changes     -> 21 becomes 12
//  c) pasture trajectory 6 and present in exactly 1 year     -> 21 becomes 12
//  d) non-vegetated present in fewer than 3 years            -> 25 becomes 21

var dirTraj = 'projects/mapbiomas-workspace/AMOSTRAS/S2_EMBEDDING/PANTANAL/trajectories/';

var trajPast21  = ee.Image(dirTraj + 'c4_trajectories_21_v1');
var nPresPast21 = ee.Image(dirTraj + 'c4_number_of_presence_21_v1');
var nMudPast21  = ee.Image(dirTraj + 'c4_number_of_changes_21_v1');
var nPresNveg25 = ee.Image(dirTraj + 'c4_number_of_presence_25_v1');

var trajPast21eq6    = trajPast21.eq(6);
var presPast21menor3 = nPresPast21.lt(3);
var mudPast21maior3  = nMudPast21.gt(3);
var presPast21igual1 = nPresPast21.eq(1);
var presNveg25menor3 = nPresNveg25.lt(3);

// trajectory 6 and (presence < 3 or changes > 3 or presence == 1) -> 12
var cond21para12 = trajPast21eq6.and(
                      presPast21menor3.or(mudPast21maior3).or(presPast21igual1)
                    );

// non-vegetated presence below 3 -> 21
var cond25para21 = presNveg25menor3;

for (var i_ano = 0; i_ano < anos.length; i_ano++) {
  var ano = anos[i_ano];
  var banda = 'classification_' + ano;
  var classeAno = imgEntrada.select(banda);

  var corrigida = classeAno
        .where(classeAno.eq(21).and(cond21para12), 12)
        .where(classeAno.eq(25).and(cond25para21), 21)
        .rename(banda);

  if (i_ano === 0) { var filtro1 = corrigida; }
  else { filtro1 = filtro1.addBands(corrigida); }
}

print('Filter 1 - trajectory, classes 21 and 25', filtro1);


//=======================================================================
// FILTER 2 - PERSISTENCE THROUGH 2023-2024 CONSTRAINS 2025
//=======================================================================
// A class present in both 2023 and 2024 may only persist in 2025, or convert to
// pasture (21) or non-vegetated (25). Anything else in 2025 is treated as noise
// and reverted to the persistent class. Applied to classes 3, 4 and 12.
// classe persistente. Aplicado para as classes 3, 4 e 12.

var corrigeUltimoAno = function (imagem, classe) {
  var c2023 = imagem.select('classification_2023');
  var c2024 = imagem.select('classification_2024');
  var c2025 = imagem.select('classification_2025');

  var persistente   = c2023.eq(classe).and(c2024.eq(classe));
  var foraPermitido = c2025.neq(classe).and(c2025.neq(21)).and(c2025.neq(25));
  var corrigir       = persistente.and(foraPermitido);

  var c2025corrigido = c2025.where(corrigir, classe).rename('classification_2025');

  // sobrescreve a banda 2025, mantendo as demais bandas intactas
  return imagem.addBands(c2025corrigido, null, true);
};

var filtro2 = corrigeUltimoAno(filtro1, 3);   // Floresta
    filtro2 = corrigeUltimoAno(filtro2, 4);   // Savana
    filtro2 = corrigeUltimoAno(filtro2, 12);  // Campestre

print('Filter 2 - 2023-2024 persistence constrains 2025', filtro2);


//=======================================================================
// FILTER 3 - THREE-YEAR MOVING WINDOW
//=======================================================================
// If the middle year differs from the year before and the year after, which match
// each other and the target class, the middle year takes the previous value.
// the middle year takes the previous value. Applied class by class, iteratively,
// over 2018-2024; the edge years are excluded for lack of a neighbour.
// The first and last years are excluded: they have no neighbour on one side.

var anosJanela = ee.List.sequence(2018, 2024).map(function (y) {
  return ee.Number(y).int();
});

var janela3anos = function (imagem, classe) {
  var classWind = ee.ImageCollection(anosJanela.map(function (ano) {
    ano = ee.Number(ano);
    var anoStr   = ano.format();
    var nomeBanda = ee.String('classification_').cat(anoStr);

    var classAno  = imagem.select(nomeBanda);
    var classPrev = imagem.select(ee.String('classification_').cat(ano.subtract(1).format()));
    var classNext = imagem.select(ee.String('classification_').cat(ano.add(1).format()));

    var mask_3 = classNext.eq(classe)
                  .and(classAno.neq(classe))
                  .and(classPrev.eq(classe));

    var corrigida = classPrev.updateMask(mask_3);
    var classCorr = classAno.blend(corrigida.rename(nomeBanda));

    return classCorr;
  })).toBands();

  var n = anosJanela.size();
  var ultimo = ee.Number(anosJanela.get(n.subtract(1))).add(1);

  var classPrimeiro = imagem.select('classification_2017').rename('00_classification_2017');
  var classUltimo   = imagem.select(ee.String('classification_').cat(ultimo))
                            .rename(ee.String('00_classification_').cat(ultimo));

  var classFinal = classPrimeiro.addBands(classWind).addBands(classUltimo);

  var corrigeNomes = function (img) {
    var nomesAtuais = img.bandNames();
    var nomesNovos = nomesAtuais.map(function (nome) {
      return ee.String(nome).split('_').slice(1).join('_');
    });
    return img.select(nomesAtuais, nomesNovos);
  };

  return corrigeNomes(classFinal);
};

// Adjust the class list as needed
var filtro3 = janela3anos(filtro2, 19);
    filtro3 = janela3anos(filtro3, 21);
    filtro3 = janela3anos(filtro3, 4);
    filtro3 = janela3anos(filtro3, 12);
    filtro3 = janela3anos(filtro3, 3);

print('Filter 3 - three-year moving window', filtro3);


//=======================================================================
// FILTER 4 - 2025 PASTURE MUST BE CORROBORATED BY COLLECTION 11
//=======================================================================
// A pixel that was never pasture between 2017 and 2024 may only be pasture in
// 2025 if Collection 11 agrees. Otherwise 2025 reverts to its 2024 value.
// Change the fallback here if a different reversion rule is wanted.

var colecao11_2025 = ee.Image('projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/classification-pan-ft/PANT_col11_Anual_v39')
                        .select('classification_2025');

var somaPresenca21 = ee.Image(0);
anos.filter(function (a) { return a < 2025; }).forEach(function (ano) {
  somaPresenca21 = somaPresenca21.add(filtro3.select('classification_' + ano).eq(21));
});
var nuncaFoi21 = somaPresenca21.eq(0);

var c2025 = filtro3.select('classification_2025');
var c2024 = filtro3.select('classification_2024');

var deveReverter = c2025.eq(21).and(nuncaFoi21).and(colecao11_2025.neq(21));

var c2025final = c2025.where(deveReverter, c2024).rename('classification_2025');

var filtro4 = filtro3.addBands(c2025final, null, true);

print('Filter 4 - 2025 pasture checked against Collection 11', filtro4);


//=======================================================================
// FINAL OUTPUT
//=======================================================================
var outotalFiltrosTrajetoria = filtro4;

print('Final result - trajectory filters', outotalFiltrosTrajetoria);
var palettes = require('users/mapbiomas/modules:Palettes.js');
var vis = {
    'min': 0,
    'max': 62,
    'palette': palettes.get('classification8')
};
// Optional visual check, reusing the palette defined above
 for (var i_ano = 0; i_ano < anos.length; i_ano++) {
   var ano = anos[i_ano];
   Map.addLayer(imgEntrada.select('classification_' + ano), vis, 'Img Entrada ' + ano, false);

   Map.addLayer(outotalFiltrosTrajetoria.select('classification_' + ano), vis, 'Trajectory filter ' + ano, false);
 //  Map.addLayer(filtro4.select('classification_' + ano), vis, ' filtro4 ' + ano, false);

 }

// =============================================================================
// EXPORT
// =============================================================================
var vesion_in   = '3';
var version_out = '4';
var descricao   = 'Filtro trrajetorias';
var col         = 4.0;
var prefixo_out = 'PANT_col4_Anual_traj_filter_';
var dirout      = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/';
//projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/GENERAL/classification-pan-ft/PANT_col4_Anual_moda_filter_
var finalOutput = outotalFiltrosTrajetoria
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
  region:           roi
});

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias - ArcPlan - mariana@arcplan.com.br
 * MapBiomas Collection 4 (10 m) | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
