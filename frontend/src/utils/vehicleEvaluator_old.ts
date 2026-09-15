export type PassabilityStatus = 'PASSABLE' | 'WARNING' | 'IMPASSABLE';

export interface VehicleProfile {
  id: string;
  name: string;
  vehicleClass: 'AWD_CROSSOVER' | 'FULL_SIZE_4X4' | 'MID_SIZE_4X4' | 'SPORT_UTV_SXS';
  groundClearanceInches: number;
  trackWidthInches: number;
  hasRearLocker: boolean;
}

export interface TrailConditionAlert {
  alertId: string;
  severity: 'INFO' | 'CAUTION' | 'HIGH_CLEARANCE_REQUIRED' | 'IMPASSABLE' | 'TOTAL_CLOSURE';
  headline: string;
  minClearanceRequired?: number;
  maxWidthAllowed?: number;
  aiConfidenceScore: number;
}

export interface TrailProperties {
  trailId: string;
  trailName: string;
  routeNumber: string;
  baseMinClearanceInches: number;
  baseWidthLimitInches?: number | null;
  technicalRating: string;
  activeAlert?: TrailConditionAlert | null;
}

export interface EvaluationResult {
  status: PassabilityStatus;
  reasons: string[];
  clearanceDeltaInches: number;
  isLegalClosure: boolean;
}

export function evaluateTrailPassability(
  trail: TrailProperties,
  vehicle: VehicleProfile
): EvaluationResult {
  const reasons: string[] = [];
  
  // RULE 1: Physical / Legal Track Width Restrictor Gates (Hard Block)
  const activeWidthLimit = trail.activeAlert?.maxWidthAllowed ?? trail.baseWidthLimitInches;
  if (activeWidthLimit && vehicle.trackWidthInches > activeWidthLimit) {
    return {
      status: 'IMPASSABLE',
      reasons: [`Vehicle width (${vehicle.trackWidthInches}") exceeds limit of ${activeWidthLimit}". Physical post gates block entry.`],
      clearanceDeltaInches: 0,
      isLegalClosure: true
    };
  }

  // RULE 2: Total Agency Closures
  if (trail.activeAlert?.severity === 'TOTAL_CLOSURE') {
    return {
      status: 'IMPASSABLE',
      reasons: [`Legally Closed: ${trail.activeAlert.headline}. Unauthorized transit prohibited.`],
      clearanceDeltaInches: 0,
      isLegalClosure: true
    };
  }

  // RULE 3: Ground Clearance Differential
  const requiredClearance = Math.max(
    trail.baseMinClearanceInches,
    trail.activeAlert?.minClearanceRequired ?? 0
  );
  const clearanceDelta = vehicle.groundClearanceInches - requiredClearance;

  if (clearanceDelta < -1.5) {
    return {
      status: 'IMPASSABLE',
      reasons: [`Clearance deficit of ${Math.abs(clearanceDelta).toFixed(1)}" creates high-centering & underbody damage risk.`],
      clearanceDeltaInches: clearanceDelta,
      isLegalClosure: false
    };
  } else if (clearanceDelta < 1.0) {
    reasons.push(`Low clearance margin (${clearanceDelta.toFixed(1)}" delta above minimum required). Careful line choice required.`);
  }

  // RULE 4: Drivetrain Logic for Technical Shelf / Class 4 Routes
  const isTechnicalShelf = trail.technicalRating.toLowerCase().includes('shelf') || 
                           trail.technicalRating.toLowerCase().includes('class 4');
  if (isTechnicalShelf && vehicle.vehicleClass === 'AWD_CROSSOVER') {
    return {
      status: 'IMPASSABLE',
      reasons: ['Route features steep shale shelf terrain requiring 2-speed transfer case (4WD Low). AWD transaxle systems risk thermal shutdown.'],
      clearanceDeltaInches: clearanceDelta,
      isLegalClosure: false
    };
  }

  return {
    status: clearanceDelta < 1.0 ? 'WARNING' : 'PASSABLE',
    reasons: reasons.length ? reasons : ['Vehicle capability clears all trail baselines and active conditions.'],
    clearanceDeltaInches: clearanceDelta,
    isLegalClosure: false
  };
}
