from datetime import datetime
from enum import Enum
from typing import Optional, Union, List
from pydantic import BaseModel, Field, field_validator, model_validator

class SeverityLevel(str, Enum):
    INFO = "INFO"
    CAUTION = "CAUTION"
    HIGH_CLEARANCE_REQUIRED = "HIGH_CLEARANCE_REQUIRED"
    IMPASSABLE = "IMPASSABLE"
    TOTAL_CLOSURE = "TOTAL_CLOSURE"

class HazardType(str, Enum):
    SEASONAL_GATE_CLOSURE = "SEASONAL_GATE_CLOSURE"
    EMERGENCY_ORDER = "EMERGENCY_ORDER"
    WASHOUT_EROSION = "WASHOUT_EROSION"
    ROCKSLIDE_DEBRIS = "ROCKSLIDE_DEBRIS"
    DOWN_TIMBER = "DOWN_TIMBER"
    MUD_SNOWPACK = "MUD_SNOWPACK"

class VehicleClassEnum(str, Enum):
    MOTO = "MOTO"
    OHV_TRAIL_UNDER_50 = "OHV_TRAIL_UNDER_50"
    SPORT_UTV_SXS = "SPORT_UTV_SXS"
    MID_SIZE_4X4 = "MID_SIZE_4X4"
    FULL_SIZE_4X4 = "FULL_SIZE_4X4"
    AWD_CROSSOVER = "AWD_CROSSOVER"

class VehicleConstraints(BaseModel):
    max_width_inches: Optional[int] = Field(None, description="Max width allowed (e.g. 50 inch restrictor gates)")
    min_ground_clearance_inches: Optional[float] = Field(None, description="Required obstacle clearance in inches")
    min_tire_size_inches: Optional[float] = None
    winch_recommended: bool = False
    allowed_vehicle_classes: Optional[List[VehicleClassEnum]] = Field(
        None, 
        description="Legally permitted vehicle classes per USFS MVUM / BLM GTLF (e.g. ['OHV_TRAIL_UNDER_50', 'MOTO'])"
    )

class ProvenanceModel(BaseModel):
    source_type: str = Field("OFFICIAL_AGENCY_ORDER", description="OFFICIAL_AGENCY_ORDER, RANGER_REPORT, COMMUNITY_LOG")
    source_url: Optional[str] = None
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    needs_human_review: bool = False

class TrailConditionAlertExtraction(BaseModel):
    alert_id: str
    route_number: str = Field(..., description="Canonical road identifier (e.g. NFSR 585)")
    trail_name: str
    admin_unit: str = Field(..., description="National Forest or BLM Field Office name")
    severity: SeverityLevel
    hazard_type: HazardType
    headline: str = Field(..., max_length=100)
    description: str
    vehicle_constraints: VehicleConstraints
    start_date: Optional[Union[datetime, str]] = None
    end_date: Optional[Union[datetime, str]] = None
    provenance: ProvenanceModel

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def normalize_dates(cls, val):
        if isinstance(val, str):
            val_clean = val.strip().upper()
            if val_clean in ["UNTIL FURTHER NOTICE", "INDEFINITE", "TBD", "WINTER SEASONAL"]:
                return val_clean
            try:
                return datetime.fromisoformat(val_clean.replace("Z", "+00:00"))
            except ValueError:
                return val_clean
        return val

    @model_validator(mode="after")
    def validate_safety_thresholds(self) -> 'TrailConditionAlertExtraction':
        if self.severity == SeverityLevel.TOTAL_CLOSURE and self.provenance.confidence_score < 0.90:
            self.provenance.needs_human_review = True
        return self
