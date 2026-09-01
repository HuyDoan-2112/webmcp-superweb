// Kestrel-authored product profiles, keyed by subcategory.
//
// READ THIS BEFORE ADDING ONE. These are the shop's own illustrative notes.
// They are NOT manufacturer specifications, NOT measurements, and NOT a
// prediction of what a product will do. The catalogue carries price, colour,
// weight, brand and category and nothing else: there is no sensor size, no
// aperture, no wattage and no decibel figure anywhere in dim_product. Writing
// one here and letting a tool return it would be inventing a number, which is
// the single thing this project exists to refuse.
//
// So every profile says what Kestrel thinks the thing suits, in words, and
// every tool response carries the limitations block below. A reader who wants
// measured data has to go to the manufacturer, and the tool says so.
//
// Keyed by subcategory rather than by product because 885 products cannot be
// authored by hand and a per-product table would be 885 opportunities to state
// something specific that nothing backs. A subcategory claim is the honest
// grain: "digital SLRs separate a subject from its background" is true of the
// class, and the tool never pretends it measured this unit.

/** The character traits. Free-form per subcategory, always words, never numbers. */
export type Profile = {
  /** One line on what this class of product is for. */
  useFor: string;
  /** Named traits. For cameras these are the fields an image edit can act on. */
  character: Record<string, string>;
  /** What Kestrel would tell someone to think about before buying. */
  watchFor: string;
  /** Optional styling suggestions. See the note on Look. */
  looks?: Look[];
};

/**
 * A named treatment the shop suggests, not something the hardware does.
 *
 * This is the one place Kestrel is allowed to be evocative, because taste is
 * the thing a shop legitimately has. "Late-70s film" is a styling opinion in
 * the same way a paint chart is, and nobody reads a paint chart as a
 * measurement. What it must never become is a claim that the camera produces
 * this look: the treatment is applied afterwards, to a photograph the person
 * already took, and the tool says so every time it returns one.
 *
 * The field names are the vocabulary a photo editor understands, so a look can
 * be handed to an image model without anyone translating it first.
 */
export type Look = {
  /** Short name a person would choose from a menu. */
  name: string;
  /** When Kestrel would reach for it. */
  whenToUse: string;
  /** The adjustments themselves. Only ever qualities, never settings. */
  treatment: Record<string, string>;
};

export const LIMITATIONS = [
  "Kestrel-authored illustrative profile, not a manufacturer specification.",
  "Nothing here is measured. The catalogue records price, colour, weight, brand and category only.",
  "A real result changes with lighting, room, settings and the rest of the setup.",
] as const;

/** Version stamp, so a caller can tell two profiles apart if these are rewritten. */
export const PROFILE_VERSION = "kestrel-authored-1";

