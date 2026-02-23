import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const merchantId = request.nextUrl.searchParams.get('merchant_id');
  const services = await prisma.service.findMany({
    where: merchantId ? { merchant_id: merchantId } : undefined,
    include: { merchant: true },
    orderBy: { created_at: 'desc' },
  });
  return NextResponse.json(services);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { merchant_id, name, description, duration_minutes, base_price, dynamic_pricing_enabled } = body;

  if (!merchant_id || !name || !duration_minutes || base_price === undefined) {
    return NextResponse.json({ error: 'merchant_id, name, duration_minutes, base_price required' }, { status: 400 });
  }

  const service = await prisma.service.create({
    data: {
      merchant_id,
      name,
      description,
      duration_minutes: Number(duration_minutes),
      base_price: Number(base_price),
      dynamic_pricing_enabled: Boolean(dynamic_pricing_enabled),
    },
  });

  return NextResponse.json(service, { status: 201 });
}
