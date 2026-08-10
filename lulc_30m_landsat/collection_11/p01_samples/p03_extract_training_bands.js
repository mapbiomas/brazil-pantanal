/**
 * ==============================================================================
 * p03 | Extract spectral and terrain signatures at the sample points
 * ------------------------------------------------------------------------------
 * SUMMARY
 *   Reads the band values that the Random Forest will actually learn from.
 *   For each year and each sub-region the script assembles the predictor stack
 *   and extracts its values at every stable sample point.
 *   
 *   The stack has three sources:
 *     - bandasOnTheFly: indices computed live by the monthly mosaic module,
 *     - bandasAsset: metrics already stored in the MapBiomas mosaic asset,
 *     - terrainBands: MERIT DEM elevation plus Geomorpho90m derivatives.
 *   
 *   Work is batched region by region because a biome-wide extraction over ~160
 *   bands exceeds the Earth Engine memory limit.
 *
 * INPUTS
 *   - samples_stable8910_v{VERSION_PT}_{year} (from p02)
 *   - Landsat monthly mosaics (mosaicos_mensais_do_Google_v1 module)
 *   - MapBiomas Landsat mosaic asset (nexgenmap mosaics-2)
 *   - MERIT DEM and Geomorpho90m (aspect, convergence, roughness, eastness,
 *     northness, dxx, cti)
 *
 * OUTPUTS
 *   - pts_trained_stable789_v{VERSION_OUT}_{year}_{region}_seed_{SEED}
 *
 * NOTES
 *   - Geomorpho90m layers are rescaled and cast to Int16 to keep the tables small.
 *   - Sample years from 2023 onward reuse the 2023 point set (targetPointYear).
 *
 * PIPELINE
 *   p01 samples | step 3 of 4  ->  p02_classification
 * ==============================================================================
 */

// ==============================================================================
// 1. PARAMETERS AND CONSTANTS
// ==============================================================================

// Output configurations aligned with MapBiomas Collection 11 data engine
var VERSION_OUT = '4';
var VERSION_PT = '2';
var DIR_OUT = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/';

// Reference Database Asset Paths
var ASSET_REGIONS = 'projects/ee-arcplan-df/assets/col11/regions_buffer';
var ASSET_BIOMES_RASTER = 'projects/mapbiomas-workspace/AUXILIAR/biomas-raster-41';
var ASSET_STABLE_ANNUAL_DIR = 'projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/SAMPLES/PANTANAL/samples_stable8910_v';
var ASSET_MOSAICS = 'projects/nexgenmap/MapBiomas2/LANDSAT/BRAZIL/mosaics-2'
// External modules configuration
var MOSAIC_MODULE = require('users/gee_arcplan/MapBiomas_Col11_Pantanal:mosaicos_mensais_do_Google_v1');
var palettes = require('users/mapbiomas/modules:Palettes.js');

// Computational control parameter
var SEED = 1;

// Full temporal scope for Collection 11 (1985 to 2025).
// One export task is queued per year and per region, so the full list produces
// 41 x 9 = 369 tasks. Trim this array to run the extraction in batches.
var YEARS = [
    1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994,
    1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004,
    2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014,
    2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025
];

