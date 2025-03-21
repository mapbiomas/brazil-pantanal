<<div class="fluid-row" id="header">
    <img src='./misc/arcplan-logo.jpeg' height='70' width='auto' align='right'>
    <h1 class="title toc-ignore">Pantanal</h1>
    <h4 class="author"><em>Developed by  ArcPlan team - mariana@arcplan.com.br</em></h4>
</div>

# About
This folder contains the scripts to classify and post-process the Pantanal Biome.

We recommend that you read the Pantanal Biome Appendix of the Algorithm Theoretical Basis Document (ATBD) available at MapBiomas website.

# How to use
First, you need to copy these scripts to your Google Earth Engine (GEE) account. Then you need to follow the steps bellow:

# 01 Pre-processing

Step01: build stable pixels from Collecitons 9 and save a new asset

Step02: exports stable samples filtered by region

Step03: exports stable samples with segmented clusters

Step04: exports trained sampes

# 02 Classification:

Step01: classify and export classification for each region

Step02: blend regions classification

# 03 Post-processing:

Step01: spatial filter

Step02: apply flood area mask

Step03: apply MapBiomas Alerts mask 

Step04: apply tratectory based filter

Step05: apply pasture area filter

Step06: adds water and wetland data

Step07: adds rocky outcrop data

Step08: final adjustments before map integration
