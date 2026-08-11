/**
 * ==============================================================================
 * p05 | Feature importance and band selection
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Diagnostic step, not part of the production chain.
 *   
 *   Trains a Random Forest on the full ~170-band stack for every region and year,
 *   then reads the variable importance the model reports and exports it as a CSV.
 *   
 *   The result is used to choose the bands each region actually classifies on.
 *   Every region keeps the whole 64-band embedding block plus the two coordinate
 *   bands, and adds the fifty spectral and terrain bands that ranked highest
 *   there, which lets each region weight its own drivers: elevation and roughness
 *   in the plateau regions, red-edge and water indices in the floodplain ones.
 *   
 *   The selected lists are kept at the bottom of the file as top50BandsPorRegiao.
 *
 * INPUTS
 *   - pontos_trained_stable91011_cleaned_v2_reg{N}_trained (from p04)
 *
 * OUTPUTS
 *   - feature_importance_mapbiomas.csv (Google Drive)
 *
 * PIPELINE
 *   p01 samples | step 5 of 5 (diagnostic)  ->  informs p02_classification
 * ==============================================================================
 */

// ==============================================================================
// 1. PARAMETERS
// ==============================================================================
var regions = [0, 1, 2, 3, 4, 5, 6, 7, 8];
var anos = [2017,2018,2019,2020,2021,2022,2023,2024, 2025]
var bandNames =
["afvi_median","afvi_median_dry","afvi_median_wet","aspect","avi_median","avi_median_dry",
"avi_median_wet","blue_median","blue_median_dry","blue_median_wet","blue_stdDev","brba_median","brba_median_dry",
"brba_median_wet","brightness_median","brightness_median_dry","brightness_median_wet","bsi_median",
"bsi_median_dry","bsi_median_wet","cai_median","cai_median_dry","cai_median_wet","convergence",
"cti","cvi_median","cvi_median_dry","cvi_median_wet","dswi5_median","dswi5_median_dry","dswi5_median_wet",
"dxx","eastness","evi2_median","evi2_median_dry","evi2_median_wet","evi_median","evi_median_dry",
"evi_median_wet","gari_median","gari_median_dry","gari_median_wet","gcvi_median","gcvi_median_dry",
"gcvi_median_wet","gli_median","gli_median_dry","gli_median_wet","green_median","green_median_dry",
"green_median_texture","green_median_wet","green_min","green_stdDev","grnd_median","grnd_median_dry",
"grnd_median_wet","gvmi_median","gvmi_median_1","gvmi_median_dry","gvmi_median_dry_1","gvmi_median_wet",
"gvmi_median_wet_1","hallcover_median","hallcover_median_dry","hallcover_median_wet","hallheight_median",
"hallheight_median_dry","hallheight_median_wet","iia_median","iia_median_dry","iia_median_wet","ireci_median",
"ireci_median_dry","ireci_median_wet","lai_median","lswi_median","lswi_median_dry","lswi_median_wet",
"mbi_median","mbi_median_dry","mbi_median_wet","merit_dem","mndwi_median","mndwi_median_dry",
"mndwi_median_wet","msavi_median","msavi_median_dry","msavi_median_wet","msi_median","msi_median_dry",
"msi_median_wet","nbr_median","nbr_median_dry","nbr_median_wet","ndci_median","ndci_median_dry",
"ndci_median_wet","nddi_median","nddi_median_dry","nddi_median_wet","ndviRed_median","ndviRed_median_dry",
"ndviRed_median_wet","ndvi_median","ndvi_median_dry","ndvi_median_wet","ndwi_median","ndwi_median_dry",
"ndwi_median_wet","nir_median","nir_median_contrast","nir_median_dry","nir_median_dry_contrast",
"nir_median_wet","nir_stdDev","northness","osavi_median","osavi_median_dry","osavi_median_wet",
"red_edge_1_median","red_edge_1_median_dry","red_edge_1_median_wet","red_edge_1_stdDev","red_edge_2_median",
"red_edge_2_median_dry","red_edge_2_median_wet","red_edge_2_stdDev","red_edge_3_median","red_edge_3_median_dry",
"red_edge_3_median_wet","red_edge_3_stdDev","red_edge_4_median","red_edge_4_median_dry","red_edge_4_median_wet",
"red_edge_4_stdDev","red_median","red_median_contrast","red_median_dry","red_median_dry_contrast","red_median_wet",
"red_min","red_stdDev","roughness","rvi_median","rvi_median_dry","rvi_median_wet","sfdvi_median","sfdvi_median_dry",
"sfdvi_median_wet","spri_median","spri_median_dry","spri_median_wet","swir1_median","swir1_median_dry",
"swir1_median_wet","swir1_stdDev","swir2_median","swir2_median_dry","swir2_median_wet","swir2_stdDev",
"tgsi_median","tgsi_median_dry","tgsi_median_wet","ui_median","ui_median_dry","ui_median_wet",
"wetness_median","wetness_median_dry","wetness_median_wet" ]
// ==============================================================================
// 2. TRAIN ONE MODEL PER REGION AND YEAR, THEN READ ITS VARIABLE IMPORTANCE
// ==============================================================================