const PROFILES: Record<string, Profile> = {
  // ---------------------------------------------------------------- cameras
  //
  // These four carry the fields an image edit acts on, because a camera is the
  // one category where "what will my photo look like" is the actual question.
  // The names match the vocabulary a photo editor understands, so a recipe can
  // be handed to an image model without translation.
  "Digital SLR Cameras": {
    useFor: "Portraits and anything where the subject should lift off the background.",
    character: {
      depthOfField: "shallow, strong subject separation",
      colour: "neutral, with gently warm skin tones",
      contrast: "medium-low, holds detail in shadow",
      highlightRolloff: "soft, highlights fall away rather than clipping",
      grain: "very low",
      sharpness: "natural, detailed without looking processed",
    },
    watchFor: "Bigger and heavier than a compact, and the look depends on the lens.",
    looks: [
      {
        name: "Late-70s film",
        whenToUse: "Warm afternoon light, and you want the photo to feel remembered rather than taken.",
        treatment: {
          colour: "warm cast, greens pulled towards olive, skin slightly golden",
          contrast: "lifted blacks, nothing reaches pure black",
          highlightRolloff: "very soft, highlights bloom before they clip",
          grain: "visible, fine, evenly spread",
          sharpness: "slightly soft, no digital edge",
          border: "none",
        },
      },
      {
        name: "Photobooth strip",
        whenToUse: "Faces close to the camera, and you want it to feel like a night out rather than a portrait.",
        treatment: {
          colour: "cool and slightly green, unflattering on purpose",
          contrast: "high, blacks crushed",
          highlightRolloff: "hard, direct flash falls off fast",
          grain: "coarse",
          sharpness: "high in the centre, falling off at the edges",
          vignette: "heavy, corners going dark",
        },
      },
      {
        name: "Cold documentary",
        whenToUse: "Grey weather, and you want the picture to look observed rather than arranged.",
        treatment: {
          colour: "desaturated, blue shadows, no warmth added",
          contrast: "medium, full tonal range",
          highlightRolloff: "neutral",
          grain: "low",
          sharpness: "high, detail everywhere",
        },
      },
      {
        name: "Yearbook 2004",
        whenToUse: "Deliberately unglamorous, and funnier for it.",
        treatment: {
          colour: "flat, slightly magenta, studio-lit",
          contrast: "low, everything evenly bright",
          highlightRolloff: "abrupt",
          grain: "none",
          sharpness: "over-sharpened, edges standing out",
        },
      },
    ],
  },
  "Digital Cameras": {
    useFor: "Carrying every day, and group shots where everyone should be in focus.",
    character: {
      depthOfField: "moderate, some separation but most of the scene sharp",
      colour: "bright and slightly saturated",
      contrast: "medium",
      highlightRolloff: "moderate",
      grain: "low in daylight, more noticeable indoors",
      sharpness: "crisp",
    },
    watchFor: "Less background blur than an SLR, and less latitude in low light.",
    looks: [
      {
        name: "Disposable camera",
        whenToUse: "Anything you want to look unplanned.",
        treatment: {
          colour: "heavy warm cast, reds pushed",
          contrast: "high, blacks blocked up",
          highlightRolloff: "hard, flash-lit subjects blown out at the front",
          grain: "coarse and uneven",
          sharpness: "soft at the edges",
          vignette: "moderate",
        },
      },
      {
        name: "Bright and modern",
        whenToUse: "The photo people will actually put on a wall.",
        treatment: {
          colour: "clean, faintly cool, true skin tones",
          contrast: "medium, open shadows",
          highlightRolloff: "smooth",
          grain: "none",
          sharpness: "crisp but not harsh",
        },
      },
      {
        name: "Overcast film",
        whenToUse: "Flat outdoor light that would otherwise look like nothing.",
        treatment: {
          colour: "muted, gentle green in the shadows",
          contrast: "low, soft throughout",
          highlightRolloff: "very soft",
          grain: "fine",
          sharpness: "natural",
        },
      },
    ],
  },
  Camcorders: {
    useFor: "Long continuous recording, where a stills camera would overheat or stop.",
    character: {
      depthOfField: "deep, most of the frame stays sharp",
      colour: "neutral, tuned for motion rather than a single frame",
      contrast: "medium-low",
      highlightRolloff: "soft",
      grain: "low",
      sharpness: "moderate, favouring smooth motion over fine detail",
    },
    watchFor: "Built for video. A still pulled from it will not match a stills camera.",
    looks: [
      {
        name: "Home video 1998",
        whenToUse: "You want it to look like it was recorded, not photographed.",
        treatment: {
          colour: "washed, slightly yellow, low saturation",
          contrast: "low, milky blacks",
          highlightRolloff: "smeared",
          grain: "video noise rather than film grain, visible in shadow",
          sharpness: "soft, slight horizontal smear",
          aspect: "unchanged",
        },
      },
      {
        name: "Handheld documentary",
        whenToUse: "A moment caught rather than composed.",
        treatment: {
          colour: "neutral, unretouched",
          contrast: "medium",
          highlightRolloff: "moderate",
          grain: "low",
          sharpness: "moderate",
        },
      },
    ],
  },
  "Cameras & Camcorders Accessories": {
    useFor: "Filling a gap in a kit you already own.",
    character: {
      compatibility: "depends entirely on the body it is attached to",
    },
    watchFor: "Check the mount and the model before buying. An accessory has no look of its own.",
  },

  // ------------------------------------------------------------------ audio
  "Bluetooth Headphones": {
    useFor: "Listening without a cable, on the move or at a desk.",
    character: {
      sound: "warm, with lifted bass",
      isolation: "moderate, closed-back",
      wearing: "over-ear, heavier than earbuds",
    },
    watchFor: "Bluetooth adds latency, which is noticeable when watching video.",
  },
  "MP4&MP3": {
    useFor: "Music without a phone, on a run or where a phone is not wanted.",
    character: {
      sound: "neutral, dependent on the headphones plugged into it",
      storage: "fixed onboard capacity, no streaming",
    },
    watchFor: "Files have to be loaded onto it. There is no library service behind it.",
  },
  "Recording Pen": {
    useFor: "Capturing a lecture or a meeting without a visible microphone.",
    character: {
      sound: "speech-focused, thin on music",
      pickup: "close range, best within a metre or two",
    },
    watchFor: "Recording people needs their consent, and in many places their explicit consent.",
  },

  // -------------------------------------------------------------- computers
  Laptops: {
    useFor: "Working in more than one place.",
    character: {
      portability: "carried daily",
      tradeoff: "less performance per pound than a desktop of the same price",
    },
    watchFor: "Memory and storage are often fixed at purchase. Buy the size you will need.",
  },
  Desktops: {
    useFor: "One place, more performance for the money, easier to upgrade.",
    character: {
      portability: "none",
      tradeoff: "more performance and more room to expand",
    },
    watchFor: "A screen, keyboard and mouse are usually separate purchases.",
  },
  Monitors: {
    useFor: "More screen than a laptop can give you.",
    character: {
      posture: "raises the screen to eye level, which is most of the benefit",
    },
    watchFor: "Check the connector on the machine you own before buying.",
  },
  "Printers, Scanners & Fax": {
    useFor: "Paper, when paper is unavoidable.",
    character: {
      runningCost: "consumables usually cost more over time than the unit did",
    },
    watchFor: "Compare the price of the cartridges, not just the price of the printer.",
  },
  "Projectors & Screens": {
    useFor: "A large image in a room you can darken.",
    character: {
      image: "very large, and dependent on ambient light",
    },
    watchFor: "Room light matters more than any other factor. Bright rooms wash out the picture.",
  },
  "Computers Accessories": {
    useFor: "Filling a gap in a setup you already have.",
    character: {
      compatibility: "depends on the machine it is attached to",
    },
    watchFor: "Check the port and the operating system before buying.",
  },

  // ---------------------------------------------------------- games and toys
  "Boxed Games": {
    useFor: "Playing in a room with other people, no screen required.",
    character: {
      players: "printed on the box, and worth reading",
      session: "one sitting",
    },
    watchFor: "The player count on the box is the range it works at, not the range it is best at.",
  },
  "Download Games": {
    useFor: "Playing on hardware you already own.",
    character: {
      delivery: "a licence, not a disc",
    },
    watchFor: "Check the platform and the age rating. A download is rarely returnable.",
  },

  // -------------------------------------------------------- home appliances
  Refrigerators: {
    useFor: "Daily food storage, sized to a household.",
    character: {
      noise: "constant and low",
      placement: "needs clearance at the back and sides",
    },
    watchFor: "Measure the doorway as well as the gap it has to stand in.",
  },
  "Washers & Dryers": {
    useFor: "Laundry at home rather than at a laundrette.",
    character: {
      noise: "loud during the spin",
      plumbing: "needs a supply and a drain",
    },
    watchFor: "A dryer needs either a vent or somewhere for the condensate to go.",
  },
  Microwaves: {
    useFor: "Reheating quickly.",
    character: {
      speed: "fast",
      result: "even heating depends on the food, not the unit",
    },
    watchFor: "Internal capacity matters more than the outside dimensions.",
  },
  "Coffee Machines": {
    useFor: "Coffee at home instead of a shop.",
    character: {
      routine: "adds a daily cleaning step",
    },
    watchFor: "The cost of whatever it takes, beans, pods or grounds, outruns the machine.",
  },
  "Air Conditioners": {
    useFor: "Cooling one room.",
    character: {
      noise: "noticeable, and worse at night than expected",
      placement: "needs a window or an exhaust route",
    },
    watchFor: "Size it to the room. Too large cycles on and off and cools unevenly.",
  },
  Fans: {
    useFor: "Moving air, which is not the same as cooling it.",
    character: {
      noise: "low to moderate",
      effect: "moves air, does not lower room temperature",
    },
    watchFor: "A fan makes a room feel cooler without making it cooler.",
  },
  "Water Heaters": {
    useFor: "Hot water, either stored or on demand.",
    character: {
      installation: "usually not a job for the buyer",
    },
    watchFor: "Check what the property already has before choosing a type.",
  },
  Lamps: {
    useFor: "Light in one part of a room rather than all of it.",
    character: {
      light: "directional, warm unless the bulb says otherwise",
      mood: "a lamp changes a room more than its price suggests",
    },
    watchFor: "The bulb decides the colour of the light, and it is often sold separately.",
  },

  // ----------------------------------------------------------- tv and video
  Televisions: {
    useFor: "Watching in a room where people sit at a distance.",
    character: {
      picture: "neutral out of the box, most sets ship in a showroom mode that is too bright",
      viewing: "size should follow the seating distance",
    },
    watchFor: "Turn off the shop display mode on the first day. It is not what the picture looks like.",
    looks: [
      {
        name: "Filmmaker",
        whenToUse: "Watching a film in a dark room, the way it was graded.",
        treatment: {
          colour: "accurate, warm white point",
          contrast: "medium, shadow detail preserved",
          sharpness: "no artificial edge enhancement",
          motion: "no frame interpolation",
        },
      },
      {
        name: "Showroom",
        whenToUse: "Never, at home. Included because this is what a set ships in.",
        treatment: {
          colour: "oversaturated, blue white point",
          contrast: "very high, shadows crushed",
          sharpness: "heavily enhanced, halos on edges",
          motion: "interpolated, gives film a soap-opera look",
        },
      },
    ],
  },
  "Home Theater System": {
    useFor: "Sound that a television's own speakers cannot produce.",
    character: {
      sound: "wide, with real low end",
      placement: "the room shapes the result as much as the equipment",
    },
    watchFor: "Speaker placement matters more than the price of the speakers.",
  },
  "VCD & DVD": {
    useFor: "Playing physical discs you already own.",
    character: {
      format: "disc based, no streaming",
    },
    watchFor: "Region coding still applies to discs bought abroad.",
  },
  "Car Video": {
    useFor: "Screens in a vehicle.",
    character: {
      installation: "usually professional",
    },
    watchFor: "Local law decides what a driver may see while moving.",
  },
};

