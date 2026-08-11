<div class="fluid-row" id="header">
    <img src='./misc/arcplan-logo.jpeg' height='70' width='auto' align='right'>
    <h1 class="title toc-ignore">Pantanal — Sentinel (10 m)</h1>
    <h4 class="author"><em>Developed by the ArcPlan team — mariana@arcplan.com.br</em></h4>
</div>

# About

This folder holds the Google Earth Engine scripts for the **10 m Sentinel-2** land
use and land cover mapping of the Pantanal biome. The 30 m Landsat series lives in
`../lulc_30m_landsat`.

One folder per published collection, each frozen as it was run. **Use the highest
number.** Older collections are kept for reproducibility, not for reuse.

| Folder | Period | Resolution | Regions | Status |
| --- | --- | --- | --- | --- |
| `Collection_2` | 2016–2023 | 10 m | 7 (reg0–reg6) | Superseded |
| `Collection_3` | 2017–2025 | 10 m | 8 (reg0–reg7) | Superseded |
| `Collection_4` | 2017–2025 | 10 m | 9 (reg0–reg8) | **Current** |

Read the Pantanal appendix of the Algorithm Theoretical Basis Document (ATBD)
before running anything here.

# How the three collections differ

The pipeline shape has been stable since Collection 2 — sampling, then regional
classification, then a chain of post-classification filters — but what the model
learns from has changed twice.

**Collection 2** gave the classifier spatial context through **SNIC segmentation**:
`p01/p03_exporta_banda_segmento_Sentinel2` ran SNIC over the annual mosaic and
exported `clusters_{year}` bands, which entered the model alongside per-segment
NDVI and NDWI means. It trained two classifiers, Random Forest and Gradient Tree
Boost, and exported both.

**Collection 3** replaced the segmentation with the **Google AlphaEarth satellite
embeddings** (`GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL`): 64 bands per pixel per year,
already trained to encode context. Two thirds of the predictors became embeddings.
It also added a spatial erosion step (`focalMin`) to keep only the core of each
stable patch, which is the answer to the edge noise that 10 m makes visible.

**Collection 4** keeps the embeddings and rebuilds the rest around them:

- Nine regions, matching the Landsat Collection 11 scheme, so the two products can
  be compared region by region.
- Two independent sample sources — Landsat cross-collection agreement and Sentinel
  temporal persistence — with classes assigned deliberately between them.
- Outlier removal on the training samples, which has no equivalent in earlier
  collections.
- A buffer-aware weighted-vote merge instead of a plain z-order blend, which
  removes the seams along region borders.
- Seven post-classification filters instead of three.

# Folder layout

```
lulc_10m_sentinel/
├── Collection_2/          p01 pre-processing · p02 classification · p03 post-processing
├── Collection_3/          flat numbering 01–08, with its own README
├── Collection_4/          p01_samples · p02_classification · p03_post_classification
└── misc/                  logo and shared assets
```

Each collection folder documents its own chain. Start with `Collection_4/README.md`.

# Running any of them

Copy the scripts into your Google Earth Engine account and run them **in order**.
There is no orchestrator in any collection: each script ends with an `Export` task
and the next reads the asset that task produced. Wait for each task to finish
before starting the next step.

You will need read and write access to the MapBiomas asset directories, and the
ArcPlan index modules referenced at the top of each script. Note that the module
path is collection-specific: Collection 3 still requires
`MapBiomas_Col10_Pantanal:processa_Bandas_Indices_DF_lite`, while Collection 4 uses
`MapBiomas_Col11_Pantanal:processa_Bandas_Indices_Sentinel`.

# Known issues in the superseded collections

These are recorded because the assets they produced are still referenced
elsewhere, not because the scripts should be rerun.

**Collection 3**

- `08_post_classification_master.js` reads `PANT_colS2Emb_Anual_23`, a different
  prefix from the `PANT_col3_S2_annual_spatial_flood_v1` that `07` writes. The two
  do not connect; either a script is missing or `08` was left pointing at an older
  lineage.
- In the same script, `applyTemporalFilter` reads `img` and reassigns `filteredImg`
  inside the class loop instead of chaining, so of the five classes passed in only
  the last one takes effect.
- Sample versions do not line up across `03` (`VERSION_IN = '4'`), `04`
  (`VERSION_OUT = '1'`) and `05_01` (`VERSION_IN = '14'`).
- `04_export_trained_samples.js` ships with only `['reg6']` active; the full region
  list is commented out above it.
- `05_01` sets `collection_id` to `10.0`, while `05_02` uses `3.0`.
- `01_export_stable_samples.js` exports a categorical map with
  `pyramidingPolicy: 'distributed'`, which should be `'mode'`.

**Collection 2**

- Both a Random Forest and a Gradient Tree Boost classification are exported per
  region, but only one is consumed downstream.
- `p03/p03_mascara_alertas` carries several near-identical processing blocks.

---

Questions and suggestions can be sent to the development team: mariana@arcplan.com.br
