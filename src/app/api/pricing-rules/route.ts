import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const serviceId = request.nextUrl.searchParams.get('service_id');
  const rules = await prisma.pricingRule.findMany({
    where: serviceId ? { service_id: serviceId } : undefined,
    orderBy: { priority: 'asc' },
  });
  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { service_id, rule_type, adjustment_type, value, priority, stackable, is_active, conditions } = body;

  if (!service_id || !rule_type || !adjustment_type || value === undefined || !conditions) {
    return NextResponse.json(
      { error: 'service_id, rule_type, adjustment_type, value, conditions required' },
      { status: 400 }
    );
  }

  const rule = await prisma.pricingRule.create({
    data: {
      service_id,
      rule_type,
      adjustment_type,
      value: Number(value),
      priority: priority !== undefined ? Number(priority) : 0,
      stackable: stackable !== undefined ? Boolean(stackable) : true,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      conditions,
    },
  });

  return NextResponse.json(rule, { status: 201 });
}
