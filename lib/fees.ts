// Single source of truth for the platform fee rate.
// Kept in its own file so both the Stripe client and the DB layer can import it
// without coupling to the Stripe SDK.
export const PLATES_FEE_PERCENT = 0.15; // adjust to your actual take rate