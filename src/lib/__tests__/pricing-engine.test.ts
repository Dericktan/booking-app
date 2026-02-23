import { computePrice, PricingRule, TimeslotContext } from '../pricing-engine';

const baseSlot: TimeslotContext = {
  start_time: new Date('2026-06-13T10:00:00Z'), // Saturday 10am UTC
  end_time: new Date('2026-06-13T11:00:00Z'),
  capacity: 10,
  booked_count: 0,
};

describe('computePrice', () => {
  it('returns base price when no rules', () => {
    const result = computePrice(100000, [], baseSlot);
    expect(result.final_price).toBe(100000);
    expect(result.applied_rules).toHaveLength(0);
  });

  it('rounds to nearest 1000', () => {
    const result = computePrice(100100, [], baseSlot);
    expect(result.final_price).toBe(100000);
  });

  it('applies PERCENTAGE adjustment correctly', () => {
    const rule: PricingRule = {
      id: 'r1',
      rule_type: 'TIME_RANGE',
      adjustment_type: 'PERCENTAGE',
      value: 20,
      priority: 0,
      stackable: true,
      is_active: true,
      conditions: { days_of_week: [6] }, // Saturday
    };
    const result = computePrice(100000, [rule], baseSlot);
    expect(result.final_price).toBe(120000);
    expect(result.applied_rules).toHaveLength(1);
  });

  it('applies FIXED adjustment correctly', () => {
    const rule: PricingRule = {
      id: 'r1',
      rule_type: 'DATE_SPECIFIC',
      adjustment_type: 'FIXED',
      value: 10000,
      priority: 0,
      stackable: true,
      is_active: true,
      conditions: { dates: ['2026-06-13'] },
    };
    const result = computePrice(100000, [rule], baseSlot);
    expect(result.final_price).toBe(110000);
  });

  it('stops at non-stackable rule', () => {
    const rules: PricingRule[] = [
      {
        id: 'r1',
        rule_type: 'TIME_RANGE',
        adjustment_type: 'PERCENTAGE',
        value: 20,
        priority: 0,
        stackable: false, // stops here
        is_active: true,
        conditions: { days_of_week: [6] },
      },
      {
        id: 'r2',
        rule_type: 'DATE_SPECIFIC',
        adjustment_type: 'FIXED',
        value: 50000,
        priority: 1,
        stackable: true,
        is_active: true,
        conditions: { dates: ['2026-06-13'] },
      },
    ];
    const result = computePrice(100000, rules, baseSlot);
    expect(result.final_price).toBe(120000); // only r1 applied
    expect(result.applied_rules).toHaveLength(1);
  });

  it('sorts rules by priority before applying', () => {
    const rules: PricingRule[] = [
      {
        id: 'r2',
        rule_type: 'DATE_SPECIFIC',
        adjustment_type: 'FIXED',
        value: 10000,
        priority: 2,
        stackable: true,
        is_active: true,
        conditions: { dates: ['2026-06-13'] },
      },
      {
        id: 'r1',
        rule_type: 'TIME_RANGE',
        adjustment_type: 'PERCENTAGE',
        value: 20,
        priority: 1,
        stackable: true,
        is_active: true,
        conditions: { days_of_week: [6] },
      },
    ];
    const result = computePrice(100000, rules, baseSlot);
    // priority 1 first: 100000 * 1.2 = 120000
    // priority 2 next: 120000 + 10000 = 130000
    expect(result.final_price).toBe(130000);
  });

  it('applies DEMAND rule when occupancy threshold met', () => {
    const busySlot: TimeslotContext = { ...baseSlot, capacity: 10, booked_count: 7 };
    const rule: PricingRule = {
      id: 'r1',
      rule_type: 'DEMAND',
      adjustment_type: 'PERCENTAGE',
      value: 15,
      priority: 0,
      stackable: true,
      is_active: true,
      conditions: { min_occupancy: 0.7 },
    };
    const result = computePrice(100000, [rule], busySlot);
    expect(result.final_price).toBe(115000);
  });

  it('skips DEMAND rule when occupancy below threshold', () => {
    const quietSlot: TimeslotContext = { ...baseSlot, capacity: 10, booked_count: 3 };
    const rule: PricingRule = {
      id: 'r1',
      rule_type: 'DEMAND',
      adjustment_type: 'PERCENTAGE',
      value: 15,
      priority: 0,
      stackable: true,
      is_active: true,
      conditions: { min_occupancy: 0.7 },
    };
    const result = computePrice(100000, [rule], quietSlot);
    expect(result.final_price).toBe(100000);
    expect(result.applied_rules).toHaveLength(0);
  });

  it('skips inactive rules', () => {
    const rule: PricingRule = {
      id: 'r1',
      rule_type: 'DATE_SPECIFIC',
      adjustment_type: 'PERCENTAGE',
      value: 50,
      priority: 0,
      stackable: true,
      is_active: false,
      conditions: { dates: ['2026-06-13'] },
    };
    const result = computePrice(100000, [rule], baseSlot);
    expect(result.final_price).toBe(100000);
  });

  it('applies LEAD_TIME rule for short lead time', () => {
    const soonSlot: TimeslotContext = {
      ...baseSlot,
      start_time: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    };
    const rule: PricingRule = {
      id: 'r1',
      rule_type: 'LEAD_TIME',
      adjustment_type: 'PERCENTAGE',
      value: 20,
      priority: 0,
      stackable: true,
      is_active: true,
      conditions: { max_hours: 24 }, // < 24 hours -> +20%
    };
    const result = computePrice(100000, [rule], soonSlot);
    expect(result.final_price).toBe(120000);
  });
});
