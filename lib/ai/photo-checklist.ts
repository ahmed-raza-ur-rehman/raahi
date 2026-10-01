/**
 * The photo checklist, kept in its own leaf module on purpose.
 *
 * `lib/ai/vision.ts` imports the model SDK; the photo capture screen is a
 * client component. Importing this list from there would drag the SDK into the
 * browser bundle for the sake of six sentences.
 *
 * Anything the browser needs must live here, with no server-only imports.
 */

export const PHOTO_CHECKLIST = [
  "Place the document on a flat, plain surface in daylight.",
  "Fill the frame with the document — no table edges.",
  "Make sure all four corners are visible.",
  "Avoid glare: do not use flash directly on laminated cards.",
  "Check that every word is readable before you press save.",
  "Never photograph a document for someone else without their permission.",
];
