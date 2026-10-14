/**
 * Columns a signed-in user may read on `profiles` (0035 column grant, D1/A1). Never `select('*')`:
 * phone_e164 is not granted, so a star select fails with 42501. Own phone → rpc('get_my_contact').
 */
export const PROFILE_COLUMNS = 'id, handle, display_name, avatar_url, bio, city, country, status, created_at, updated_at, resubmitted_at' as const;
