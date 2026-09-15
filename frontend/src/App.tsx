import React, { useEffect, useState } from 'react';
import { TrailMap } from './components/TrailMap';
import { VehicleProfile } from './utils/vehicleEvaluator';

export const vehicleProfiles: VehicleProfile[] = [
  {
    id: 'v-atv-01',
    name: 'Polaris Sportsman 500 (Class 1 ATV)',
    vehicleClass: 'OHV_TRAIL_UNDER_50',
    groundClearanceInches: 9.0,
    trackWidthInches: 48.0,
    hasRearLocker: false
  },
  {
    id: 'v-tacoma-01',
    name: 'Toyota Tacoma TRD Pro (33" Tires)',
    vehicleClass: 'MID_SIZE_4X4',
    groundClearanceInches: 9.5,
    trackWidthInches: 63.0,
    hasRearLocker: true
  },
  {
    id: 'v-jeep-01',
    name: 'Jeep Wrangler Rubicon (35" Tires)',
    vehicleClass: 'FULL_SIZE_4X4',
    groundClearanceInches: 11.8,
    trackWidthInches: 65.0,
    hasRearLocker: true
  },
  {
    id: 'v-subaru-01',
    name: 'Subaru Outback Wilderness',
    vehicleClass: 'AWD_CROSSOVER',
    groundClearanceInches: 9.2,
    trackWidthInches: 61.5,
    hasRearLocker: false
  },
  {
    id: 'v-canam-01',
    name: 'Can-Am Maverick X3 (Wide SxS)',
    vehicleClass: 'SPORT_UTV_SXS',
    groundClearanceInches: 14.0,
    trackWidthInches: 72.0,
    hasRearLocker: true
  }
];

export default function App() {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleProfile>(vehicleProfiles[0]);
  const [bulletinInput, setBulletinInput] = useState<string>('');
  const [extracting, setExtracting] = useState<boolean>(false);
  const [extractionOutput, setExtractionOutput] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrails = () => {
    fetch('/api/v1/trails')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setGeoJsonData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch trails:', err);
        setError('Could not connect to FastAPI backend via /api/v1/trails.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTrails();
  }, []);

  const handleExtractBulletin = async () => {
    if (!bulletinInput.trim()) return;
    setExtracting(true);
    setExtractionOutput(null);
    try {
      const res = await fetch('/api/v1/extract-bulletin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulletin_text: bulletinInput })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Extraction failed');
      }
      const data = await res.json();
      setExtractionOutput(data);
      // Re-fetch trails so PostGIS updated alerts render on map immediately
      fetchTrails();
    } catch (err: any) {
      alert(`Error extracting bulletin: ${err.message}`);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'sans-serif', margin: 0, overflow: 'hidden' }}>
      {/* Sidebar Controls */}
      <div style={{ width: '360px', background: '#1e293b', color: '#f8fafc', padding: '20px', boxSizing: 'border-box', zIndex: 10, overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 4px 0', color: '#10b981' }}>TrailPulse</h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: 0 }}>AI-Augmented Trail Access & Condition Engine</p>
        <hr style={{ borderColor: '#334155', margin: '15px 0' }} />

        <h3>Active Vehicle Profile</h3>
        <select
          value={selectedVehicle.id}
          onChange={(e) => {
            const found = vehicleProfiles.find((v) => v.id === e.target.value);
            if (found) setSelectedVehicle(found);
          }}
          style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0f172a', color: '#f8fafc', border: '1px solid #475569', fontSize: '14px', marginBottom: '12px', cursor: 'pointer' }}
        >
          {vehicleProfiles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.vehicleClass})
            </option>
          ))}
        </select>

        <div style={{ background: '#0f172a', padding: '12px', borderRadius: '6px', fontSize: '13px', lineHeight: '1.6' }}>
          <div><strong>Class:</strong> {selectedVehicle.vehicleClass}</div>
          <div><strong>Ground Clearance:</strong> {selectedVehicle.groundClearanceInches}"</div>
          <div><strong>Track Width:</strong> {selectedVehicle.trackWidthInches}"</div>
          <div><strong>Rear Locking Diff:</strong> {selectedVehicle.hasRearLocker ? 'Yes' : 'No'}</div>
        </div>

        <h3 style={{ marginTop: '20px' }}>Ingest Ranger Bulletin (AI)</h3>
        <textarea
          rows={4}
          placeholder="Paste USFS/BLM alert bulletin text here..."
          value={bulletinInput}
          onChange={(e) => setBulletinInput(e.target.value)}
          style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0f172a', color: '#f8fafc', border: '1px solid #475569', boxSizing: 'border-box', fontSize: '13px' }}
        />
        <button
          onClick={handleExtractBulletin}
          disabled={extracting}
          style={{ width: '100%', marginTop: '8px', padding: '10px', background: extracting ? '#64748b' : '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {extracting ? 'Extracting via Gemini 3.6...' : 'Parse & Apply Condition Overlay'}
        </button>

        {extractionOutput && (
          <div style={{ marginTop: '12px', background: '#0f172a', padding: '10px', borderRadius: '6px', fontSize: '11px' }}>
            <strong style={{ color: '#38bdf8' }}>Gemini Extraction JSON:</strong>
            <pre style={{ margin: '6px 0 0 0', overflowX: 'auto', whiteSpace: 'pre-wrap', color: '#a7f3d0' }}>
              {JSON.stringify(extractionOutput, null, 2)}
            </pre>
          </div>
        )}

        <h3 style={{ marginTop: '20px' }}>Passability Legend</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '14px', height: '14px', background: '#10b981', borderRadius: '3px' }}></span>
            <span><strong>Passable</strong> (Meets all rules)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '14px', height: '14px', background: '#f59e0b', borderRadius: '3px' }}></span>
            <span><strong>Warning</strong> (Low margin / caution)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '14px', height: '14px', background: '#ef4444', borderRadius: '3px' }}></span>
            <span><strong>Impasse</strong> (Prohibited / Deficit)</span>
          </div>
        </div>
      </div>

      {/* Map Display */}
      <div style={{ flex: 1, position: 'relative', height: '100%', width: '100%' }}>
        {loading && <div style={{ padding: '20px', color: '#000' }}>Loading trail network from PostGIS...</div>}
        {error && <div style={{ padding: '20px', color: '#ef4444' }}>{error}</div>}
        {geoJsonData && <TrailMap vehicle={selectedVehicle} geoJsonData={geoJsonData} />}
      </div>
    </div>
  );
}
