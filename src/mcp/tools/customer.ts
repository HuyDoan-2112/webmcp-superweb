// manage_cart, manage_wishlist, send_enquiry.
//
// All three sit on the public surface, alongside the catalogue and the
// promotions tools. Nothing here is refused to an anonymous visitor: a cart
// and a wishlist need no identity at all, and send_enquiry is refused only
// because there is nowhere to attribute the question, never because the
// visitor lacks permission.
//
// EVERY LINE THESE TOOLS WRITE COMES FROM readProduct, THE SAME LOOKUP
// get_product USES. Resolving "0106046" or "Contoso Coffee Maker" to a
// productKey is resolveProduct from catalog.ts, reused rather than
// reimplemented, so a cart line and a get_product answer can never disagree
// about what an identifier means.
//
// One tool per capability, chosen by an action argument, the same shape
// list_promotions's sibling tools would have taken if the codebase had picked
// a single mega-tool there. Four verbs (add, set_quantity, remove, view) or
// three (add, remove, view) is well inside the range an agent can hold, and a
// separate add_to_cart / remove_from_cart / view_cart set would only have
// forced three schemas to agree on the same product argument.
//
// NOTHING HERE IS FABRICATED. The cart, the wishlist and the enquiry queue are
// exactly what src/store.ts already promises: real actions taken in this
// session, nothing seeded.

import {
  addToCart,
  getState,
  sendEnquiry,
  setCartQuantity,
  toggleWishlist,
} from "@/store";
import { NO_PRODUCTS_ENDPOINT, readProduct } from "../api";
import { resolveProduct } from "./catalog";
import { text, type ToolSpec } from "../adapter";
import { stamp, textWithData } from "../structured";

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** Disclose a guess the way get_product does, or nothing when the hit was exact. */
function guessNotice(guessedFrom: string | undefined, name: string, code: string): string {
  return guessedFrom
    ? `Nothing is identified by "${guessedFrom}" exactly. This is the closest ` +
        `text match, ${name} (${code}), not a confirmed hit. Check with ` +
        `search_products if that is not the product you meant.\n\n`
    : "";
}

// ------------------------------------------------------------- manage_cart

const CART_ACTIONS = ["add", "set_quantity", "remove", "view"] as const;
type CartAction = (typeof CART_ACTIONS)[number];

function cartSummary(): { lines: string; total: number; count: number } {
  const cart = getState().cart;
  const total = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const lines = cart
    .map(
      (l) =>
        `${l.productCode}  ${l.name} (${l.color})  qty ${l.quantity}  ` +
        `${money(l.price)} each  ${money(l.price * l.quantity)}`,
    )
    .join("\n");
  return { lines, total, count: cart.length };
}

