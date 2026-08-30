# Product photography

Drop a JPEG here named for the product code and it replaces the generated
artwork for that variant:

    public/products/0106046.jpg    ->  WWI Bluetooth Headphones X250 Black

Product codes are the `productCode` field in `src/ui/public/sample-products.ts`
(and, once `/api/query` serves the catalogue, the same column from
`data/gold/dim_product.parquet`).

- **8:5 aspect.** Cards and the detail page both render `aspect-[8/5]` with
  `object-cover`, so anything else is cropped from the centre.
- **One file per colourway, not per family.** The colour is the point: a
  nine-colour camera is one product here, and switching swatch has to visibly
  change the picture.
- **Missing is fine.** No file means `ProductImage` draws the generated
  artwork instead, so photography can land one product at a time.

## A caution on what you photograph

These products carry Microsoft's fictional sample brands - Contoso, Wide World
Importers, Northwind Traders, Litware. The challenge rules ask for no
third-party trademarks in the submission video, so a photograph of real,
identifiable hardware sitting under one of those names is the case that rule is
about. Product-neutral studio shots with no visible maker's mark stay clear of
it.
