export const AT_LEAST_ONE_FIELD_MESSAGE = 'At least one field must be provided';

/**
 * Guard for `PATCH` payloads: a partial schema accepts `{}`, which would
 * otherwise reach the database as a no-op update.
 */
export const hasAtLeastOneField = (data: object): boolean => Object.keys(data).length > 0;
