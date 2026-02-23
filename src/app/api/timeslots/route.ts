import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const serviceId = request.nextUrl.searchParams.get('service_id');
  const timeslots = await prisma.timeslot.findMany({
    where: serviceId ? { service_id: serviceId } : undefined,
    orderBy: { start_time: 'asc' },
  });
  return NextResponse.json(timeslots);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { service_id, start_time, end_time, capacity } = body;

  if (!service_id || !start_time || !end_time || capacity === undefined) {
    return NextResponse.json({ error: 'service_id, start_time, end_time, capacity required' }, { status: 400 });
  }

  const timeslot = await prisma.timeslot.create({
    data: {
      service_id,
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      capacity: Number(capacity),
    },
  });

  return NextResponse.json(timeslot, { status: 201 });
}
