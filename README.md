TrailPulse: AI-Augmented Trail Access & Condition Engine 🏔️

**Decoupling Static Federal Land Baselines from Ephemeral Backcountry Hazards using Gemini 3.6 Flash, PostGIS, and MapLibre GL JS.**

---

## 🎬 Recorded Demo Scenarios

| Scenario | Feature Highlight | Description |
| :--- | :--- | :--- |
| **1. Dynamic Hazard Intake** | Gemini 3.6 Flash dynamic parsing | Extracts 12" clearance obstacle on Imogene Pass from raw ranger bulletin |
| **2. Emergency Order Closure** | Federal USFS Forest Order enforcement | Parses total legal closure (NFSR 585 culvert blowout) |
| **3. 50" Width Gate Match** | Instant `<16ms` client-side evaluation | Track-width evaluation against physical restrictor gate (BLM 1042) |
| **4. Vehicle Tolerance Evaluation** | Ground clearance & rating matching | Evaluates vehicle build tolerances against trail technical requirements |

[TrailPulse - Scenario1-Rockslide.webm](https://github.com/user-attachments/assets/2ccd0820-ecdc-40a4-ad0a-f306141af8e5)



[TrailPulse - Scenario2-Closure.webm](https://github.com/user-attachments/assets/41880ae2-ad7e-464d-a8b7-1ce887e5ff3d)




[TrailPulse - Scenario3.webm](https://github.com/user-attachments/assets/3e090087-9200-464e-a329-e1dfb07e5104)




[TrailPulse - Scenario4-ClearanceThresholds.webm](https://github.com/user-attachments/assets/28ddb214-b2aa-4c7e-a2a4-0cec9870a7a5)




---

## 🏛️ System Architecture
┌────────────────────────────────────────────────────────┐ │ UNSTRUCTURED LAND BULLETINS │ │ USFS Forest Orders • BLM Field Reports • UGC Logs │ └───────────────────────────┬────────────────────────────┘ │ ▼ ┌────────────────────────────────────────────────────────┐ │ AI EXTRACTION ENGINE (GEMINI 3.6 FLASH) │ │ Pydantic v2 Schema Enforcement • ISO 8601 Dates • │ │ Hazard Classification • Clearance / Width Constraints │ └───────────────────────────┬────────────────────────────┘ │ ▼ ┌────────────────────────────────────────────────────────┐ │ POSTGIS SPATIAL DATABASE (PORT 5432) │ │ Bounding-Box Spatial Function `get_trails_in_bbox` │ │ JSONB FeatureCollection Assembly • GiST Indexing │ └───────────────────────────┬────────────────────────────┘ │ ▼ ┌────────────────────────────────────────────────────────┐ │ CLIENT-SIDE DETERMINISTIC EVALUATION (MAPLIBRE) │ │ `vehicleEvaluator.ts` Hardware Rules 0-4 • │ │ Zero Round-Trip Visual Re-Evaluation (<16ms) │ └───────────────────────────┬────────────────────────────┘
---

## 🚀 Service Operations

* **Start All Services:** `./start_services.sh`
* **Verify Service Health:** `./verify_services.sh`
* **Stop All Services:** `./stop_services.sh`

---

## 📊 Tech Stack
* **Backend:** FastAPI, Pydantic v2, `psycopg2`
* **Database:** PostgreSQL 16 + PostGIS 3 (GiST indexing, WGS 84 / EPSG 4326)
* **AI Model:** Gemini 3.6 Flash (Structured JSON output schema)
* **Frontend:** React, TypeScript, Vite, MapLibre GL JS
