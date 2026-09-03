# Product photos

This directory contains the 28 JPEGs used by the public catalogue.
`data/meta/catalog-products.json` lists the matching product codes. The
committed manifest and the filenames must stay identical.

Add a photo with the product code as its name, then add that code to the
manifest:

```text
public/products/0106046.jpg
```

The code comes from `product_code` in `data/gold/dim_product.parquet`.
`/api/products` exposes it as `productCode`.

Photo requirements:

- Use a 4:3 crop. Cards and product detail both use `aspect-[4/3]` with
  `object-cover`.
- Add one file per colourway. A family can have several product codes, and each
  swatch should change the photo.
- Use product-neutral studio photography with no visible third-party logo.

`ProductImage` draws a generated fallback while developing, but the committed
catalogue should never depend on it. Run the manifest check before committing:

```bash
node docs/validate-catalog.mjs
```

The catalogue uses fictional sample brands from Microsoft's Contoso dataset.
Do not pair those names with identifiable real hardware in the submission
video.
