/**
 * Seed identifiers, kept in a module of their own with no content in it.
 *
 * The admin screen needs to name which seed it is asking the server to import.
 * Importing that name from the seed files themselves would pull 105 requirement
 * rows and 17 answer keys into the browser bundle, so the versions live here.
 */
export const BLUEPRINT_SEED_VERSION = "2026-09-03.1";
export const PUBLIC_SEED_VERSION = "2026-09-02.1";
