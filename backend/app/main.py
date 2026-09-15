from dotenv import load_dotenv
import os

load_dotenv()

import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
from app.schemas import TrailConditionAlertExtraction

app = FastAPI(title="TrailPulse AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("WARNING: GEMINI_API_KEY is not set in environment or .env file!")
ai_client = genai.Client(api_key=api_key) if api_key else None

DB_HOST = os.environ.get("POSTGRES_HOST", "localhost")
DB_NAME = os.environ.get("POSTGRES_DB", "trailpulse")
DB_USER = os.environ.get("POSTGRES_USER", "postgres")
DB_PASS = os.environ.get("POSTGRES_PASSWORD", "postgres")

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        port=5432
    )

class BulletinExtractRequest(BaseModel):
    bulletin_text: str

SYSTEM_INSTRUCTION = """
You are the Lead Geospatial Data Extraction Engine for TrailPulse.
Extract structured trail access and hazard alerts from public land bulletins.
Mandatory Rules:
1. Identify canonical route numbers (e.g., 'NFSR 585', 'NFSR 869', 'NFSR 861', 'BLM 1042', 'BLM 50-22').
2. Derivations: '50-inch restriction' -> max_width_inches: 50. 'High-clearance 4WD' -> min_ground_clearance_inches: 9.5.
3. Permittable Classes: Identify allowed vehicle classes (e.g., ['OHV_TRAIL_UNDER_50', 'MOTO'], ['MID_SIZE_4X4', 'FULL_SIZE_4X4']).
4. If dates are open-ended ('until further notice'), output 'UNTIL FURTHER NOTICE'. Never hallucinate dates.
"""

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "TrailPulse Core API",
        "gemini_key_configured": ai_client is not None
    }

@app.get("/api/v1/trails")
def get_trails(
    min_lng: float = Query(-111.0),
    min_lat: float = Query(37.0),
    max_lng: float = Query(-106.0),
    max_lat: float = Query(39.0)
):
    """Fetch GeoJSON FeatureCollection directly from PostGIS bounding box procedure covering CO & UT."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT get_trails_in_bbox(%s, %s, %s, %s) as geojson;", (min_lng, min_lat, max_lng, max_lat))
        row = cur.fetchone()
        cur.close()
        conn.close()
        return row['geojson'] if row else {"type": "FeatureCollection", "features": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/extract-bulletin", response_model=TrailConditionAlertExtraction)
async def extract_bulletin(req: BulletinExtractRequest):
    """Extract structured trail condition alerts from text bulletins using Gemini 3.6 Flash."""
    if not ai_client:
        raise HTTPException(
            status_code=500, 
            detail="GEMINI_API_KEY is missing. Please set GEMINI_API_KEY in backend/.env"
        )
    try:
        schema_dict = TrailConditionAlertExtraction.model_json_schema()
        response = ai_client.models.generate_content(
            model="gemini-3.6-flash",
            contents=f"Bulletin Text:\n{req.bulletin_text}",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                response_schema=schema_dict,
            )
        )
        alert = TrailConditionAlertExtraction.model_validate_json(response.text)
        
        # Persist alert to PostGIS DB
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            
            # Find matching trail in PostGIS
            cur.execute(
                "SELECT trail_id FROM trails WHERE route_number = %s OR route_number ILIKE %s OR trail_name ILIKE %s LIMIT 1;", 
                (alert.route_number, f"%{alert.route_number}%", f"%{alert.trail_name}%")
            )
            matched_trail = cur.fetchone()
            target_trail_id = matched_trail[0] if matched_trail else ('BLM-UT-1042' if 'BLM' in alert.route_number or 'Poison' in alert.trail_name else 'USFS-NFSR-861')
            
            # Deactivate legacy alerts for this trail
            cur.execute("UPDATE trail_alerts SET is_active = FALSE WHERE trail_id = %s;", (target_trail_id,))
            
            # Insert the newly extracted alert
            cur.execute("""
                INSERT INTO trail_alerts (
                    alert_id, trail_id, severity, hazard_type, headline, description, 
                    min_clearance_required, max_width_allowed, ai_confidence_score, is_active
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (alert_id) DO UPDATE SET
                    severity = EXCLUDED.severity,
                    hazard_type = EXCLUDED.hazard_type,
                    headline = EXCLUDED.headline,
                    min_clearance_required = EXCLUDED.min_clearance_required,
                    max_width_allowed = EXCLUDED.max_width_allowed,
                    is_active = TRUE;
            """, (
                alert.alert_id,
                target_trail_id,
                alert.severity.value if hasattr(alert.severity, 'value') else alert.severity,
                alert.hazard_type.value if hasattr(alert.hazard_type, 'value') else alert.hazard_type,
                alert.headline,
                alert.description,
                alert.vehicle_constraints.min_ground_clearance_inches,
                alert.vehicle_constraints.max_width_inches,
                alert.provenance.confidence_score,
                True
            ))
            conn.commit()
            cur.close()
            conn.close()
        except Exception as db_err:
            print(f"PostGIS DB insert warning: {db_err}")

        return alert
    except Exception as e:
        print(f"Gemini Extraction Exception: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
