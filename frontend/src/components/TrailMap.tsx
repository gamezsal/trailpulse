import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { VehicleProfile, evaluateTrailPassability } from '../utils/vehicleEvaluator';

interface Props {
  vehicle: VehicleProfile;
  geoJsonData: any;
}

export const TrailMap: React.FC<Props> = ({ vehicle, geoJsonData }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    if (!mapContainer.current || !geoJsonData?.features) return;

    // Evaluate trail passability locally in real-time
    const evaluatedFeatures = geoJsonData.features.map((feat: any) => {
      const evaluation = evaluateTrailPassability(feat.properties, vehicle);
      return {
        ...feat,
        properties: {
          ...feat.properties,
          passabilityStatus: evaluation.status,
          reasons: evaluation.reasons.join(' | '),
          clearanceDelta: evaluation.clearanceDeltaInches
        }
      };
    });

    const evaluatedGeoJson = { ...geoJsonData, features: evaluatedFeatures };

    if (!mapRef.current) {
      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap contributors'
            }
          },
          layers: [
            {
              id: 'osm-tiles-layer',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19
            }
          ]
        },
        center: [-108.6, 38.2], // Centered between Moab UT and Silverton CO
        zoom: 8.5
      });

      mapRef.current = map;

      map.on('load', () => {
        map.addSource('trails-source', {
          type: 'geojson',
          data: evaluatedGeoJson
        });

        // GPU-accelerated styling based on passabilityStatus
        map.addLayer({
          id: 'trails-line',
          type: 'line',
          source: 'trails-source',
          paint: {
            'line-width': 6,
            'line-color': [
              'match',
              ['get', 'passabilityStatus'],
              'PASSABLE', '#10b981',   // Emerald Green
              'WARNING', '#f59e0b',    // Amber Yellow
              'IMPASSABLE', '#ef4444', // Red
              '#9ca3af'
            ]
          }
        });

        // Hover cursor pointer
        map.on('mouseenter', 'trails-line', () => {
          if (mapRef.current) mapRef.current.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'trails-line', () => {
          if (mapRef.current) mapRef.current.getCanvas().style.cursor = '';
        });

        // Click popup handler for interactive trail inspection
        map.on('click', 'trails-line', (e) => {
          if (!e.features || !e.features[0]) return;
          const feat = e.features[0];
          const props = feat.properties;
          
          let activeAlert = props.activeAlert;
          if (typeof activeAlert === 'string') {
            try { activeAlert = JSON.parse(activeAlert); } catch (err) {}
          }
          
          const statusColor = props.passabilityStatus === 'PASSABLE' ? '#10b981' : props.passabilityStatus === 'WARNING' ? '#f59e0b' : '#ef4444';

          const htmlContent = `
            <div style="font-family: sans-serif; padding: 6px; max-width: 280px; color: #0f172a;">
              <h4 style="margin: 0 0 4px 0; color: #0f172a; font-size: 15px;">${props.trailName} (${props.routeNumber})</h4>
              <div style="display: inline-block; padding: 3px 8px; background: ${statusColor}; color: #fff; font-weight: bold; border-radius: 4px; font-size: 11px; margin-bottom: 8px;">
                STATUS: ${props.passabilityStatus}
              </div>
              <div style="font-size: 12px; margin-bottom: 6px;">
                <strong>Agency:</strong> ${props.agency} | <strong>Rating:</strong> ${props.technicalRating}
              </div>
              <div style="font-size: 12px; margin-bottom: 6px;">
                <strong>Base Min Clearance:</strong> ${props.baseMinClearanceInches}"
                ${props.baseWidthLimitInches ? ` | <strong>Width Limit:</strong> ${props.baseWidthLimitInches}"` : ''}
              </div>
              ${activeAlert ? `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid ${statusColor}; padding: 8px; border-radius: 4px; margin-top: 6px; font-size: 12px;">
                  <strong style="color: #0284c7;">⚡ Active AI Alert:</strong>
                  <div style="font-weight: bold; margin: 2px 0;">${activeAlert.headline}</div>
                  <div>${activeAlert.minClearanceRequired ? `Min Clearance Required: <strong>${activeAlert.minClearanceRequired}"</strong>` : ''}</div>
                  <div>${activeAlert.maxWidthAllowed ? `Max Width Allowed: <strong>${activeAlert.maxWidthAllowed}"</strong>` : ''}</div>
                  <div style="color: #64748b; font-size: 11px; margin-top: 4px;">AI Confidence: ${(activeAlert.aiConfidenceScore * 100).toFixed(0)}%</div>
                </div>
              ` : '<div style="font-size: 12px; color: #10b981;">No active hazard alerts recorded.</div>'}
              <div style="font-size: 11px; color: #475569; margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 4px;">
                <strong>Reasoning:</strong> ${props.reasons}
              </div>
            </div>
          `;

          if (popupRef.current) popupRef.current.remove();
          popupRef.current = new maplibregl.Popup({ closeOnClick: true })
            .setLngLat(e.lngLat)
            .setHTML(htmlContent)
            .addTo(mapRef.current!);
        });
      });
    } else {
      const source = mapRef.current.getSource('trails-source') as maplibregl.GeoJSONSource;
      if (source) source.setData(evaluatedGeoJson);
    }
  }, [vehicle, geoJsonData]);

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />;
};
