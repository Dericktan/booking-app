import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { computePrice, PricingRule as EnginePricingRule } from '@/lib/pricing-engine';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { service_id, customer_id, timeslot_id } = body;

  if (!service_id || !customer_id || !timeslot_id) {
    return NextResponse.json(
      { error: 'service_id, customer_id, timeslot_id required' },
      { status: 400 }
    );
  }

  const [service, timeslot] = await Promise.all([
    prisma.service.findUnique({
      where: { id: service_id },
      include: {
        merchant: true,
        pricing_rules: { where: { is_active: true } },
      },
    }),
    prisma.timeslot.findUnique({ where: { id: timeslot_id } }),
  ]);

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }
  if (!timeslot) {
    return NextResponse.json({ error: 'Timeslot not found' }, { status: 404 });
  }
  if (timeslot.service_id !== service_id) {
    return NextResponse.json({ error: 'Timeslot does not belong to service' }, { status: 400 });
  }
  if (timeslot.booked_count >= timeslot.capacity) {
    return NextResponse.json({ error: 'Timeslot is fully booked' }, { status: 409 });
  }

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
  const commissionPercentage = Number(service.merchant.commission_percentage);

  const context = {
    start_time: timeslot.start_time,
    end_time: timeslot.end_time,
    capacity: timeslot.capacity,
    booked_count: timeslot.booked_count,
  };

  const { final_price } = service.dynamic_pricing_enabled
    ? computePrice(basePrice, rules, context)
    : { final_price: basePrice };

  const platform_fee = Math.round((final_price * commissionPercentage) / 100);
  const merchant_earning = final_price - platform_fee;

  const booking = await prisma.$transaction(async (tx) => {
    // Re-check availability inside transaction
    const freshSlot = await tx.timeslot.findUnique({ where: { id: timeslot_id } });
    if (!freshSlot || freshSlot.booked_count >= freshSlot.capacity) {
      throw new Error('SLOT_FULL');
    }

    const newBooking = await tx.booking.create({
      data: {
        service_id,
        merchant_id: service.merchant_id,
        customer_id,
        timeslot_id,
        base_price_snapshot: basePrice,
        final_price_snapshot: final_price,
        commission_percentage_snapshot: commissionPercentage,
        platform_fee_snapshot: platform_fee,
        merchant_earning_snapshot: merchant_earning,
        status: 'CONFIRMED',
      },
    });

    await tx.timeslot.update({
      where: { id: timeslot_id },
      data: { booked_count: { increment: 1 } },
    });

    return newBooking;
  });

  // Invalidate pricing cache
  const slotDate = timeslot.start_time.toISOString().slice(0, 10);
  try {
    await redis.del(`pricing:${service_id}:${slotDate}`);
  } catch {
    // Redis unavailable — skip cache invalidation
  }

  return NextResponse.json(booking, { status: 201 });
}

export async function GET(request: NextRequest) {
  const serviceId = request.nextUrl.searchParams.get('service_id');
  const merchantId = request.nextUrl.searchParams.get('merchant_id');

  const where: Record<string, string> = {};
  if (serviceId) where.service_id = serviceId;
  if (merchantId) where.merchant_id = merchantId;

  const bookings = await prisma.booking.findMany({
    where,
    include: { service: true, timeslot: true, customer: { select: { id: true, email: true } } },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json(bookings);
}