// Operational sub-region structural tracking list (Updated to include reg7 and reg8)
var REGIONS_LIST = ['reg1', 'reg2', 'reg3', 'reg4', 'reg5', 'reg6', 'reg7', 'reg8', 'reg0'];

 var bandasOnTheFly =[
  "green_median_dry",  "afvi_median",  "afvi_median_dry",  "afvi_median_wet",  "ano",
  "aspect",  "avi_median",  "avi_median_dry",  "avi_median_wet",  "blue_median_wet",  "brba_median",  "brba_median_dry",
  "brba_median_wet",  "brightness_median",  "brightness_median_dry",  "brightness_median_wet",
  "bsi_median",  "bsi_median_dry",  "bsi_median_wet",  "co2flux_median",  "convergence",  "cti",
  "cvi_median",  "cvi_median_dry",  "cvi_median_wet",  "dswi5_median",  "dswi5_median_dry",
  "dswi5_median_wet",  "dxx",  "eastness",  "evi_median",  "evi_median_dry",  "evi_median_wet",
  "gli_median",  "gli_median_dry",  "gli_median_wet",  "green_median_texture",  "green_median_wet",
  "gvmi_median",  "gvmi_median_dry",  "gvmi_median_wet",  "hallcover_median_dry",  "hallcover_median_wet",
  "hallheigth_median_dry",  "hallheigth_median_wet",  "iia_median",  "iia_median_dry",  "iia_median_wet",
  "lai_median",  "latitude",  "longitude",  "lswi_median",  "lswi_median_dry",  "lswi_median_wet",
  "mbi_median",  "mbi_median_dry",  "mbi_median_wet",  "merit_dem",  "mndwi_median",  "mndwi_median_dry",
  "mndwi_median_wet",  "msi_median",  "msi_median_dry",  "msi_median_wet",  "nddi_median",  "nddi_median_dry",
  "nddi_median_wet",  "ndvi_median_dry",  "ndvi_median_wet",  "ndwi_median_dry",  "ndwi_median_wet",
  "ndwi2_median",  "ndwi2_median_dry",  "ndwi2_median_wet",  "nir_median_dry",  "nir_median_wet",  "northness",
  "osavi_median",  "osavi_median_dry",  "osavi_median_wet",  "ratio_median",  "ratio_median_dry",
  "ratio_median_wet",  "red_median_dry",  "red_median_wet",  "ri_median",  "ri_median_dry",  "ri_median_wet",
  "roughness",  "rvi_median",  "rvi_median_dry",  "rvi_median_wet",  "spri_median",  "spri_median_dry",
  "spri_median_wet",  "swir1_median_dry",  "swir1_median_wet",  "swir2_median_dry",  "swir2_median_wet",
  "ui_median",  "ui_median_dry",  "ui_median_wet",  "wetness_median",  "wetness_median_dry",  "wetness_median_wet"
  ]

 var bandasAsset = [
 "cai_median_dry",  "cai_stdDev",  "cloud_amp",  "cloud_max",  "cloud_median",  "cloud_median_dry",
 "cloud_median_wet",  "cloud_min",  "cloud_stdDev",  "evi2_amp",  "evi2_stdDev",  "gcvi_median",  "gcvi_median_dry",
 "gcvi_median_wet",  "gcvi_stdDev",  "gvs_amp",  "gvs_max",  "gvs_median",  "gvs_median_dry",  "gvs_median_wet",  "gvs_min",
 "gvs_stdDev",  "hallcover_stdDev",  "ndvi_amp",  "ndvi_stdDev",  "ndwi_amp",  "ndwi_stdDev",  "npv_amp",  "npv_max",
 "npv_median",  "npv_median_dry",  "npv_median_wet",  "npv_min",  "npv_stdDev",  "pri_median",  "pri_median_dry",
 "pri_median_wet",  "savi_median",  "savi_median_dry",  "savi_median_wet",  "savi_stdDev",  "sefi_median",  "sefi_median_dry",
 "sefi_stdDev",  "shade_amp",  "shade_max",  "shade_median",  "shade_median_dry",  "shade_median_wet",  "shade_min",
 "shade_stdDev",  "slope",  "wefi_amp",  "wefi_median",  "wefi_median_wet",  "wefi_stdDev",
  ]

// ==============================================================================
// 2. GEOMETRY AND REGIONS INITIALIZATION
// ==============================================================================

// Ingest Sub-regions vector asset boundaries
var regioesCollection = ee.FeatureCollection(ASSET_REGIONS);
var geometry = regioesCollection.geometry(); // Dynamic extraction of total operational boundary

// Raster Biome mask for visual canvas verification
var biomes = ee.Image(ASSET_BIOMES_RASTER);
var bioma250mil_PANT = biomes.mask(biomes.eq(3));
Map.addLayer(bioma250mil_PANT, {palette: 'green', opacity: 0.3}, 'Pantanal Biome Mask', false);

// ==============================================================================
// 3. TOPOGEOGRAPHIC CO-REGISTRATION (GEOMORPHO90M & MERIT DEM)
// ==============================================================================

// Load and format Elevation Model (MERIT DEM) - Cast to Int16 to save memory
var dem = ee.Image('MERIT/DEM/v1_0_3').select('dem').toInt16().rename('merit_dem');

