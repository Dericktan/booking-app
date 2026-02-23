// Prices are stored and displayed in the smallest local currency unit (e.g. IDR),
// so final prices are rounded to the nearest PRICE_ROUNDING_UNIT.
const PRICE_ROUNDING_UNIT = 1000;

export type RuleType = 'TIME_RANGE' | 'DEMAND' | 'LEAD_TIME' | 'DATE_SPECIFIC';
export type AdjustmentType = 'PERCENTAGE' | 'FIXED';

export interface PricingRule {
  id: string;
  rule_type: RuleType;
  adjustment_type: AdjustmentType;
  value: number;
  priority: number;
  stackable: boolean;
  is_active: boolean;
  conditions: Record<string, unknown>;
}

export interface TimeslotContext {
  start_time: Date;
  end_time: Date;
  capacity: number;
  booked_count: number;
}

export interface PricingResult {
  final_price: number;
  applied_rules: Array<{ id: string; rule_type: RuleType; adjustment: number }>;
}

function applyAdjustment(
  price: number,
  adjustmentType: AdjustmentType,
  value: number
): number {
  if (adjustmentType === 'PERCENTAGE') {
    return price * (1 + value / 100);
  }
  return price + value;
}

function matchesTimeRange(
  rule: PricingRule,
  timeslot: TimeslotContext
): boolean {
  const conditions = rule.conditions as {
    days_of_week?: number[];
    start_hour?: number;
    end_hour?: number;
  };
  const slotDay = timeslot.start_time.getUTCDay(); // 0=Sunday ... 6=Saturday
  const slotHour = timeslot.start_time.getUTCHours();

  if (
    conditions.days_of_week &&
    !conditions.days_of_week.includes(slotDay)
  ) {
    return false;
  }

  if (conditions.start_hour !== undefined && slotHour < conditions.start_hour) {
    return false;
  }
  if (conditions.end_hour !== undefined && slotHour >= conditions.end_hour) {
    return false;
  }
  return true;
}

function matchesDemand(rule: PricingRule, timeslot: TimeslotContext): boolean {
  if (timeslot.capacity === 0) return false;
  const occupancy = timeslot.booked_count / timeslot.capacity;
  const conditions = rule.conditions as {
    min_occupancy?: number;
    max_occupancy?: number;
  };
  if (
    conditions.min_occupancy !== undefined &&
    occupancy < conditions.min_occupancy
  ) {
    return false;
  }
  if (
    conditions.max_occupancy !== undefined &&
    occupancy >= conditions.max_occupancy
  ) {
    return false;
  }
  return true;
}

function matchesLeadTime(rule: PricingRule, timeslot: TimeslotContext): boolean {
  const now = new Date();
  const hoursUntilSlot =
    (timeslot.start_time.getTime() - now.getTime()) / (1000 * 60 * 60);
  const conditions = rule.conditions as {
    max_hours?: number;
    min_hours?: number;
  };
  if (conditions.max_hours !== undefined && hoursUntilSlot >= conditions.max_hours) {
    return false;
  }
  if (conditions.min_hours !== undefined && hoursUntilSlot < conditions.min_hours) {
    return false;
  }
  return true;
}

function matchesDateSpecific(
  rule: PricingRule,
  timeslot: TimeslotContext
): boolean {
  const conditions = rule.conditions as { dates?: string[] };
  if (!conditions.dates || conditions.dates.length === 0) return false;
  const slotDate = timeslot.start_time.toISOString().slice(0, 10);
  return conditions.dates.includes(slotDate);
}

function ruleMatches(rule: PricingRule, timeslot: TimeslotContext): boolean {
  switch (rule.rule_type) {
    case 'TIME_RANGE':
      return matchesTimeRange(rule, timeslot);
    case 'DEMAND':
      return matchesDemand(rule, timeslot);
    case 'LEAD_TIME':
      return matchesLeadTime(rule, timeslot);
    case 'DATE_SPECIFIC':
      return matchesDateSpecific(rule, timeslot);
    default:
      return false;
  }
}

export function computePrice(
  basePrice: number,
  rules: PricingRule[],
  timeslot: TimeslotContext
): PricingResult {
  const activeRules = rules
    .filter((r) => r.is_active)
    .sort((a, b) => a.priority - b.priority);

  let price = basePrice;
  const appliedRules: PricingResult['applied_rules'] = [];

  for (const rule of activeRules) {
    if (ruleMatches(rule, timeslot)) {
      const adjustment =
        rule.adjustment_type === 'PERCENTAGE'
          ? (price * rule.value) / 100
          : rule.value;
      price = applyAdjustment(price, rule.adjustment_type, rule.value);
      appliedRules.push({
        id: rule.id,
        rule_type: rule.rule_type,
        adjustment,
      });
      if (!rule.stackable) {
        break;
      }
    }
  }

  // Round to nearest PRICE_ROUNDING_UNIT
  const final_price = Math.round(price / PRICE_ROUNDING_UNIT) * PRICE_ROUNDING_UNIT;

  return { final_price, applied_rules: appliedRules };
}
