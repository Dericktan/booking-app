import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const service = await prisma.service.findUnique({
    where: { id },
    include: { merchant: true, pricing_rules: true, timeslots: true },
  });
  if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(service);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const service = await prisma.service.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      duration_minutes: body.duration_minutes !== undefined ? Number(body.duration_minutes) : undefined,
      base_price: body.base_price !== undefined ? Number(body.base_price) : undefined,
      dynamic_pricing_enabled: body.dynamic_pricing_enabled !== undefined ? Boolean(body.dynamic_pricing_enabled) : undefined,
    },
  });
  return NextResponse.json(service);
}
