<div class="fluid-row" id="header">
    <img src='../misc/arcplan-logo.jpeg' height='70' width='auto' align='right'>
    <h1 class="title toc-ignore">Pantanal — Sentinel Collection 4 (10 m)</h1>
    <h4 class="author"><em>Developed by the ArcPlan team — mariana@arcplan.com.br</em></h4>
</div>

# About

Google Earth Engine scripts for the annual land use and land cover map of the
Pantanal biome, **MapBiomas Sentinel Collection 4**, covering **2017 to 2025** at
**10 m** resolution.

Collection 4 keeps the AlphaEarth satellite embeddings introduced in Collection 3
and rebuilds everything around them. Three things changed:

- **Nine regions instead of seven.** The region scheme is now the same as the
  Landsat Collection 11 pipeline (`regions_t` / `regions_buffer`), so the two
  products can be compared region by region.
- **Two independent sample sources.** Collection 3 trained on Sentinel-derived
  stable pixels alone. Collection 4 also builds a Landsat cross-collection
  agreement map and assigns classes between the two on purpose (see below).
- **A real merge.** Collection 3 blended regions by z-order. Collection 4 uses the
  buffer-aware weighted vote from the Landsat pipeline, which removes the seams
  along region borders.

Read the Pantanal appendix of the Algorithm Theoretical Basis Document (ATBD)
before running anything here.

# How to use

Copy the scripts into your Google Earth Engine account and run them **in order**.
There is no orchestrator: each script ends with an `Export` task and the next one
reads the asset that task produced. Wait for each task to finish before starting
the next step, and check that the version the next script expects matches what you
just wrote.

Assets live under
`projects/mapbiomas-brazil/assets/LAND-COVER-10M/COLLECTION-4/`. Change `DIR_OUT`
and the input paths to your own project before running.

---

# 01 — Sample preparation (`p01_samples`)

| Script | What it does |
| --- | --- |
| `p01_export_stable_samples.js` | Two stable-pixel maps. `RUN_LANDSAT` keeps pixels where Collections 9, 10.1 and 11 all agree; `RUN_SENTINEL` keeps pixels holding the same class in all eight years of Sentinel Collection 3. |
| `p02_stratified_sampling.js` | Draws points from both maps, stratified by class **and** region. The Sentinel map is alert-masked first; the Landsat map is not, since three-collection agreement already excludes pixels that changed. |
| `p03_extract_training_bands.js` | Extracts the predictor values at each point. Run once per source, switching `ASSET_STABLE_POINTS` and `OUTPUT_PREFIX` together. |
| `p04_clean_outliers.js` | Drops samples in the extreme tails of five diagnostic bands, per region, year and class. |
| `p05_feature_importance.js` | Diagnostic. Exports variable importance and holds the per-region band lists at the bottom of the file. |

## Why two sample sources

The two tables are not redundant, and which one feeds which class is a deliberate
choice made in the p02 scripts. The Sentinel-derived table is native 10 m and
carries fine spatial detail; the Landsat-derived table is coarser but rests on
three independent collections agreeing, which makes it the better anchor for
classes that need a long record to be trustworthy. In region 0, for instance,
forest and mosaic-of-uses are drawn from the Landsat table while savanna,
grassland and water come from the Sentinel one.

## Why outlier cleaning is new in Collection 4

A stable pixel is not automatically a clean training sample. Mixed pixels at class
borders, unflagged cloud shadow and burn scars all pass the stability test while
sitting far from the spectral centre of their class. At 30 m they are diluted; at
10 m there are enough of them to distort the model, which is why `p04` exists here
and has no equivalent in the Landsat pipeline.

## Classes

| ID | Class |
| --- | --- |
| 3 | Forest formation |
| 4 | Savanna formation |
| 11 | Wetland |
| 12 | Grassland |
| 19 | Temporary crops |
| 21 | Mosaic of uses |
| 25 | Non-vegetated area |
| 29 | Rocky outcrop |
| 33 | Water |

Classes 11 and 7 (flooded savanna) are not classified directly by every region;
they are reinserted from the flood surface in `p03/p05`. Regions 7 and 8 do train
on 11 directly, since wetland occurs there in a form the model can learn.

---

# 02 — Classification (`p02_classification`)

One Random Forest per year, per region, 200 trees, `variablesPerSplit: 1`.