// Client-side accumulator for the server-side feature lists.
var listaDeRecursos = [];

// The asset path has to be built in plain JavaScript, so the loops are client-side.
regions.forEach(function(regiao) {
  anos.forEach(function(ano) {

    var assetPath = 'projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/SAMPLES/PANTANAL/trained/pontos_trained_stable91011_cleaned_v2_reg' + regiao + '_trained'

    var amostras = ee.FeatureCollection(assetPath).filter(ee.Filter.eq('year', ano));

    var classifier = ee.Classifier.smileRandomForest(150, 1)
        .train(amostras, 'reference', bandNames);

    var importancia = ee.Dictionary(classifier.explain().get('importance'));

    // Turn the importance dictionary into features (evaluated server-side).
    var featuresBanda = importancia.map(function(banda, valor) {
      return ee.Feature(null, {
        'Regiao': 'reg'+regiao,
        'Ano': ano,
        'Banda': banda,
        'Importancia': valor
      });
    }).values(); // Returns an ee.List

    listaDeRecursos.push(featuresBanda);
  });
});

// Flatten the client-side array into a single FeatureCollection.
var dadosImportancia = ee.FeatureCollection(ee.List(listaDeRecursos).flatten());

// ==============================================================================
// 3. EXPORT
// ==============================================================================
Export.table.toDrive({
  collection: dadosImportancia,
  description: 'feature_importance_mapbiomas',
  fileFormat: 'CSV'
});


// ==============================================================================
// 4. SELECTED BANDS PER REGION
// ------------------------------------------------------------------------------
// Result of the run above. Every region keeps the full 64-band embedding block and
// both coordinate bands, then adds the fifty spectral and terrain bands that
// mattered most there. These lists are what feeds bandNamesList in the p02
// classification scripts, and are kept here so the selection stays traceable.
// ==============================================================================

