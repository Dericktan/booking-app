import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const merchants = await prisma.merchant.findMany({
    where: { is_active: true },
    include: { owner: { select: { id: true, email: true } } },
  });
  return NextResponse.json(merchants);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { owner_user_id, name, commission_percentage } = body;

  if (!owner_user_id || !name || commission_percentage === undefined) {
    return NextResponse.json(
      { error: 'owner_user_id, name, commission_percentage required' },
      { status: 400 }
    );
  }

  const merchant = await prisma.merchant.create({
    data: {
      owner_user_id,
      name,
      commission_percentage: Number(commission_percentage),
    },
  });

  return NextResponse.json(merchant, { status: 201 });
}
