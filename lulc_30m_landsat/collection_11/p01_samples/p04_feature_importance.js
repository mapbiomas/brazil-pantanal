/**
 * ==============================================================================
 * p04 | Feature importance and band selection
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Diagnostic step, not part of the production chain.
 *   
 *   Trains a Random Forest on the full ~160-band stack for a sample of years and
 *   for each sub-region, then reads the variable importance the model reports.
 *   The result is exported as a CSV and used to pick the fifty bands that each
 *   region actually classifies on, which keeps the production models small and
 *   lets every region weight its own drivers (elevation and roughness matter in
 *   the plateau regions, wetness and water indices in the floodplain ones).
 *   
 *   The selected lists are kept at the bottom of the file as top50BandsPorRegiao.
 *
 * INPUTS
 *   - pts_trained_stable_v5_regiao_{region}_trained (from p03)
 *
 * OUTPUTS
 *   - feature_importance_mapbiomas.csv (Google Drive)
 *
 * PIPELINE
 *   p01 samples | step 4 of 4 (diagnostic)  ->  informs p02_classification
 * ==============================================================================
 */

// ==============================================================================
// 1. PARAMETERS AND CONSTANTS
// ==============================================================================

var regions = [0, 1, 2, 3, 4, 5, 6, 7, 8];
var anos = [1985,1990,1995,2000,2005,2010,2015,2020, 2025]
var bandNames = ["afvi_median", "afvi_median_dry", "afvi_median_wet", "aspect", "avi_median", "avi_median_dry",
"avi_median_wet", "blue_median_wet", "brba_median", "brba_median_dry", "brba_median_wet",
"brightness_median", "brightness_median_dry", "brightness_median_wet", "bsi_median",
"bsi_median_dry", "bsi_median_wet", "cai_median_dry", "cai_stdDev", "cloud_amp",
"cloud_max", "cloud_median", "cloud_median_dry", "cloud_median_wet", "cloud_min",
"cloud_stdDev", "co2flux_median", "convergence", "cti", "cvi_median", "cvi_median_dry",
"cvi_median_wet", "dswi5_median", "dswi5_median_dry", "dswi5_median_wet",
"dxx", "eastness", "evi2_amp", "evi2_stdDev", "evi_median", "evi_median_dry",
"evi_median_wet", "gcvi_median", "gcvi_median_dry", "gcvi_median_wet", "gcvi_stdDev",
"gli_median", "gli_median_dry", "gli_median_wet", "green_median_dry", "green_median_texture",
"green_median_wet", "gvmi_median", "gvmi_median_dry", "gvmi_median_wet", "gvs_amp", "gvs_max",
"gvs_median", "gvs_median_dry", "gvs_median_wet", "gvs_min", "gvs_stdDev", "hallcover_median_dry",
"hallcover_median_wet", "hallcover_stdDev", "hallheigth_median_dry", "hallheigth_median_wet",
"iia_median", "iia_median_dry", "iia_median_wet", "lai_median", "latitude", "longitude", "lswi_median",
"lswi_median_dry", "lswi_median_wet", "mbi_median", "mbi_median_dry", "mbi_median_wet", "merit_dem",
"mndwi_median", "mndwi_median_dry", "mndwi_median_wet", "msi_median", "msi_median_dry", "msi_median_wet",
"nddi_median", "nddi_median_dry", "nddi_median_wet", "ndvi_amp", "ndvi_median_dry", "ndvi_median_wet",
"ndvi_stdDev", "ndwi2_median", "ndwi2_median_dry", "ndwi2_median_wet", "ndwi_amp", "ndwi_median_dry",
"ndwi_median_wet", "ndwi_stdDev", "nir_median_dry", "nir_median_wet", "northness", "npv_amp", "npv_max",
"npv_median", "npv_median_dry", "npv_median_wet", "npv_min", "npv_stdDev", "osavi_median",
"osavi_median_dry", "osavi_median_wet", "pri_median", "pri_median_dry", "pri_median_wet",
"ratio_median", "ratio_median_dry", "ratio_median_wet", "red_median_dry", "red_median_wet",
"ri_median", "ri_median_dry", "ri_median_wet", "roughness", "rvi_median",
"rvi_median_dry", "rvi_median_wet", "savi_median", "savi_median_dry", "savi_median_wet",
"savi_stdDev", "sefi_median", "sefi_median_dry", "sefi_stdDev", "shade_amp", "shade_max",
"shade_median", "shade_median_dry", "shade_median_wet", "shade_min", "shade_stdDev", "slope",
"spri_median", "spri_median_dry", "spri_median_wet", "swir1_median_dry", "swir1_median_wet",
"swir2_median_dry", "swir2_median_wet", "ui_median", "ui_median_dry", "ui_median_wet", "wefi_amp",
"wefi_median", "wefi_median_wet", "wefi_stdDev", "wetness_median", "wetness_median_dry", "wetness_median_wet", ]
// ==============================================================================
// 2. TRAIN ONE MODEL PER REGION AND YEAR, THEN READ ITS VARIABLE IMPORTANCE
// ==============================================================================

