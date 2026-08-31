// The public interface, in five languages.
//
// Only the interface is translated. Product names, brand names, category names
// and colours come from the data and are shown exactly as the supplier records
// them, because a buyer searching for "Fabrikam Independent Filmmaker" needs to
// find it under that name in every language.
//
// The active locale is store state, not a header sniff. See the setter list in
// src/store.ts: a WebMCP tool sets it the same way the switcher does.

import type { Locale } from "@/store";

export const LOCALES: readonly Locale[] = ["en", "es", "fr", "de", "ja"];

/** Shown in the switcher. Every language names itself. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
};

/** BCP 47 tags for Intl. Currency stays USD everywhere; only the format moves. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  ja: "ja-JP",
};

export type StringKey = keyof typeof STRINGS.en;

const STRINGS = {
  en: {
    tradeCatalogue: "Trade catalogue",
    searchPlaceholder: "Search by name, product code or brand",
    searchLabel: "Search the catalogue",
    staffSignIn: "Staff sign in",
    languageLabel: "Language",

    category: "Category",
    brand: "Brand",
    clearFilters: "Clear filters",
    filters: "Filters",

    everything: "Everything we stock",
    productsShown: "{shown} of {total} products",
    loading: "loading",
    emptyTitle: "Nothing in stock matches",
    errorTitle: "Could not load the catalogue",
    emptyBody:
      "No line matches {filters}. Widen the search or drop a filter to see the rest of the catalogue.",
    currentView: "the current view",

    inStock: "In stock",
    lowStock: "Low stock",
    madeToOrder: "Made to order",

    backToCatalogue: "Catalogue",
    notFoundTitle: "We do not stock that line",
    notFoundBody:
      "Product {code} is not in the catalogue. It may have been discontinued, or the code may be wrong.",
    specifications: "Specifications",
    productCode: "Product code",
    manufacturer: "Manufacturer",
    subcategory: "Subcategory",
    colour: "Colour",
    weight: "Weight",
    priceNote: "Trade price per unit, excluding delivery.",
    relatedTitle: "More in {subcategory}",

    price: "Price",
    anyPrice: "Any price",
    priceUnder: "Under {max}",
    priceOver: "{min} and up",
    priceBetween: "{min} to {max}",
    priceFrom: "From {price}",

    allTab: "All",
    colourCount: "{count} colours",
    pageOf: "Page {page} of {pages}",
    previousPage: "Previous",
    nextPage: "Next",

    colourways: "Colourways",
    chooseColour: "Choose a colour",
    about: "About this product",
    composedNote:
      "Assembled from this line's catalogue record, field by field. Not supplier copy.",
    availabilityNote:
      "Illustrative. The catalogue records no stock level, so this is derived from the product code.",
    promoOnNow: "On now",
    promoFrom: "Starts {date}",
    composedOne:
      "{name} is a {subcategory} line from {brand}, made by {manufacturer} and listed under {category}.",
    composedOneSameMaker:
      "{name} is a {subcategory} line from {brand}, listed under {category}.",
    composedTwo:
      "This colourway is {colour}, weighs {weight}, carries product code {code} and lists at {price}.",
    composedColours: "The same product is stocked in {count} colours: {colours}.",
    composedOneColour: "This product is stocked in {colour} only.",

    footerNote:
      "Trade catalogue. Prices exclude delivery and are held for 30 days.",
  },

  es: {
    tradeCatalogue: "Catálogo profesional",
    searchPlaceholder: "Buscar por nombre, código o marca",
    searchLabel: "Buscar en el catálogo",
    staffSignIn: "Acceso del personal",
    languageLabel: "Idioma",

    category: "Categoría",
    brand: "Marca",
    clearFilters: "Borrar filtros",
    filters: "Filtros",

    everything: "Todo nuestro stock",
    productsShown: "{shown} de {total} productos",
    loading: "cargando",
    emptyTitle: "No hay stock que coincida",
    errorTitle: "No se pudo cargar el catalogo",
    emptyBody:
      "Ninguna línea coincide con {filters}. Amplía la búsqueda o quita un filtro para ver el resto del catálogo.",
    currentView: "la vista actual",

    inStock: "En stock",
    lowStock: "Pocas unidades",
    madeToOrder: "Bajo pedido",

    backToCatalogue: "Catálogo",
    notFoundTitle: "No trabajamos esa referencia",
    notFoundBody:
      "El producto {code} no está en el catálogo. Puede haberse descatalogado, o el código puede ser incorrecto.",
    specifications: "Especificaciones",
    productCode: "Código de producto",
    manufacturer: "Fabricante",
    subcategory: "Subcategoría",
    colour: "Color",
    weight: "Peso",
    priceNote: "Precio profesional por unidad, sin gastos de envío.",
    relatedTitle: "Más en {subcategory}",

    price: "Precio",
    anyPrice: "Cualquier precio",
    priceUnder: "Menos de {max}",
    priceOver: "{min} o más",
    priceBetween: "De {min} a {max}",
    priceFrom: "Desde {price}",

    allTab: "Todo",
    colourCount: "{count} colores",
    pageOf: "Página {page} de {pages}",
    previousPage: "Anterior",
    nextPage: "Siguiente",

    colourways: "Colores disponibles",
    chooseColour: "Elegir un color",
    about: "Sobre este producto",
    composedNote:
      "Redactado a partir de la ficha de catálogo de esta referencia, campo a campo. No es texto del proveedor.",
    availabilityNote:
      "Orientativo. El catálogo no registra existencias, por lo que se deriva del código de producto.",
    promoOnNow: "En curso",
    promoFrom: "Desde el {date}",
    composedOne:
      "{name} es una referencia de {subcategory} de {brand}, fabricada por {manufacturer} y clasificada en {category}.",
    composedOneSameMaker:
      "{name} es una referencia de {subcategory} de {brand}, clasificada en {category}.",
    composedTwo:
      "Esta versión es {colour}, pesa {weight}, lleva el código de producto {code} y cuesta {price}.",
    composedColours:
      "El mismo producto está disponible en {count} colores: {colours}.",
    composedOneColour: "Este producto solo está disponible en {colour}.",

    footerNote:
      "Catálogo profesional. Los precios no incluyen envío y se mantienen 30 días.",
  },

  fr: {
    tradeCatalogue: "Catalogue professionnel",
    searchPlaceholder: "Rechercher par nom, référence ou marque",
    searchLabel: "Rechercher dans le catalogue",
    staffSignIn: "Connexion personnel",
    languageLabel: "Langue",

    category: "Catégorie",
    brand: "Marque",
    clearFilters: "Effacer les filtres",
    filters: "Filtres",

    everything: "Tout notre stock",
    productsShown: "{shown} sur {total} produits",
    loading: "chargement",
    emptyTitle: "Aucun article ne correspond",
    errorTitle: "Impossible de charger le catalogue",
    emptyBody:
      "Aucune référence ne correspond à {filters}. Élargissez la recherche ou retirez un filtre pour voir le reste du catalogue.",
    currentView: "la vue actuelle",

    inStock: "En stock",
    lowStock: "Stock limité",
    madeToOrder: "Sur commande",

    backToCatalogue: "Catalogue",
    notFoundTitle: "Nous ne référençons pas cet article",
    notFoundBody:
      "Le produit {code} ne figure pas au catalogue. Il a peut-être été retiré, ou la référence est erronée.",
    specifications: "Caractéristiques",
    productCode: "Référence produit",
    manufacturer: "Fabricant",
    subcategory: "Sous-catégorie",
    colour: "Couleur",
    weight: "Poids",
    priceNote: "Prix professionnel à l'unité, hors livraison.",
    relatedTitle: "Plus dans {subcategory}",

    price: "Prix",
    anyPrice: "Tous les prix",
    priceUnder: "Moins de {max}",
    priceOver: "{min} et plus",
    priceBetween: "De {min} à {max}",
    priceFrom: "À partir de {price}",

    allTab: "Tout",
    colourCount: "{count} coloris",
    pageOf: "Page {page} sur {pages}",
    previousPage: "Précédent",
    nextPage: "Suivant",

    colourways: "Coloris",
    chooseColour: "Choisir un coloris",
    about: "À propos de ce produit",
    composedNote:
      "Rédigé à partir de la fiche catalogue de cette référence, champ par champ. Ce n'est pas un texte du fournisseur.",
    availabilityNote:
      "Indicatif. Le catalogue n'enregistre aucun stock, ceci est déduit du code produit.",
    promoOnNow: "En cours",
    promoFrom: "À partir du {date}",
    composedOne:
      "{name} est une référence {subcategory} de {brand}, fabriquée par {manufacturer} et classée dans {category}.",
    composedOneSameMaker:
      "{name} est une référence {subcategory} de {brand}, classée dans {category}.",
    composedTwo:
      "Ce coloris est {colour}, pèse {weight}, porte la référence produit {code} et coûte {price}.",
    composedColours:
      "Le même produit existe en {count} coloris : {colours}.",
    composedOneColour: "Ce produit n'existe qu'en {colour}.",

    footerNote:
      "Catalogue professionnel. Prix hors livraison, valables 30 jours.",
  },

  de: {
    tradeCatalogue: "Fachhandelskatalog",
    searchPlaceholder: "Nach Name, Artikelnummer oder Marke suchen",
    searchLabel: "Katalog durchsuchen",
    staffSignIn: "Mitarbeiter-Login",
    languageLabel: "Sprache",

    category: "Kategorie",
    brand: "Marke",
    clearFilters: "Filter zurücksetzen",
    filters: "Filter",

    everything: "Unser gesamtes Sortiment",
    productsShown: "{shown} von {total} Produkten",
    loading: "lädt",
    emptyTitle: "Kein Artikel passt dazu",
    errorTitle: "Katalog konnte nicht geladen werden",
    emptyBody:
      "Keine Position passt zu {filters}. Erweitern Sie die Suche oder entfernen Sie einen Filter, um den restlichen Katalog zu sehen.",
    currentView: "die aktuelle Ansicht",

    inStock: "Auf Lager",
    lowStock: "Geringer Bestand",
    madeToOrder: "Auf Bestellung",

    backToCatalogue: "Katalog",
    notFoundTitle: "Diese Position führen wir nicht",
    notFoundBody:
      "Artikel {code} ist nicht im Katalog. Er wurde möglicherweise ausgelistet, oder die Artikelnummer stimmt nicht.",
    specifications: "Technische Daten",
    productCode: "Artikelnummer",
    manufacturer: "Hersteller",
    subcategory: "Unterkategorie",
    colour: "Farbe",
    weight: "Gewicht",
    priceNote: "Händlerpreis pro Stück, zuzüglich Versand.",
    relatedTitle: "Mehr in {subcategory}",

    price: "Preis",
    anyPrice: "Jeder Preis",
    priceUnder: "Unter {max}",
    priceOver: "{min} und mehr",
    priceBetween: "{min} bis {max}",
    priceFrom: "Ab {price}",

    allTab: "Alle",
    colourCount: "{count} Farben",
    pageOf: "Seite {page} von {pages}",
    previousPage: "Zurück",
    nextPage: "Weiter",

    colourways: "Farben",
    chooseColour: "Farbe wählen",
    about: "Über dieses Produkt",
    composedNote:
      "Aus dem Katalogdatensatz dieser Position zusammengesetzt, Feld für Feld. Kein Herstellertext.",
    availabilityNote:
      "Richtwert. Der Katalog führt keinen Lagerbestand, dies wird aus dem Produktcode abgeleitet.",
    promoOnNow: "Läuft jetzt",
    promoFrom: "Ab {date}",
    composedOne:
      "{name} ist eine {subcategory}-Position von {brand}, hergestellt von {manufacturer} und geführt unter {category}.",
    composedOneSameMaker:
      "{name} ist eine {subcategory}-Position von {brand}, geführt unter {category}.",
    composedTwo:
      "Diese Farbe ist {colour}, wiegt {weight}, trägt die Artikelnummer {code} und kostet {price}.",
    composedColours:
      "Dasselbe Produkt ist in {count} Farben lieferbar: {colours}.",
    composedOneColour: "Dieses Produkt ist nur in {colour} lieferbar.",

    footerNote:
      "Fachhandelskatalog. Preise zuzüglich Versand, 30 Tage gültig.",
  },

  ja: {
    tradeCatalogue: "業務用カタログ",
    searchPlaceholder:
      "商品名、品番、ブランドで検索",
    searchLabel: "カタログを検索",
    staffSignIn: "社員ログイン",
    languageLabel: "言語",

    category: "カテゴリー",
    brand: "ブランド",
    clearFilters: "条件をクリア",
    filters: "絞り込み",

    everything: "全取扱商品",
    productsShown: "{total} 件中 {shown} 件",
    loading: "読み込み中",
    emptyTitle: "該当する商品がありません",
    errorTitle: "カタログを読み込めませんでした",
    emptyBody:
      "{filters} に一致する商品はありません。検索条件を広げるか、絞り込みを解除してください。",
    currentView: "現在の表示",

    inStock: "在庫あり",
    lowStock: "在庫わずか",
    madeToOrder: "受注生産",

    backToCatalogue: "カタログ",
    notFoundTitle:
      "お取り扱いのない品番です",
    notFoundBody:
      "品番 {code} はカタログにありません。廃番になったか、品番が誤っている可能性があります。",
    specifications: "仕様",
    productCode: "品番",
    manufacturer: "製造元",
    subcategory: "サブカテゴリー",
    colour: "カラー",
    weight: "重量",
    priceNote:
      "1個あたりの業務用価格（送料別）",
    relatedTitle: "{subcategory} の商品",

    price: "価格",
    anyPrice: "すべての価格",
    priceUnder: "{max} 未満",
    priceOver: "{min} 以上",
    priceBetween: "{min} 〜 {max}",
    priceFrom: "{price} から",

    allTab: "すべて",
    colourCount: "{count} 色",
    pageOf: "{pages} ページ中 {page} ページ",
    previousPage: "前へ",
    nextPage: "次へ",

    colourways: "カラー展開",
    chooseColour: "カラーを選ぶ",
    about: "この商品について",
    composedNote:
      "この品番のカタログ記録から項目ごとに組み立てた説明です。メーカーの宣伝文ではありません。",
    availabilityNote:
      "参考値。カタログに在庫情報はなく、製品コードから導いた表示です。",
    promoOnNow: "開催中",
    promoFrom: "{date} から",
    composedOne:
      "{name} は {brand} の {subcategory} 商品で、製造は {manufacturer}、分類は {category} です。",
    composedOneSameMaker:
      "{name} は {brand} の {subcategory} 商品で、分類は {category} です。",
    composedTwo:
      "このカラーは {colour}、重量は {weight}、品番は {code}、価格は {price} です。",
    composedColours: "同じ商品は {count} 色展開です: {colours}。",
    composedOneColour: "この商品は {colour} のみの展開です。",

    footerNote:
      "業務用カタログ。価格は送料別、30日間有効です。",
  },
} satisfies Record<Locale, Record<string, string>>;

/**
 * Look up one interface string, filling `{name}` slots.
 *
 * Each language keeps its own whole sentence rather than assembling one from
 * fragments, because word order is not the same in all five.
 */
export function t(
  locale: Locale,
  key: StringKey,
  vars?: Record<string, string | number>,
): string {
  const template = STRINGS[locale][key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}
