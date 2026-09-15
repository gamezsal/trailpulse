-- Enable PostGIS & UUID extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Baseline GIS Geometry Table (USFS MVUM / BLM GTRN)
CREATE TABLE IF NOT EXISTS trails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trail_id VARCHAR(64) UNIQUE NOT NULL,
    route_number VARCHAR(32) NOT NULL,
    trail_name VARCHAR(128) NOT NULL,
    agency VARCHAR(32) NOT NULL,
    jurisdiction_unit VARCHAR(128) NOT NULL,
    base_min_clearance_inches NUMERIC(4,1) DEFAULT 8.0,
    base_width_limit_inches INTEGER,
    technical_rating VARCHAR(64) NOT NULL,
    geom GEOMETRY(LineString, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trails_geom ON trails USING GIST (geom);

-- Dynamic Condition Overlays
CREATE TABLE IF NOT EXISTS trail_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id VARCHAR(64) UNIQUE NOT NULL,
    trail_id VARCHAR(64) REFERENCES trails(trail_id),
    severity VARCHAR(32) NOT NULL,
    hazard_type VARCHAR(64) NOT NULL,
    headline VARCHAR(128) NOT NULL,
    description TEXT,
    min_clearance_required NUMERIC(4,1),
    max_width_allowed INTEGER,
    ai_confidence_score NUMERIC(3,2) NOT NULL,
    needs_human_review BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop old function signatures to allow type changes
DROP FUNCTION IF EXISTS get_trails_in_bbox(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS get_trails_in_bbox(NUMERIC, NUMERIC, NUMERIC, NUMERIC);

-- Fast Bounding-Box Viewport Query Function (NUMERIC)
CREATE OR REPLACE FUNCTION get_trails_in_bbox(
    min_lng NUMERIC, min_lat NUMERIC,
    max_lng NUMERIC, max_lat NUMERIC
)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(f.feature), '[]'::jsonb)
    ) INTO result
    FROM (
        SELECT jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(t.geom)::jsonb,
            'properties', jsonb_build_object(
                'trailId', t.trail_id,
                'trailName', t.trail_name,
                'routeNumber', t.route_number,
                'agency', t.agency,
                'jurisdictionUnit', t.jurisdiction_unit,
                'baseMinClearanceInches', t.base_min_clearance_inches,
                'baseWidthLimitInches', t.base_width_limit_inches,
                'technicalRating', t.technical_rating,
                'activeAlert', (
                    SELECT jsonb_build_object(
                        'alertId', a.alert_id,
                        'severity', a.severity,
                        'hazardType', a.hazard_type,
                        'headline', a.headline,
                        'minClearanceRequired', a.min_clearance_required,
                        'maxWidthAllowed', a.max_width_allowed,
                        'aiConfidenceScore', a.ai_confidence_score
                    ) FROM trail_alerts a 
                    WHERE a.trail_id = t.trail_id AND a.is_active = TRUE 
                    LIMIT 1
                )
            )
        ) AS feature
        FROM trails t
        WHERE t.geom && ST_MakeEnvelope(min_lng::double precision, min_lat::double precision, max_lng::double precision, max_lat::double precision, 4326)
    ) f;
    RETURN result;
END;
$$;

-- Overload for DOUBLE PRECISION
CREATE OR REPLACE FUNCTION get_trails_in_bbox(
    min_lng DOUBLE PRECISION, min_lat DOUBLE PRECISION,
    max_lng DOUBLE PRECISION, max_lat DOUBLE PRECISION
)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN get_trails_in_bbox(min_lng::numeric, min_lat::numeric, max_lng::numeric, max_lat::numeric);
END;
$$;
