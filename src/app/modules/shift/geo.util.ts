const EARTH_RADIUS_METERS = 6371000;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two [lng, lat] points, in meters.
 * Accurate enough for a small (~tens of meters) geofence radius.
 */
export const haversineDistanceMeters = (
    [lngA, latA]: [number, number],
    [lngB, latB]: [number, number]
): number => {
    const dLat = toRadians(latB - latA);
    const dLng = toRadians(lngB - lngA);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
};