function manageCart(): ToolSpec {
  return {
    name: "manage_cart",
    title: "Add to, change or view the cart",
    description:
      "Add a product to the visitor's cart, change a line's quantity, remove " +
      "a line, or read back what is in it, chosen by the action argument. " +
      "This moves the same cart the page shows, so what you report is what " +
      "the visitor sees. Takes a product code, product key or exact product " +
      "name for add, set_quantity and remove; view needs nothing else.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [...CART_ACTIONS],
          description:
            "add: put a product in the cart, or raise its quantity if it is " +
            "already there. set_quantity: set a line to an exact quantity, " +
            "zero removes it. remove: take a line out entirely. view: read " +
            "back the whole cart.",
        },
        product: {
          type: "string",
          description:
            'Product code such as "0106046", the numeric product key, or the ' +
            "exact product name. Required for add, set_quantity and remove. " +
            "Ignored for view.",
        },
        quantity: {
          type: "number",
          minimum: 0,
          description:
            "How many. Defaults to 1 for add. Required for set_quantity, " +
            "where zero removes the line the same as remove. Ignored for " +
            "remove and view.",
        },
      },
      required: ["action"],
    },
    // Not read only: add, set_quantity and remove all call a store setter that
    // changes what the cart page renders. view alone changes nothing, but one
    // tool gets one annotation, and the honest one is the one that covers
    // every action it can take.
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (args) => {
      const action = String(args.action ?? "") as CartAction;
      if (!CART_ACTIONS.includes(action)) {
        return text(
          `"${args.action}" is not a cart action. Use add, set_quantity, ` +
            `remove or view.`,
        );
      }

      if (action === "view") {
        const { lines, total, count } = cartSummary();
        return textWithData(
          count === 0
            ? "The cart is empty."
            : `${count} line${count === 1 ? "" : "s"} in the cart, total ` +
              `${money(total)}.\n\n${lines}`,
          { tool: "manage_cart", action, lineCount: count, cartTotal: total },
        );
      }

      const identifier = String(args.product ?? "").trim();
      if (identifier === "") {
        return text(
          `No product was named, so nothing changed. Call search_products ` +
            `first to find a code, then pass it to manage_cart.`,
        );
      }

      const resolution = await resolveProduct(identifier);
      if (resolution.kind === "unreachable") return text(NO_PRODUCTS_ENDPOINT);
      if (resolution.kind === "missing") {
        return text(
          `Nothing in the catalogue is identified by "${identifier}", so ` +
            `nothing changed. Call search_products with a looser keyword to ` +
            `find the code, then try again.`,
        );
      }

      const { product } = resolution.detail;
      const guess = guessNotice(
        resolution.guessedFrom,
        product.productName,
        product.productCode,
      );

      if (action === "add") {
        let quantity = 1;
        if (typeof args.quantity === "number") {
          quantity = Math.trunc(args.quantity);
          if (quantity < 1) {
            return text(
              `quantity for add must be at least 1, got ${args.quantity}. ` +
                `Call manage_cart with action remove to take a line out ` +
                `instead.`,
            );
          }
        }
        addToCart(
          {
            productKey: product.productKey,
            productCode: product.productCode,
            name: product.productName,
            color: product.color,
            price: product.price,
          },
          quantity,
        );
      } else if (action === "set_quantity") {
        if (typeof args.quantity !== "number") {
          return text(
            `set_quantity needs a quantity, so nothing changed. Zero removes ` +
              `the line.`,
          );
        }
        setCartQuantity(product.productKey, Math.trunc(args.quantity));
      } else {
        setCartQuantity(product.productKey, 0);
      }

      const { lines, total, count } = cartSummary();
      const nowLine = getState().cart.find(
        (l) => l.productKey === product.productKey,
      );
      const verbed =
        action === "add"
          ? `Added ${product.productName} (${product.productCode}), now ` +
            `${nowLine?.quantity ?? 0} in the cart`
          : action === "remove"
            ? `Removed ${product.productName} (${product.productCode})`
            : nowLine
              ? `Set ${product.productName} (${product.productCode}) to ` +
                `${nowLine.quantity}`
              : `Removed ${product.productName} (${product.productCode}), ` +
                `quantity was set to zero`;

      return textWithData(
        `${guess}${verbed}.\n\nThe cart now has ${count} line` +
          `${count === 1 ? "" : "s"}, total ${money(total)}.\n\n` +
          (count > 0 ? `${lines}\n\n` : "") +
          `Call manage_cart with action view at any point to read it back.`,
        {
          tool: "manage_cart",
          action,
          productKey: product.productKey,
          productCode: product.productCode,
          quantity: nowLine?.quantity ?? 0,
          lineCount: count,
          cartTotal: total,
        },
      );
    },
  };
}

// -------------------------------------------------------- manage_wishlist

const WISHLIST_ACTIONS = ["add", "remove", "view"] as const;
type WishlistAction = (typeof WISHLIST_ACTIONS)[number];

function manageWishlist(): ToolSpec {
  return {
    name: "manage_wishlist",
    title: "Add to, remove from or view the wishlist",
    description:
      "Add a product to the visitor's wishlist, take one off, or read back " +
      "what is on it, chosen by the action argument. This moves the same " +
      "wishlist the page shows. Adding a product already on the list, or " +
      "removing one that is not, changes nothing and says so rather than " +
      "toggling by surprise.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [...WISHLIST_ACTIONS],
          description:
            "add: put a product on the wishlist. remove: take it off. view: " +
            "read back the whole list.",
        },
        product: {
          type: "string",
          description:
            'Product code such as "0106046", the numeric product key, or the ' +
            "exact product name. Required for add and remove. Ignored for view.",
        },
      },
      required: ["action"],
    },
    // Not read only: add and remove call toggleWishlist, which changes what
    // the page's wishlist renders. view alone changes nothing, same reasoning
    // as manage_cart above.
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (args) => {
      const action = String(args.action ?? "") as WishlistAction;
      if (!WISHLIST_ACTIONS.includes(action)) {
        return text(
          `"${args.action}" is not a wishlist action. Use add, remove or view.`,
        );
      }

      if (action === "view") {
        const keys = getState().wishlist;
        if (keys.length === 0) {
          return textWithData("The wishlist is empty.", {
            tool: "manage_wishlist",
            action,
            count: 0,
          });
        }
        const details = await Promise.all(keys.map((k) => readProduct(k)));
        const rows = details
          .map((d, i) =>
            d
              ? `${d.product.productCode}  ${d.product.productName} ` +
                `(${d.product.color})  ${money(d.product.price)}`
              : `productKey ${keys[i]}  (no longer in the catalogue)`,
          )
          .join("\n");
        return textWithData(
          `${keys.length} product${keys.length === 1 ? "" : "s"} on the ` +
            `wishlist.\n\n${rows}\n\nCall get_product with any code above to ` +
            `open it on the page.`,
          {
            tool: "manage_wishlist",
            action,
            count: keys.length,
            productKeys: keys,
          },
        );
      }

      const identifier = String(args.product ?? "").trim();
      if (identifier === "") {
        return text(
          `No product was named, so nothing changed. Call search_products ` +
            `first to find a code, then pass it to manage_wishlist.`,
        );
      }

      const resolution = await resolveProduct(identifier);
      if (resolution.kind === "unreachable") return text(NO_PRODUCTS_ENDPOINT);
      if (resolution.kind === "missing") {
        return text(
          `Nothing in the catalogue is identified by "${identifier}", so ` +
            `nothing changed. Call search_products with a looser keyword to ` +
            `find the code, then try again.`,
        );
      }

      const { product } = resolution.detail;
      const guess = guessNotice(
        resolution.guessedFrom,
        product.productName,
        product.productCode,
      );
      const already = getState().wishlist.includes(product.productKey);

      if (action === "add" && already) {
        return textWithData(
          `${guess}${product.productName} (${product.productCode}) is ` +
            `already on the wishlist. Nothing changed.`,
          {
            tool: "manage_wishlist",
            action,
            productKey: product.productKey,
            changed: false,
            onWishlist: true,
          },
        );
      }
      if (action === "remove" && !already) {
        return textWithData(
          `${guess}${product.productName} (${product.productCode}) is not ` +
            `on the wishlist. Nothing changed.`,
          {
            tool: "manage_wishlist",
            action,
            productKey: product.productKey,
            changed: false,
            onWishlist: false,
          },
        );
      }

      toggleWishlist(product.productKey);
      const onWishlist = action === "add";
      return textWithData(
        `${guess}${onWishlist ? "Added" : "Removed"} ` +
          `${product.productName} (${product.productCode}) ` +
          `${onWishlist ? "to" : "from"} the wishlist.\n\n` +
          `Call manage_wishlist with action view to read the whole list back.`,
        {
          tool: "manage_wishlist",
          action,
          productKey: product.productKey,
          changed: true,
          onWishlist,
        },
      );
    },
  };
}

