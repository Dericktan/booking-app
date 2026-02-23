import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, role } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 });
  }

  // In a real app, hash the password. For POC, we store a placeholder.
  const user = await prisma.user.create({
    data: {
      email,
      password_hash: `hashed_${password}`,
      role: role ?? 'CUSTOMER',
    },
    select: { id: true, email: true, role: true, created_at: true },
  });

  return NextResponse.json(user, { status: 201 });
}

export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, created_at: true },
    orderBy: { created_at: 'desc' },
  });
  return NextResponse.json(users);
}