| Region | Area |
| --- | --- |
| reg0 | Whole biome — baseline layer under all others |
| reg1 | Paraguay river floodplain |
| reg2 | Taquari alluvial fan |
| reg3 | Barão de Melgaço |
| reg4 | Cáceres |
| reg5 | Poconé |
| reg6 | Miranda / Aquidauana |
| reg7 | Eastern plateau border |
| reg8 | Northern plateau border |

Every region uses the full 64-band embedding block plus both coordinate bands, and
adds the fifty spectral and terrain bands that ranked highest for it in `p01/p05`.
Regions differ in more than their band lists:

- **reg1, reg4, reg5** also train on hand-drawn polygons stored in the imports
  block, used to reinforce classes the automatic sampling misses locally.
- **reg2** has the highest complementary agriculture quota, rising to 1500 from
  2019 — the Taquari fan is where cropland expanded fastest in this period.
- **reg6** has the widest savanna quotas in the pipeline (stable 4000,
  complementary 3000), draws class 19 from the stable pool rather than only the
  complementary one, and has no class 25.
- **reg4, reg5** exclude class 19 entirely, preserving the Collection 10 behaviour.
- **reg7, reg8** train on three extra classes (11, 19 and 29) in both pools.

`p02_merge_regions_gapfill.js` assembles the nine outputs. Regions are classified
over buffered boundaries, so they overlap; the merge resolves each pixel with a
weighted vote (`REGION_ORDER` plus an `EXACT_BONUS` inside a region's official
limit) rather than painting one region over another. A forward-and-backward gap
fill then closes years with no valid observation.

---

# 03 — Post-classification (`p03_post_classification`)

Seven steps. Version numbers run consecutively, so each script's input is the
previous script's output.

| Script | Asset version | What it corrects |
| --- | --- | --- |
| `p01_spatial_wetland_filter.js` | GapFill_3 → au_filter_1 | Temporal stabilisation, forest on flood-prone ground, local mode filter, and two independent wetland filters |
| `p02_mode_filter.js` | au_filter_1 → moda_filter_2 | Nine mode-keyed rules resolving class confusion across the series |
| `p03_temporal_filter.js` | moda_filter_2 → temp_filter_3 | One- and two-year flicker, edge-year noise, small pair-to-pair transitions |
| `p04_trajectory_filter.js` | temp_filter_3 → traj_filter_4 | Unstable pasture and non-vegetated trajectories; 2025 constrained by 2023-2024 and by Collection 11 |
| `p05_pasture_wetland_filter.js` | traj_filter_4 → 21_filter_5 | Reinserts wetland (11), water (33) and flooded savanna (7); propagates stable pasture |
| `p06_fractal_filter.js` | 21_filter_5 → df_filter_6 | Relief and shadow artefacts, isolation filter, and small convoluted pasture patches by fractal dimension |
| `p07_prodes_alerts_mask.js` | df_filter_6 → sp_filter_7 | PRODES-adjusted no-pasture mask and cumulative MapBiomas alerts |

`p07_prodes_alerts_mask.js` produces the asset delivered to the MapBiomas national
integration.

`p06b_fractal_filter_batch_export.js` is optional: it runs the fractal filter as
one export task per year, for when `p06` exceeds the Earth Engine time limit.

## How the mask rules are written

Most filters share one pattern: a mask adds `100` to the pixel value, so `121`
means "class 21 under this mask", and a `remap` table decides what each
combination becomes. Reading the two arrays against each other is the fastest way
to see what a rule does:

```javascript
.remap([3, 4, 11, 12, 19, 21, 25, 29, 33, 103, 104, 111, 112, 119, 121, 125, 129, 133],
       [3, 4, 11, 12, 19, 21, 25, 29, 33,  12,  12,  11,  12,  12,  12,  12,  12,  33]);
//                                          ^ under this mask, forest becomes grassland
```

## Two wetland filters, on purpose

`p01` applies the flood correction twice from independent evidence: once from the
accumulated monthly water product (historical) and once from the wet-season NDDI
computed from the mosaics themselves (spectral). Requiring both keeps a single
exceptional flood year from rewriting the map, and `p05` then rebuilds the wetland
classes from the maximum-flood surface.

---

Questions and suggestions can be sent to the development team: mariana@arcplan.com.br