// Client-side accumulator for the server-side feature lists.
var listaDeRecursos = [];

// Client-side loops: the asset path has to be built in plain JavaScript.
regions.forEach(function(regiao) {
  anos.forEach(function(ano) {

    var assetPath = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/pts_trained_stable_v5_regiao_' + regiao + '_trained';

    var amostras = ee.FeatureCollection(assetPath).filter(ee.Filter.eq('ano', ano));

    var classifier = ee.Classifier.smileRandomForest(150, 1)
        .train(amostras, 'reference', bandNames);

    var importancia = ee.Dictionary(classifier.explain().get('importance'));

    // Turn the importance dictionary into features (evaluated server-side).
    var featuresBanda = importancia.map(function(banda, valor) {
      return ee.Feature(null, {
        'Regiao': regiao,
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
// Result of the run above: the fifty most important bands for each region, in
// descending order of importance. These lists are what feeds bandNamesList in the
// p02 classification scripts. Kept here so the selection stays traceable.
// ==============================================================================

var top50BandsPorRegiao = {
  0: [
    "brightness_median", "latitude", "avi_median_wet", "nir_median_dry", "avi_median",
    "brightness_median_dry", "brightness_median_wet", "wetness_median", "merit_dem",
    "swir1_median_wet", "wetness_median_wet", "savi_median_wet", "roughness",
    "green_median_dry", "gcvi_median", "ri_median_wet", "green_median_wet",
    "red_median_dry", "gcvi_stdDev", "evi_median", "savi_stdDev", "ri_median",
    "wetness_median_dry", "nir_median_wet", "osavi_median", "swir2_median_wet",
    "iia_median_wet", "longitude", "red_median_wet", "evi_median_wet",
    "avi_median_dry", "savi_median", "gcvi_median_wet", "bsi_median_dry",
    "mndwi_median", "ratio_median", "lswi_median_wet", "swir1_median_dry",
    "brba_median", "iia_median", "wefi_median_wet", "ndwi2_median_wet",
    "hallheigth_median_dry", "lai_median", "hallcover_median_dry", "nddi_median_wet",
    "mndwi_median_wet", "ratio_median_dry", "hallcover_median_wet", "ri_median_dry"
  ],
  1: [
    "latitude", "brightness_median", "wetness_median", "red_median_dry", "brightness_median_dry", "evi_median_wet", "swir1_median_dry", "osavi_median", "evi_median", "wetness_median_wet", "lai_median", "nir_median_dry", "wetness_median_dry", "avi_median", "longitude", "green_median_dry", "ratio_median", "ri_median", "gcvi_median", "avi_median_wet", "brba_median", "iia_median", "red_median_wet", "ratio_median_wet", "iia_median_wet", "green_median_wet", "ndvi_median_wet", "mndwi_median_wet", "brightness_median_wet", "avi_median_dry", "savi_median_wet", "brba_median_wet", "osavi_median_wet", "hallheigth_median_dry", "merit_dem", "hallcover_median_dry", "rvi_median", "savi_median", "gcvi_median_wet", "swir2_median_dry", "ri_median_wet", "gcvi_stdDev", "savi_median_dry", "rvi_median_wet", "roughness", "gvmi_median_wet", "bsi_median", "nir_median_wet", "mndwi_median_dry", "evi2_stdDev"
  ],
  2: [
    "longitude", "wetness_median", "brightness_median", "avi_median_wet", "nir_median_wet", "avi_median", "merit_dem", "swir1_median_wet", "savi_median_wet", "brightness_median_dry", "savi_median", "nir_median_dry", "brightness_median_wet", "gcvi_median", "rvi_median_wet", "wetness_median_wet", "swir1_median_dry", "gcvi_median_wet", "ratio_median_wet", "nddi_median_wet", "ri_median_wet", "wefi_median_wet", "wetness_median_dry", "iia_median", "bsi_median_dry", "hallheigth_median_wet", "swir2_median_wet", "green_median_wet", "ratio_median", "msi_median_dry", "green_median_dry", "ndvi_median_wet", "osavi_median_wet", "gvmi_median_wet", "lswi_median_wet", "ri_median", "evi_median", "msi_median", "red_median_dry", "co2flux_median", "bsi_median_wet", "avi_median_dry", "savi_median_dry", "dswi5_median_wet", "shade_median", "iia_median_wet", "ndvi_amp", "nddi_median", "afvi_median", "gvmi_median"
  ],
  3: [
    "brightness_median", "longitude", "wetness_median", "savi_median_wet", "swir1_median_dry", "avi_median", "brightness_median_dry", "wetness_median_dry", "nir_median_wet", "merit_dem", "swir2_median_dry", "avi_median_wet", "nir_median_dry", "ratio_median", "red_median_dry", "mndwi_median_wet", "brightness_median_wet", "hallheigth_median_dry", "wetness_median_wet", "gcvi_median_wet", "gcvi_stdDev", "green_median_wet", "avi_median_dry", "evi_median_wet", "ri_median", "ri_median_wet", "shade_median", "osavi_median_wet", "savi_median", "iia_median_wet", "hallcover_median_dry", "green_median_dry", "shade_median_dry", "evi_median_dry", "iia_median", "rvi_median", "lai_median", "swir1_median_wet", "ratio_median_dry", "gvmi_median", "gvmi_median_wet", "shade_median_wet", "gcvi_median", "swir2_median_wet", "dswi5_median", "red_median_wet", "ratio_median_wet", "ui_median", "dswi5_median_dry", "bsi_median"
  ],
  4: [
    "longitude", "latitude", "brightness_median", "avi_median", "green_median_dry", "iia_median", "wetness_median", "red_median_wet", "avi_median_wet", "brba_median", "ratio_median", "lai_median", "ndvi_median_wet", "brightness_median_dry", "merit_dem", "savi_median_wet", "brba_median_wet", "evi_median_wet", "nir_median_dry", "wetness_median_dry", "nir_median_wet", "green_median_wet", "rvi_median", "avi_median_dry", "ri_median", "roughness", "osavi_median_wet", "hallheigth_median_dry", "iia_median_wet", "nddi_median", "wetness_median_wet", "brightness_median_wet", "ri_median_wet", "swir1_median_dry", "ratio_median_wet", "swir2_median_dry", "ndvi_median_dry", "swir2_median_wet", "mndwi_median_wet", "evi_median", "hallcover_median_dry", "brba_median_dry", "rvi_median_wet", "osavi_median", "mndwi_median", "red_median_dry", "gcvi_median", "gcvi_stdDev", "gcvi_median_wet", "dswi5_median"
  ],
  5: [
    "brightness_median", "wetness_median", "avi_median", "wetness_median_wet", "ri_median_wet", "longitude", "mndwi_median_wet", "swir1_median_dry", "wetness_median_dry", "gcvi_median_wet", "nir_median_wet", "iia_median_wet", "green_median_wet", "merit_dem", "brightness_median_wet", "swir1_median_wet", "swir2_median_wet", "brightness_median_dry", "osavi_median", "avi_median_wet", "brba_median_wet", "savi_median_wet", "latitude", "nir_median_dry", "gcvi_stdDev", "mndwi_median", "brba_median", "swir2_median_dry", "roughness", "red_median_wet", "red_median_dry", "ratio_median_wet", "avi_median_dry", "ui_median", "gcvi_median", "ratio_median", "green_median_dry", "bsi_median_wet", "co2flux_median", "evi_median_wet", "afvi_median", "ndwi2_median_wet", "evi_median", "nddi_median", "ndvi_median_wet", "nddi_median_wet", "afvi_median_dry", "mbi_median_wet", "savi_median_dry", "rvi_median_wet"
  ],
  6: [
    "latitude", "roughness", "merit_dem", "brightness_median", "longitude", "wetness_median", "gcvi_median", "brightness_median_dry", "ri_median_wet", "avi_median", "savi_median_wet", "avi_median_wet", "nir_median_dry", "brba_median", "wetness_median_wet", "nir_median_wet", "evi_median", "swir1_median_dry", "mndwi_median", "wetness_median_dry", "green_median_dry", "osavi_median", "brightness_median_wet", "savi_median", "evi_median_wet", "green_median_wet", "avi_median_dry", "gcvi_stdDev", "hallheigth_median_dry", "ri_median", "mndwi_median_wet", "gcvi_median_wet", "iia_median_wet", "ratio_median", "iia_median", "rvi_median", "swir1_median_wet", "swir2_median_dry", "mndwi_median_dry", "red_median_dry", "evi_median_dry", "red_median_wet", "rvi_median_dry", "osavi_median_wet", "ratio_median_wet", "lai_median", "rvi_median_wet", "ndvi_median_wet", "hallcover_median_dry", "co2flux_median"
  ],
  7: [
    "latitude", "wetness_median", "longitude", "merit_dem", "ri_median_wet", "brightness_median", "swir1_median_dry", "iia_median_wet", "brightness_median_dry", "osavi_median_wet", "swir1_median_wet", "mndwi_median", "wetness_median_dry", "osavi_median", "swir2_median_wet", "red_median_dry", "green_median_wet", "gcvi_median", "brba_median_wet", "lai_median", "roughness", "hallheigth_median_dry", "brightness_median_wet", "brba_median", "savi_median_wet", "iia_median", "hallcover_median_wet", "avi_median_wet", "mndwi_median_dry", "ndwi_median_wet", "green_median_texture", "ndwi2_median_wet", "wetness_median_wet", "nir_median_dry", "mbi_median_wet", "mndwi_median_wet", "green_median_dry", "ratio_median", "nir_median_wet", "ri_median", "brba_median_dry", "swir2_median_dry", "evi_median_wet", "avi_median", "cai_median_dry", "gcvi_stdDev", "ndvi_median_wet", "rvi_median_wet", "nddi_median_wet", "gcvi_median_wet"
  ],
  8: [
    "latitude", "brightness_median", "wetness_median", "merit_dem", "longitude", "roughness", "slope", "cti", "nir_median_dry", "swir2_median_wet", "red_median_wet", "avi_median", "green_median_wet", "brightness_median_dry", "brightness_median_wet", "wetness_median_wet", "ndwi2_median", "nir_median_wet", "ratio_median_wet", "ndwi2_median_wet", "wetness_median_dry", "avi_median_dry", "ri_median", "swir1_median_dry", "ndvi_stdDev", "ndvi_amp", "evi_median", "avi_median_wet", "ri_median_wet", "hallheigth_median_dry", "iia_median", "savi_median", "red_median_dry", "savi_median_wet", "swir1_median_wet", "hallheigth_median_wet", "ui_median_wet", "hallcover_median_dry", "northness", "green_median_dry", "swir2_median_dry", "eastness", "savi_stdDev", "ui_median_dry", "osavi_median_wet", "bsi_median", "green_median_texture", "iia_median_dry", "afvi_median_wet", "nddi_median_wet"
  ],
};

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias — ArcPlan — mariana@arcplan.com.br
 * MapBiomas Collection 11 | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
