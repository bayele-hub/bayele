// G7 / P3: the non-circumvention clause version. Sent as p_consent_version by request_partner_contact
// and recorded by record_consent('cgu_non_circumvention', …). Changing the clause = new version string
// = the one-time acknowledgement modal shows again. Matches ^[A-Za-z0-9._-]{1,20}$ (contract §7).
export const NON_CIRCUMVENTION_VERSION = '2026-10-14';
export const CONSENT_VERSION_RE = /^[A-Za-z0-9._-]{1,20}$/;
