import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { computePrice, PricingRule as EnginePricingRule } from '@/lib/pricing-engine';

const CACHE_TTL = 300; // 5 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const date = request.nextUrl.searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date query param required (YYYY-MM-DD)' }, { status: 400 });
  }

  const cacheKey = `pricing:${id}:${date}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json(JSON.parse(cached));
    }
  } catch {
    // Redis unavailable — continue without cache
  }

  const service = await prisma.service.findUnique({
    where: { id },
    include: { merchant: true, pricing_rules: { where: { is_active: true } } },
  });

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }

  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);

  const timeslots = await prisma.timeslot.findMany({
    where: {
      service_id: id,
      start_time: { gte: startOfDay, lte: endOfDay },
    },
    orderBy: { start_time: 'asc' },
  });

  const rules: EnginePricingRule[] = service.pricing_rules.map((r) => ({
    id: r.id,
    rule_type: r.rule_type as EnginePricingRule['rule_type'],
    adjustment_type: r.adjustment_type as EnginePricingRule['adjustment_type'],
    value: Number(r.value),
    priority: r.priority,
    stackable: r.stackable,
    is_active: r.is_active,
    conditions: r.conditions as Record<string, unknown>,
  }));

  const basePrice = Number(service.base_price);

  const result = timeslots.map((slot) => {
    const context = {
      start_time: slot.start_time,
      end_time: slot.end_time,
      capacity: slot.capacity,
      booked_count: slot.booked_count,
    };
    const pricing = service.dynamic_pricing_enabled
      ? computePrice(basePrice, rules, context)
      : { final_price: basePrice, applied_rules: [] };

    return {
      timeslot_id: slot.id,
      start_time: slot.start_time,
      end_time: slot.end_time,
      capacity: slot.capacity,
      booked_count: slot.booked_count,
      available: slot.booked_count < slot.capacity,
      base_price: basePrice,
      final_price: pricing.final_price,
      applied_rules: pricing.applied_rules,
    };
  });

  const response = {
    service_id: id,
    service_name: service.name,
    date,
    timeslots: result,
  };

  try {
    await redis.set(cacheKey, JSON.stringify(response), 'EX', CACHE_TTL);
  } catch {
    // Redis unavailable — skip caching
  }

  return NextResponse.json(response);
}
