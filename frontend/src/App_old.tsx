import React, { useEffect, useState } from 'react';
import { TrailMap } from './components/TrailMap';
import { VehicleProfile } from './utils/vehicleEvaluator';

// Preset Vehicle Profiles for interactive testing
const vehicleProfiles: VehicleProfile[] = [
  {
    id: 'v-tacoma-01',
    name: 'Toyota Tacoma TRD Pro (33" Tires)',
    vehicleClass: 'MID_SIZE_4X4',
    groundClearanceInches: 9.5,
    trackWidthInches: 63.0,
    hasRearLocker: true
  },
  {
    id: 'v-subaru-01',
    name: 'Subaru Outback Wilderness (Stock)',
    vehicleClass: 'CROSSOVER_AWD',
    groundClearanceInches: 9.2,
    trackWidthInches: 61.5,
    hasRearLocker: false
  },
  {
    id: 'v-wrangler-01',
    name: 'Jeep Wrangler Rubicon (35" Tires, Lifted)',
    vehicleClass: 'FULL_SIZE_4X4',
    groundClearanceInches: 11.8,
    trackWidthInches: 65.0,
    hasRearLocker: true
  }
];

export default function App() {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleProfile>(vehicleProfiles[0]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Bulletin Ingestion State (Simulating Admin / Multi-Source Intake)
  const [bulletinText, setBulletinText] = useState<string>(
    'USFS Alert: Imogene Pass (NFSR 869) has a 12-inch boulder slide near the summit. Minimum ground clearance required is now 11 inches. High rollover hazard present.'
  );
  const [extracting, setExtracting] = useState<boolean>(false);
  const [extractionResult, setExtractionResult] = useState<any>(null);

  const fetchTrails = () => {
    setLoading(true);
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
        setError('Could not connect to FastAPI backend at /api/v1/trails. Ensure uvicorn is running.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTrails();
  }, []);

  const handleExtractBulletin = async () => {
    if (!bulletinText.trim()) return;
    setExtracting(true);
    setExtractionResult(null);

    try {
      const res = await fetch('/api/v1/extract-bulletin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulletin_text: bulletinText })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setExtractionResult(data);

      // Re-fetch trails from PostGIS to show updated overlay dynamically
      fetchTrails();
    } catch (err: any) {
      console.error('Extraction error:', err);
      setExtractionResult({ error: 'Extraction failed: ' + err.message });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'sans-serif' }}>
      {/* Sidebar Controls */}
      <div style={{ width: '360px', background: '#1e293b', color: '#f8fafc', padding: '20px', boxSizing: 'border-box', zIndex: 10, overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 5px 0', color: '#10b981' }}>TrailPulse</h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: 0 }}>AI-Augmented Trail Access & Passability Engine</p>
        <hr style={{ borderColor: '#334155', margin: '15px 0' }} />

        {/* Vehicle Selector */}
        <h3>Select Vehicle Profile</h3>
        <select
          value={selectedVehicle.id}
          onChange={(e) => {
            const v = vehicleProfiles.find((vp) => vp.id === e.target.value);
            if (v) setSelectedVehicle(v);
          }}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', background: '#0f172a', color: '#f8fafc', border: '1px solid #475569', marginBottom: '12px' }}
        >
          {vehicleProfiles.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>

        <div style={{ background: '#0f172a', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
          <div><strong>Class:</strong> {selectedVehicle.vehicleClass}</div>
          <div><strong>Ground Clearance:</strong> {selectedVehicle.groundClearanceInches}"</div>
          <div><strong>Track Width:</strong> {selectedVehicle.trackWidthInches}"</div>
          <div><strong>Rear Locker:</strong> {selectedVehicle.hasRearLocker ? 'Yes' : 'No'}</div>
        </div>

        <hr style={{ borderColor: '#334155', margin: '20px 0' }} />

        {/* Bulletin Simulator (Admin Ingestion) */}
        <h3 style={{ margin: '0 0 8px 0', color: '#38bdf8' }}>⚡ Ingest Ranger Bulletin (AI)</h3>
        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: 0 }}>
          Simulates raw text intake (USFS/BLM updates, SMS, news, docs). Processed via Gemini 2.5 Flash.
        </p>

        <textarea
          value={bulletinText}
          onChange={(e) => setBulletinText(e.target.value)}
          rows={4}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '4px',
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #475569',
            fontSize: '12px',
            boxSizing: 'border-box',
            resize: 'vertical'
          }}
          placeholder="Paste unstructured bulletin text..."
        />

        <button
          onClick={handleExtractBulletin}
          disabled={extracting}
          style={{
            width: '100%',
            marginTop: '8px',
            padding: '10px',
            background: extracting ? '#64748b' : '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            cursor: extracting ? 'not-allowed' : 'pointer'
          }}
        >
          {extracting ? 'Extracting with Gemini...' : 'Parse & Apply Condition Overlay'}
        </button>

        {extractionResult && (
          <div style={{ marginTop: '12px', padding: '10px', background: '#0f172a', borderRadius: '6px', fontSize: '12px', border: '1px solid #334155' }}>
            <div style={{ fontWeight: 'bold', color: extractionResult.error ? '#ef4444' : '#10b981', marginBottom: '4px' }}>
              {extractionResult.error ? 'Extraction Error' : 'Extraction Output:'}
            </div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '11px', color: '#cbd5e1' }}>
              {JSON.stringify(extractionResult, null, 2)}
            </pre>
          </div>
        )}

        <hr style={{ borderColor: '#334155', margin: '20px 0' }} />

        <h3>Passability Legend</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '14px', height: '14px', background: '#10b981', borderRadius: '3px' }}></span>
            <span><strong>Passable</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '14px', height: '14px', background: '#f59e0b', borderRadius: '3px' }}></span>
            <span><strong>Warning</strong> (Caution required)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '14px', height: '14px', background: '#ef4444', borderRadius: '3px' }}></span>
            <span><strong>Impasse / Deficit</strong></span>
          </div>
        </div>
      </div>

      {/* Main Map Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        {loading && <div style={{ padding: '20px' }}>Loading San Juan trail network from PostGIS...</div>}
        {error && <div style={{ padding: '20px', color: '#ef4444' }}>{error}</div>}
        {geoJsonData && <TrailMap vehicle={selectedVehicle} geoJsonData={geoJsonData} />}
      </div>
    </div>
  );
}
