# PEI Trade Returns Atlas

The GeoREACH Lab's PEI Trade Returns Atlas visualizes the import and export customs returns of Prince Edward Island across three interactive plates. All three plates are filterable by year, trade direction (imports or exports), and commodity, and every figure can be traced back to its source entry in the original returns on Canadiana.org. Each of the three plates has its strengths and weaknesses.

**Plate A** is a flow map with pie charts showing the volume and composition of trade between PEI's harbours and their colonial and international trading partners. Most of these partners were relatively consistent in the colonial trade data (even after 1867), and although we don't know exactly where in the locations the goods originated/terminated, we can make some educated guesses. For now we have listed them as Nova Scotia (anchored to Halifax), NB (Saint John), the United States (Boston), Canada (Quebec), Newfoundland (Saint John's), the UK, West Indies, and occasionally the Magdalene Islands and St. Pierre and Miquelon. The sea routes are modelled by GIS using the most direct water routes between each harbour to its counterpart, so there are plenty of navigational oversimplifications in that plate. The relative importance of trade is shown in the thickness of the black lines, and the relative breakdown of commodities in the pie charts.

**Plate B** arranges those same trading partners on a compass rose centred on Charlottetown, preserving the approximate bearing and allowing readers to focus on the Island's ports. Charlottetown is the most important importer and exporter by a wide margin, but there were 14 other harbours with active customs records in these years. This plate comes closer to showing the coasting trade that was overlooked by previous studies like the Atlantic Canada Shipping Project.

With that said, the "foreign trade," as it was called on PEI, was important when it came to agricultural exports — especially oats, which accounted for around 44% of export value across all years and fully half in 1861. Half of all exports were shipped directly from the 14 small harbours, which sheds light on trade missed by other projects. For example, oats were shipped to the US and NS from a dozen small harbours, and to Newfoundland from thirteen — meaning every one of the Island's harbours except Tignish shipped oats directly to Newfoundland to fuel the colony's horses.

**Plate C** sets the map aside and focuses on the commodities themselves. It is a zoomable sunburst diagram that breaks down the full value of trade by commodity category, using the Standard International Trade Classification (SITC) hierarchy from broad category down to individual goods. The SITC grouping allows us to quickly generalize the nature of the Island's trade. A recent article in *Historical Methods* (Hungerland and Altmeppen, 54(2) 2021) makes the case for using SITC in historical analysis. However, some drawbacks include the abstract nature of the division descriptions (e.g., both oats and mackerel fall under SITC Section 0: "Food and live animals"), and difficulties placing commodities that have become more obscure over the last century and a half. Some goods remain in an "other" category while we consider where to assign them — examples include resin, tar, chains, and anchor imports, which were obviously key to shipbuilding but don't fit neatly into the default SITC sections.

## Sources

The data come from the colonial Blue Books — annual statistical returns compiled by the PEI colonial government and submitted to the Colonial Office in London. The trade returns within them recorded the goods, quantities (in a wide variety of units), values (in pounds sterling), and origins or destinations of imports and exports for each of the Island's customs harbours. Transcriptions currently cover the trade years **1857 to 1865**; additional years are under development that will extend the dataset through **1873**, the year of the final Blue Book before PEI's entry into Confederation. We will also return to one of the earliest comparable Blue Books (1852), which was the only year to appear in the *Historical Atlas of Canada* — in what may be the only plate examining intercolonial trade in the region (David A. Sutherland, "Trade to Mid Century," Plate 15, Vol. II).

## Status

This is a work in progress. Areas under active development include:
- Expanding year coverage from 1851 to 1873
- Verifying sterling value conversions
- Completing data entry on export quantities
- Resolving SITC classifications for obscure historical commodities

## Team

Developed by the [GeoREACH Lab](https://www.upei.ca/GeoLab) at the University of Prince Edward Island, with contributions from Ryan Snyder ([@r-snyder](https://github.com/r-snyder)).
