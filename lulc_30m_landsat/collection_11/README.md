<div class="fluid-row" id="header">
    <img src='../misc/arcplan-logo.jpeg' height='70' width='auto' align='right'>
    <h1 class="title toc-ignore">Pantanal — Collection 11</h1>
    <h4 class="author"><em>Developed by the ArcPlan team — mariana@arcplan.com.br</em></h4>
</div>

# About

This folder contains the Google Earth Engine scripts used to produce the annual land
use and land cover map of the Pantanal biome for **MapBiomas Collection 11**, covering
**1985 to 2025** at 30 m resolution.

We recommend reading the Pantanal appendix of the Algorithm Theoretical Basis Document
(ATBD) before running anything here.

# How to use

Copy the scripts into your own Google Earth Engine account and run them **in order**.
There is no orchestrator: each script ends with an `Export` task and the next one reads
the asset that task produced. Two constants at the top of every file control the chain:

| Constant | Meaning |
| --- | --- |
| `VERSION_IN` / `samplesVersion` | version of the asset this script reads |
| `VERSION_OUT` / `outputVersion` | version this script writes |

Wait for each export task to finish before starting the next step, and check that the
version the next script expects matches the one you just wrote.

All output paths point at
`projects/mapbiomas-brazil/assets/LAND-COVER/COLLECTION-11/GENERAL/`. Change `DIR_OUT`
and the input asset paths to your own project before running.

---

# 01 — Sample preparation (`p01_samples`)

Builds the training data. Two independent definitions of a "stable" pixel are used and
both feed the classifier: temporal persistence inside a single collection, and agreement
between three published collections.

## Classes modelled

The full MapBiomas legend is collapsed to eight targets:

| ID | Class |
| --- | --- |
| 3 | Forest formation |
| 4 | Savanna formation |
| 12 | Grassland |
| 19 | Temporary crops |
| 21 | Mosaic of uses |
| 25 | Non-vegetated area |
| 29 | Rocky outcrop |
| 33 | Water |

Classes 7 (flooded savanna) and 11 (wetland) are not classified directly; they are
reinserted from the monthly water product in `p03/p07`.

---

# 02 — Classification (`p02_classification`)

One Random Forest per year, per region. Regions are hydrographic and geomorphological
subdivisions of the biome, not administrative ones.

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

Each region carries its **own band list** (from `p01/p04`) and its **own per-class
sample quotas**, so a class that dominates one part of the Pantanal does not swamp the
regions where it is scarce. Regions 1, 4 and 5 also train on hand-drawn polygons stored
in the imports block, used to reinforce classes the automatic sampling misses locally.


---

# 03 — Post-classification (`p03_post_classification`)

A chain of nine filters. Each one reads the output of the previous one, so the version
numbers run consecutively (v30 → v39). Run them in order.

| Script | Asset version | What it corrects |
| --- | --- | --- |
| `p01_temporal_stabilizer.js` | → 30 | Implausible transitions at both ends of the series, forest override, mode-based stabilisation |
| `p02_temporal_filter.js` | 30 → 31 | One-year and two-year flicker (3-year and 4-year moving windows) |
| `p03_masks_prodes_alerts.js` | 31 → v32 | PRODES, MapBiomas alerts and flood-frequency false positives |
| `p04_spatial_filter.js` | v32 → v33 | Edge-year rules, agriculture projection, 2025 alerts, spatial smoothing below the MMU |
| `p06_trajectory_filter.js` | v33 → v34 | Forest/savanna/grassland confusion, using presence, change count and trajectory codes |
| `p07_include_wetland.js` | v34 → v35 | Reinserts water (33), wetland (11) and flooded savanna (7) from the monthly product |
| `p08_consistency_rules.js` | v35 → v36 | 1985 pasture, forest on flood-prone ground, isolated 2011 wetland, irreversibility of classes 19 and 25 |
| `p09_pasture_outcrop_filter.js` | v36 → v38 | Rocky outcrops (own Random Forest), stable pasture persistence, slope mask |
| `p10_suspicious_patches.js` | v38 → v39 | Small, ragged class 21 patches, by fractal dimension |

`p10_suspicious_patches.js` produces the asset delivered to the MapBiomas national
integration.

---

Questions and suggestions can be sent to the development team: mariana@arcplan.com.br