/** The authored profile for a subcategory, or null when Kestrel has not written one. */
export function profileFor(subCategoryName: string): Profile | null {
  return PROFILES[subCategoryName] ?? null;
}

/** Every subcategory with a profile. Used to build the tool's own description. */
export function profiledSubcategories(): string[] {
  return Object.keys(PROFILES).sort();
}

/**
 * Looks Kestrel offers on any photograph, whatever camera took it.
 *
 * These are the shop's styling menu, not hardware behaviour. A photo lab has
 * always had a board like this on the wall, and nobody reads the board as a
 * claim about the film. The tool that returns one says so in the same breath.
 *
 * Written in image-editor vocabulary on purpose. An agent can hand a treatment
 * straight to an image model and get something recognisable, without anyone in
 * the middle inventing what "old movie" is supposed to mean.
 */
export const HOUSE_LOOKS: Look[] = [
  {
    name: "Silent film 1926",
    whenToUse: "You want the picture to look like it was found rather than taken.",
    treatment: {
      colour: "black and white, warm sepia tone throughout",
      contrast: "high, blown highlights, blocked shadows",
      highlightRolloff: "abrupt, no detail at the top",
      grain: "heavy, uneven, with fine vertical scratches",
      sharpness: "soft everywhere, softest at the corners",
      vignette: "strong, round, corners nearly black",
      frame: "slightly unsteady edges, as if projected",
    },
  },
  {
    name: "Technicolor 1955",
    whenToUse: "Bright clothes, staged pose, and you want the colour to shout.",
    treatment: {
      colour: "saturated primaries, red pushed hardest, skin pink rather than tan",
      contrast: "high with detail held in both ends",
      highlightRolloff: "firm",
      grain: "fine",
      sharpness: "high, glossy",
      halation: "soft red bloom around bright edges",
    },
  },
  {
    name: "Polaroid, ten minutes old",
    whenToUse: "A single subject, indoors, and you want it to feel like an object rather than a file.",
    treatment: {
      colour: "cool cast, greens towards cyan, skin slightly grey",
      contrast: "low, blacks lifted to charcoal",
      highlightRolloff: "very soft, highlights go milky",
      grain: "none, but a fine chemical mottle",
      sharpness: "low, focus falling off from centre",
      border: "thick white, wider along the bottom edge",
    },
  },
  {
    name: "Security camera, 3:14am",
    whenToUse: "You want it to look observed rather than photographed.",
    treatment: {
      colour: "near monochrome, faint green cast",
      contrast: "high, everything outside the light crushed to black",
      highlightRolloff: "hard, lit surfaces clipped white",
      grain: "coarse sensor noise, heavier in shadow",
      sharpness: "low, smeared where anything moved",
      overlay: "no text, no timestamp, no logo",
    },
  },
  {
    name: "Passport photo",
    whenToUse: "Funny precisely because it is joyless.",
    treatment: {
      colour: "flat, neutral, no warmth",
      contrast: "low, evenly lit, no modelling on the face",
      highlightRolloff: "flat",
      grain: "none",
      sharpness: "clinical",
      background: "plain pale grey, no shadow behind the subject",
    },
  },
  {
    name: "Nature documentary",
    whenToUse: "Anything outdoors that you want to look important.",
    treatment: {
      colour: "rich greens, deep blues, warm low sun",
      contrast: "medium-high, deep but open shadows",
      highlightRolloff: "smooth",
      grain: "none",
      sharpness: "very high, every texture readable",
    },
  },
  {
    name: "Photocopied twice",
    whenToUse: "Posters, zines, and anything meant to look cheaply reproduced.",
    treatment: {
      colour: "black and white only, no greys in the midtones",
      contrast: "extreme, tones collapsing to pure black or pure white",
      highlightRolloff: "none, hard threshold",
      grain: "speckled toner noise",
      sharpness: "ragged edges",
      artefacts: "faint horizontal banding",
    },
  },
  {
    name: "Cross-processed",
    whenToUse: "You want the colours to be wrong in a way that looks deliberate.",
    treatment: {
      colour: "shifted, cyan shadows and yellow highlights, skin unnatural",
      contrast: "very high",
      highlightRolloff: "hard",
      grain: "moderate",
      sharpness: "high",
      vignette: "moderate",
    },
  },
  {
    name: "Long exposure, wet street",
    whenToUse: "Night, city, and you want stillness rather than a snapshot.",
    treatment: {
      colour: "cool, with warm points where lights are",
      contrast: "high, deep blacks kept",
      highlightRolloff: "soft bloom around every light source",
      grain: "low",
      sharpness: "sharp where still, streaked where moving",
      reflections: "wet surfaces mirroring the lights above",
    },
  },
  {
    name: "Overhead flash, 1am",
    whenToUse: "Party photos. Unkind and honest.",
    treatment: {
      colour: "cool, slightly green, no warmth added",
      contrast: "very high, background falling to black",
      highlightRolloff: "hard, foreground skin blown out",
      grain: "moderate",
      sharpness: "high at the subject, nothing behind it",
      vignette: "heavy",
    },
  },
  {
    name: "Estate agent listing",
    whenToUse: "A room, made to look larger and brighter than it is.",
    treatment: {
      colour: "cool white balance, everything slightly blue",
      contrast: "low, shadows lifted until they are grey",
      highlightRolloff: "windows blown to pure white",
      grain: "none",
      sharpness: "over-sharpened, halos on the edges",
    },
  },
  {
    name: "Infrared",
    whenToUse: "Landscape, when you want it to stop looking like a landscape.",
    treatment: {
      colour: "foliage rendered white, sky rendered near black",
      contrast: "high",
      highlightRolloff: "soft glow on bright foliage",
      grain: "moderate",
      sharpness: "moderate, with a soft halo on bright areas",
    },
  },
];

/**
 * The looks offered for a subcategory: its own first, then the house menu.
 *
 * Empty for anything that is not a camera. A washing machine has no styling
 * treatments, and offering some would be the tool making things up again.
 */
export function looksFor(subCategoryName: string): Look[] {
  const own = PROFILES[subCategoryName]?.looks;
  if (!own) return [];
  return [...own, ...HOUSE_LOOKS];
}

/** One look by name, matched loosely, or null. Callers get exactly what the shop wrote. */
export function lookNamed(subCategoryName: string, name: string): Look | null {
  const wanted = name.trim().toLowerCase();
  return looksFor(subCategoryName).find((l) => l.name.toLowerCase() === wanted) ?? null;
}