// Load, rescale, and optimize Geomorpho90m variables to prevent precision loss and excessive storage footprint
var aspect = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/aspect").mosaic().multiply(100).round().toInt16().rename('aspect');
var convergence = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/convergence").mosaic().multiply(1000).round().toInt16().rename('convergence');
var roughness = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/roughness").mosaic().multiply(1000).round().toInt16().rename('roughness');
var eastness = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/eastness").mosaic().multiply(1000).round().toInt16().rename('eastness');
var northness = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/northness").mosaic().multiply(10000).round().toInt16().rename('northness');
var dxx = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/dxx").mosaic().multiply(10000).round().toInt16().rename('dxx');
var cti = ee.ImageCollection("projects/sat-io/open-datasets/Geomorpho90m/cti").mosaic().multiply(1000).round().toInt16().rename('cti');

// Combine geomorphometric variables into a static structural block
var terrainBands = dem.addBands([aspect, convergence, roughness, eastness, northness, dxx, cti])
                       .clip(regioesCollection.geometry())

// ==============================================================================
// 4. SPECTRAL AND TERRAIN EXTRACTION (BATCHED BY YEAR AND REGION)
// ==============================================================================

/**
 * Outer loop over the configured years.
 */
for (var i_ano = 0; i_ano < YEARS.length; i_ano++) {
    var currentYear = YEARS[i_ano];

    // Dynamic temporal boundary evaluation
    var targetPointYear = (currentYear >= 2023) ? '2023' : String(currentYear);

    // Unified stable point table for the year (carries the id_reg property).
    var stablePointsAsset = ASSET_STABLE_ANNUAL_DIR + VERSION_PT + '_' + targetPointYear;
    var rawPointsCollection = ee.FeatureCollection(stablePointsAsset);

    /**
     * Inner client-side loop over each operational sub-region. Splitting the work
     * region by region keeps each server-side request small and avoids the memory
     * ceiling that a single biome-wide sampleRegions call would hit.
     */
    REGIONS_LIST.forEach(function(regId) {

        // 1. Isolate the current region vector and extract its geometry.
        var subRegionFeature = regioesCollection.filter(ee.Filter.eq('id_reg', regId));
        var subRegionGeometry = subRegionFeature.geometry();

        // 2. Keep only the points that belong to this region.
        var pointsFilteredByRegion = rawPointsCollection.filter(ee.Filter.eq('id_reg', regId));

        // 3. Build the on-the-fly mosaic, clipped to this region only.
        var annualMosaic = MOSAIC_MODULE.getMosaic(currentYear, subRegionGeometry);

        // 4. Load the pre-computed mosaic asset and keep only the required bands.
        var annualMosaicAsset = ee.ImageCollection(ASSET_MOSAICS)
                                    .filter(ee.Filter.eq('biome', 'PANTANAL'))
                                    .filter(ee.Filter.eq('year', currentYear))
                                    .mosaic()
                                    .select(bandasAsset)
                                    .clip(subRegionGeometry);

        // 5. Attach the year as a predictor band and merge every band source.
        var yearMetadataBand = ee.Image.constant(currentYear).int16().rename('ano');

        var finalRegionalImage = annualMosaic
                                    .addBands(yearMetadataBand)
                                    .addBands(terrainBands)
                                    .select(bandasOnTheFly)
                                    .addBands(annualMosaicAsset)
                                    .clip(subRegionGeometry);

        // 6. Extract the band values at each sample point.
        var regionalTrainingCollection = finalRegionalImage.sampleRegions({
            'collection': pointsFilteredByRegion,
            'scale': 30,
            'tileScale': 16,     // Maximum sub-tiling; prevents out-of-memory errors.
            'geometries': true   // Kept so the points can be inspected visually.
        });

        // 7. Output name carries the year, the region and the seed.
        var outputAssetName = 'pts_trained_stable789_v' + VERSION_OUT + '_' + currentYear +
                              '_' + regId + '_seed_' + SEED;

        // 8. Queue one task per year and region.
        Export.table.toAsset({
            'collection': regionalTrainingCollection,
            'description': outputAssetName,
            'assetId': DIR_OUT + outputAssetName,
            'overwrite': true
        });

        print('Task queued -> year: ' + currentYear + ' | region: ' + regId,
              'bands extracted: ' + (bandasOnTheFly.length + bandasAsset.length));
    });
}

/**
 * ------------------------------------------------------------------------------
 * @by Mariana Dias — ArcPlan — mariana@arcplan.com.br
 * MapBiomas Collection 11 | Pantanal biome | Land use and land cover
 * ------------------------------------------------------------------------------
 */
