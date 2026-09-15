INSERT INTO trails (trail_id, route_number, trail_name, agency, jurisdiction_unit, base_min_clearance_inches, base_width_limit_inches, technical_rating, geom)
VALUES 
('USFS-NFSR-585', 'NFSR 585', 'South Mineral Creek Road', 'USFS', 'San Juan National Forest', 8.5, NULL, 'Class 2 High Clearance', ST_GeomFromText('LINESTRING(-107.7412 37.8105, -107.7550 37.8142, -107.7710 37.8190, -107.7850 37.8235)', 4326)),
('USFS-NFSR-861', 'NFSR 861', 'Imogene Pass Road', 'USFS', 'Uncompahgre National Forest', 10.0, NULL, 'Class 4 Extreme Shelf', ST_GeomFromText('LINESTRING(-107.6720 37.9025, -107.6950 37.9150, -107.7120 37.9280, -107.7340 37.9350)', 4326)),
('USFS-NFSR-630', 'NFSR 630', 'Ophir Pass Road', 'USFS', 'San Juan National Forest', 9.0, NULL, 'Class 3 Moderate Rocky', ST_GeomFromText('LINESTRING(-107.7820 37.8550, -107.8010 37.8520, -107.8310 37.8480)', 4326)),
('BLM-UT-1042', 'BLM 1042', 'Poison Spider UTV Restrictor Trail', 'BLM', 'Moab Field Office', 7.0, 50, 'Class 3 UTV Restricted', ST_GeomFromText('LINESTRING(-109.6050 38.5320, -109.6150 38.5410, -109.6280 37.5500)', 4326))
ON CONFLICT (trail_id) DO NOTHING;

INSERT INTO trail_alerts (alert_id, trail_id, severity, hazard_type, headline, description, min_clearance_required, max_width_allowed, ai_confidence_score, needs_human_review, is_active)
VALUES 
('ALERT-2026-001', 'USFS-NFSR-861', 'HIGH_CLEARANCE_REQUIRED', 'WASHOUT_EROSION', 'Severe Washout at Mile 3.2 - 12 Inch Obstacles', 'Spring rugoff erased switchback. Requires 12-inch clearance.', 12.0, NULL, 0.95, FALSE, TRUE),
('ALERT-2026-002', 'BLM-UT-1042', 'CAUTION', 'SEASONAL_GATE_CLOSURE', '50-Inch Restrictor Gate Maintained', 'Physical restrictor posts active at trailhead.', NULL, 50, 0.98, FALSE, TRUE)
ON CONFLICT (alert_id) DO NOTHING;
