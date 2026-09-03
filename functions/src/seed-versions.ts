/**
 * Seed identifiers, kept in a module of their own with no content in it.
 *
 * The admin screen needs to name which seed it is asking the server to import.
 * Importing that name from the seed files themselves would pull every requirement
 * row and every answer key into the browser bundle, so the versions live here.
 * Both strings change whenever the seed they name changes, so an administrator
 * cannot ask a server holding older content to import what they are looking at.
 */
export const BLUEPRINT_SEED_VERSION = "2026-09-03.1";
export const PUBLIC_SEED_VERSION = "2026-09-03.1";
