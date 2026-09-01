# Product photography

The public range is the product codes in `data/meta/catalog-products.json`. Every
listed code has a matching JPEG here, so the storefront never advertises a
colourway that falls back to generated artwork.

To add a product, drop a JPEG here named for its product code and add the same
code to the manifest:

    public/products/0106046.jpg    ->  WWI Bluetooth Headphones X250 Black

Product codes are the `productCode` column of `data/gold/dim_product.parquet`,
served by `/api/products`. `curl "localhost:5173/api/products?limit=24"` lists
the codes on the first page of the grid.

- **4:3 aspect.** Cards and the detail page both render `aspect-[4/3]` with
  `object-cover`, so anything else is cropped from the centre.
- **One file per colourway, not per family.** The colour is the point: a
  nine-colour camera is one product here, and switching swatch has to visibly
  change the picture.
- **Missing is safe during development.** `ProductImage` still draws generated
  artwork when a file fails, but the committed catalogue should keep the
  manifest and JPEGs in lockstep.

## A caution on what you photograph

These products carry Microsoft's fictional sample brands - Contoso, Wide World
Importers, Northwind Traders, Litware. The challenge rules ask for no
third-party trademarks in the submission video, so a photograph of real,
identifiable hardware sitting under one of those names is the case that rule is
about. Product-neutral studio shots with no visible maker's mark stay clear of
it.