// ----------------------------------------------------------- send_enquiry

function sendEnquiryTool(): ToolSpec {
  return {
    name: "send_enquiry",
    title: "Send a question to Kestrel Supply Co.",
    description:
      "Send a question from the signed-in customer to Kestrel Supply Co., " +
      "optionally about one product. Only works while a customer is signed " +
      "in, because an enquiry with nobody to answer is not one. Signing in " +
      "is the visitor's own move: if nobody is signed in, this tool refuses " +
      "and says so rather than inventing an identity to send as.",
    inputSchema: {
      type: "object",
      properties: {
        product: {
          type: "string",
          description:
            "Optional product code, product key or exact product name this " +
            "question is about. Omit for a general question.",
        },
        message: {
          type: "string",
          description: "The question, in the visitor's own words.",
        },
      },
      required: ["message"],
    },
    // Not read only: it writes a new enquiry into the store, which is what
    // list_enquiries on the internal surface reads. untrustedContentHint true
    // because the reply can carry a product name, which is supplier copy.
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (args) => {
      const customer = getState().customer;
      if (!customer) {
        return text(
          "No customer is signed in, so there is nowhere to send this " +
            "enquiry from. Signing in is the visitor's own move, not " +
            "something this tool can do for them: ask them to sign in on the " +
            "page, then call send_enquiry again.",
        );
      }

      const message = String(args.message ?? "").trim();
      if (message === "") {
        return text(
          "No message was given, so nothing was sent. Pass the question in " +
            "message.",
        );
      }

      let productKey: number | undefined;
      let productName: string | undefined;
      let guess = "";

      const identifier = String(args.product ?? "").trim();
      if (identifier !== "") {
        const resolution = await resolveProduct(identifier);
        if (resolution.kind === "unreachable") return text(NO_PRODUCTS_ENDPOINT);
        if (resolution.kind === "missing") {
          return text(
            `Nothing in the catalogue is identified by "${identifier}", so ` +
              `the enquiry was not sent. Call search_products to find the ` +
              `code, then try again, or omit product for a general question.`,
          );
        }
        productKey = resolution.detail.product.productKey;
        productName = resolution.detail.product.productName;
        guess = guessNotice(
          resolution.guessedFrom,
          productName,
          resolution.detail.product.productCode,
        );
      }

      const enquiry = sendEnquiry({
        customerName: customer.name,
        productKey: productKey ?? null,
        productName: productName ?? null,
        message,
      });

      return textWithData(
        `${guess}Enquiry sent as ${customer.name}` +
          (productName ? ` about ${productName}` : "") +
          `. Kestrel Supply Co. has not answered it yet.`,
        {
          tool: "send_enquiry",
          enquiryId: enquiry.id,
          customerName: enquiry.customerName,
          productKey,
          productName,
          sentUtc: enquiry.sentUtc,
          answered: enquiry.answered,
          ...stamp(),
        },
      );
    },
  };
}

/** The three customer tools an anonymous visitor's agent gets. */
export function customerTools(): ToolSpec[] {
  return [manageCart(), manageWishlist(), sendEnquiryTool()];
}
