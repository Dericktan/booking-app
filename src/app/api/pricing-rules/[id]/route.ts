import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const rule = await prisma.pricingRule.update({
    where: { id },
    data: {
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : undefined,
      value: body.value !== undefined ? Number(body.value) : undefined,
      priority: body.priority !== undefined ? Number(body.priority) : undefined,
      stackable: body.stackable !== undefined ? Boolean(body.stackable) : undefined,
      conditions: body.conditions,
    },
  });
  return NextResponse.json(rule);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.pricingRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
