# Plates — Maps Update

This zip contains all files needed to add Google Maps to your Plates app.

## What's included

Five files, matching the folder structure of your GitHub repo:

- `components/MapView.tsx` **NEW** — reusable Google Map component
- `components/AddressAutocomplete.tsx` **NEW** — address search-as-you-type input
- `lib/db.ts` **REPLACE** — adds `prep_address` column + `updateUserAddress` function
- `app/api/users/route.ts` **REPLACE** — adds `updateAddress` action
- `app/page.tsx` **REPLACE** — wires up map view toggle, pickup map, and address autocomplete

## How to install

1. Extract this zip.
2. Open your local `Plates` repo folder (where GitHub Desktop is pointing).
3. Copy each file into the matching path in your repo:
   - `components/` folder is NEW — you'll be creating it at the top level of the repo
   - `lib/db.ts` **overwrites** your existing file
   - `app/api/users/route.ts` **overwrites** your existing file
   - `app/page.tsx` **overwrites** your existing file
4. Open GitHub Desktop — you should see 5 changed files
5. Commit with message: `Add Google Maps: discover map view, pickup map, address autocomplete`
6. Push origin

Vercel will auto-deploy. When it's live:

- **Discover feed** now has a List/Map toggle at the top of "Fresh from the block". Tap Map to see cook pins with prices.
- **Meal detail** now shows a small pickup map with a "Get directions" button that opens Google Maps.
- **Seller kitchen** now has an address autocomplete — type your address and pick from Google's suggestions. This saves both the address text AND the precise lat/lng, so pickup distance is accurate even if buyers didn't grant browser location permission.

## Prerequisite

Your `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` environment variable must be set in Vercel with the Maps JavaScript API, Places API, and Geocoding API all enabled. You already did this.