var top50BandsPorRegiao = {
  0: [
      'A00','A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22',
      'A23','A24','A25','A26','A27','A28','A29','A30','A31','A32','A33','A34','A35','A36','A37','A38','A39','A40','A41','A42','A43','A44','A45',
      'A46','A47','A48','A49','A50','A51','A52','A53','A54','A55','A56','A57','A58','A59','A60','A61','A62','A63',
      'latitude','longitude',
      'red_edge_1_median','roughness','merit_dem','spri_median_wet','spri_median','ndci_median_wet','hallheight_median','tgsi_median_dry','ireci_median_wet',
      'tgsi_median','red_edge_2_median','red_edge_1_median_dry','brightness_median_wet','red_edge_2_median_dry','iia_median_wet','gari_median_wet',
      'green_median','red_edge_1_median_wet','red_edge_4_median_wet','red_edge_3_median_dry','red_median','red_edge_3_median_wet','ireci_median',
      'spri_median_dry','mndwi_median_wet','cvi_median_wet','hallcover_median_wet','ui_median','gcvi_median_wet','osavi_median_wet','gvmi_median_wet',
      'tgsi_median_wet','brightness_median','red_edge_2_median_wet','bsi_median_dry','gari_median','brba_median_wet','sfdvi_median','swir1_median',
      'hallheight_median_dry','cvi_median','green_median_wet','iia_median','grnd_median_dry','osavi_median','sfdvi_median_wet','nir_median_wet',
      'mndwi_median','cvi_median_dry','swir2_median_wet',
  ],
  1: [
      'A00','A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22',
      'A23','A24','A25','A26','A27','A28','A29','A30','A31','A32','A33','A34','A35','A36','A37','A38','A39','A40','A41','A42','A43','A44','A45',
      'A46','A47','A48','A49','A50','A51','A52','A53','A54','A55','A56','A57','A58','A59','A60','A61','A62','A63',
      'latitude','longitude',
      'roughness','red_edge_1_median','merit_dem','hallheight_median_dry','brightness_median_dry','red_edge_1_median_dry','tgsi_median_wet','gari_median_wet',
      'gcvi_median_wet','tgsi_median_dry','wetness_median_dry','nir_median_dry','red_edge_2_median_dry','ireci_median_wet','spri_median','wetness_median',
      'swir1_median_dry','tgsi_median','hallheight_median','red_edge_4_median_dry','cvi_median_dry','avi_median_dry','evi2_median_wet','green_median_wet',
      'red_edge_3_median','red_median_wet','red_median_dry','ndci_median_wet','iia_median_wet','red_edge_2_median','green_median_dry','red_median',
      'green_median','msavi_median_wet','red_edge_1_median_wet','red_edge_4_median','avi_median','osavi_median_wet','swir2_median','ireci_median',
      'cvi_median','gari_median','sfdvi_median_wet','nir_median','hallcover_median_dry','red_edge_3_median_dry','swir1_stdDev','swir2_median_dry',
      'grnd_median_dry','evi_median',

  ],
  2: [
      'A00','A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22',
      'A23','A24','A25','A26','A27','A28','A29','A30','A31','A32','A33','A34','A35','A36','A37','A38','A39','A40','A41','A42','A43','A44','A45',
      'A46','A47','A48','A49','A50','A51','A52','A53','A54','A55','A56','A57','A58','A59','A60','A61','A62','A63',
      'latitude','longitude',
      'red_edge_2_median','red_edge_1_median','merit_dem','red_edge_4_median_dry','swir2_median','hallheight_median','swir1_median_dry','wetness_median',
      'red_edge_3_median_dry','brightness_median_dry','red_edge_2_median_dry','hallheight_median_dry','swir1_median','nir_median_dry','wetness_median_dry',
      'ireci_median_wet','red_edge_4_median','red_edge_2_median_wet','afvi_median_dry','brightness_median_wet','tgsi_median_wet','lai_median',
      'hallcover_median','red_edge_4_median_wet','cvi_median','ndci_median_wet','mbi_median_wet','swir1_median_wet','red_median_wet','bsi_median',
      'hallcover_median_dry','avi_median','red_edge_3_median_wet','sfdvi_median_wet','gvmi_median_1','msi_median_dry','tgsi_median_dry','brightness_median',
      'evi2_median_wet','wetness_median_wet','nbr_median_dry','iia_median','dswi5_median','evi_median_dry','evi_median_wet','gvmi_median_wet_1',
      'hallcover_median_wet','gcvi_median_wet','mbi_median','tgsi_median',
  ],
  3: [
      'A00','A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22',
      'A23','A24','A25','A26','A27','A28','A29','A30','A31','A32','A33','A34','A35','A36','A37','A38','A39','A40','A41','A42','A43','A44','A45',
      'A46','A47','A48','A49','A50','A51','A52','A53','A54','A55','A56','A57','A58','A59','A60','A61','A62','A63',
      'latitude','longitude',
      'red_edge_1_median','red_edge_1_median_wet','wetness_median','green_median','spri_median','hallheight_median','swir1_median','ndci_median_wet',
      'swir1_median_dry','merit_dem','swir2_median','brightness_median_dry','ireci_median_wet','red_edge_1_median_dry','hallcover_median',
      'tgsi_median_wet','gcvi_median_wet','gari_median_wet','avi_median_wet','evi_median_wet','avi_median','spri_median_wet','red_edge_2_median_wet',
      'swir2_median_dry','wetness_median_dry','gvmi_median_wet_1','red_edge_4_median','gari_median','red_edge_2_median','red_edge_1_stdDev',
      'red_edge_2_median_dry','green_median_wet','red_edge_3_median','gli_median','gli_median_wet','osavi_median_wet','brightness_median','evi2_median_wet',
      'wetness_median_wet','gcvi_median','red_edge_4_median_wet','avi_median_dry','hallcover_median_wet','bsi_median_wet','rvi_median','iia_median_wet',
      'red_median','ireci_median','brba_median_dry','tgsi_median',
      ],
  4: [
      'A00','A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22',
      'A23','A24','A25','A26','A27','A28','A29','A30','A31','A32','A33','A34','A35','A36','A37','A38','A39','A40','A41','A42','A43','A44','A45',
      'A46','A47','A48','A49','A50','A51','A52','A53','A54','A55','A56','A57','A58','A59','A60','A61','A62','A63',
      'latitude','longitude',
      'red_edge_3_median_wet','merit_dem','red_edge_1_median','ndci_median_wet','tgsi_median','red_edge_2_median_wet','ireci_median_wet','gari_median_wet',
      'tgsi_median_wet','roughness','red_edge_4_median','iia_median_wet','spri_median_dry','cvi_median_wet','green_median','msavi_median_wet',
      'red_edge_4_median_wet','brightness_median_wet','evi_median_wet','iia_median','ndvi_median_wet','evi2_median_wet','hallheight_median','spri_median',
      'spri_median_wet','avi_median','wetness_median','cvi_median','red_edge_1_median_wet','red_edge_2_median','swir1_median','hallcover_median_wet',
      'red_median_wet','red_median','rvi_median_wet','brba_median_wet','ireci_median','red_edge_3_median','hallcover_median_dry','osavi_median_wet',
      'cai_median_wet','gcvi_median_wet','nir_median_dry','lswi_median_wet','red_edge_3_median_dry','avi_median_dry','avi_median_wet','sfdvi_median_wet',
      'gcvi_median','hallheight_median_wet',
     ],
  5: ['A00','A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22',
      'A23','A24','A25','A26','A27','A28','A29','A30','A31','A32','A33','A34','A35','A36','A37','A38','A39','A40','A41','A42','A43','A44','A45',
      'A46','A47','A48','A49','A50','A51','A52','A53','A54','A55','A56','A57','A58','A59','A60','A61','A62','A63',
      'latitude','longitude',
      'ndci_median_wet','red_edge_1_median_wet','green_median','red_edge_1_median','tgsi_median_wet','gari_median_wet','red_edge_1_median_dry',
      'ireci_median_wet','spri_median_wet','brightness_median','iia_median_wet','avi_median_wet','brba_median_wet','tgsi_median','spri_median',
      'mndwi_median_wet','swir2_median','red_edge_4_median_wet','swir2_median_dry','green_median_wet','wetness_median','cvi_median_wet',
      'brightness_median_dry','red_edge_3_median','ndviRed_median_wet','gari_median','tgsi_median_dry','osavi_median','red_edge_2_median',
      'red_edge_3_median_wet','cai_median','gcvi_median_wet','ireci_median','lswi_median_wet','red_edge_4_median','hallcover_median',
      'ndwi_median_dry','evi_median_wet','blue_median','ndvi_median_wet','swir1_median_dry','hallheight_median_dry','mbi_median_wet',
      'mndwi_median','bsi_median_wet','brightness_median_wet','hallcover_median_wet','red_edge_2_median_dry','nir_median','iia_median',
      ],
  6: [
      'A00','A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22',
      'A23','A24','A25','A26','A27','A28','A29','A30','A31','A32','A33','A34','A35','A36','A37','A38','A39','A40','A41','A42','A43','A44','A45',
      'A46','A47','A48','A49','A50','A51','A52','A53','A54','A55','A56','A57','A58','A59','A60','A61','A62','A63',
      'latitude','longitude',
      'roughness','merit_dem','ireci_median_wet','ndci_median_wet','msavi_median_wet','tgsi_median_wet','gari_median_wet','iia_median_wet',
      'tgsi_median','gari_median','swir2_median','ndci_median','ui_median_wet','gcvi_median_wet','mndwi_median_dry','red_edge_2_median_wet',
      'green_median','grnd_median','red_edge_1_median','brba_median_wet','hallheight_median','evi2_median','spri_median','ndwi_median',
      'osavi_median_wet','nbr_median_wet','cai_median_wet','red_edge_4_median_dry','nir_median','red_median_wet','red_edge_4_median',
      'evi2_median_wet','red_edge_1_median_dry','ndvi_median_wet','hallcover_median_dry','cvi_median_dry','iia_median','swir1_median',
      'brightness_median','red_edge_3_median','sfdvi_median_wet','gcvi_median','ndvi_median','cai_median','ireci_median','nddi_median_dry',
      'red_edge_2_median_dry','evi_median_wet','brba_median','avi_median_wet',
      ],
  7: [
      'A00','A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22',
      'A23','A24','A25','A26','A27','A28','A29','A30','A31','A32','A33','A34','A35','A36','A37','A38','A39','A40','A41','A42','A43','A44','A45',
      'A46','A47','A48','A49','A50','A51','A52','A53','A54','A55','A56','A57','A58','A59','A60','A61','A62','A63',
      'latitude','longitude',
      'merit_dem','roughness','ireci_median_wet','iia_median_wet','gcvi_median_wet','osavi_median_wet','gari_median_wet','cai_median_wet',
      'ndci_median_wet','cvi_median_wet','ndwi_median_wet','cai_median','hallcover_median_dry','evi2_median_wet','avi_median','green_median_wet',
      'swir1_median_dry','brightness_median_wet','sfdvi_median_wet','red_edge_2_median_wet','hallcover_median_wet','gvmi_median_wet_1',
      'red_edge_4_median','nbr_median_wet','ndvi_median_wet','ui_median_wet','green_median','spri_median','nir_median_wet','red_median_wet',
      'red_edge_3_median_dry','mbi_median_dry','tgsi_median','red_edge_4_median_wet','ndvi_median','tgsi_median_wet','rvi_median_wet',
      'red_edge_1_median_wet','hallheight_median_dry','iia_median','gari_median','brba_median_wet','cai_median_dry','swir1_median','mbi_median_wet',
      'ndviRed_median_wet','red_median_dry','red_edge_1_median','avi_median_wet','mndwi_median',
      ],
  8: [
      'A00','A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A17','A18','A19','A20','A21','A22',
      'A23','A24','A25','A26','A27','A28','A29','A30','A31','A32','A33','A34','A35','A36','A37','A38','A39','A40','A41','A42','A43','A44','A45',
      'A46','A47','A48','A49','A50','A51','A52','A53','A54','A55','A56','A57','A58','A59','A60','A61','A62','A63',
      'latitude','longitude',
      'roughness','merit_dem','cti','ireci_median_wet','red_edge_1_median','ndci_median_wet','cai_median_wet','gari_median_wet','cai_median',
      'evi2_median_wet','cvi_median_wet','swir1_median_dry','msavi_median_wet','iia_median_wet','red_edge_1_median_wet','ndvi_median_wet',
      'hallheight_median_dry','rvi_median_wet','ui_median_wet','evi_median_wet','brba_median_wet','tgsi_median','hallcover_median','swir2_median',
      'tgsi_median_wet','brightness_median_wet','red_edge_4_median_wet','wetness_median_dry','red_edge_1_median_dry','red_median_wet','gcvi_median_wet',
      'green_median','red_edge_3_median_wet','red_edge_4_median','swir2_median_dry','bsi_median_dry','spri_median','red_edge_2_median_dry',
      'tgsi_median_dry','avi_median','swir2_median_wet','gari_median','cvi_median','ndwi_median_wet','mndwi_median_wet','wetness_median_wet',
      'cai_median_dry','avi_median_wet','gli_median_wet','swir1_median',
      ],
};

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias - ArcPlan - mariana@arcplan.com.br
 * MapBiomas Collection 4 (10 m) | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
