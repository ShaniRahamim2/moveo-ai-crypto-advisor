import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/apiError.js';
import { signToken } from '../lib/jwt.js';
import type { LoginInput, RegisterInput } from '../validation/auth.schema.js';

const BCRYPT_ROUNDS = 10;

/**
 * Compared against when no account matches, so that a failed login costs the
 * same whether or not the address is registered.
 *
 * Generated at startup rather than written as a literal. A hand-written constant
 * was previously one character short of a valid bcrypt hash, so bcrypt rejected
 * it outright in well under a millisecond instead of doing the work — the
 * mitigation looked present in the code and measurably did not exist, leaking
 * account existence through response time.
 */
const ABSENT_USER_HASH = bcrypt.hashSync('password-for-an-account-that-does-not-exist', BCRYPT_ROUNDS);

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  onboardingCompleted: boolean;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  onboardingCompleted: true,
} as const;

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash },
    select: publicUserSelect,
  });

  return { token: signToken(user.id), user };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...publicUserSelect, passwordHash: true },
  });

  // Same error for unknown email and wrong password: distinguishing them tells
  // an attacker which addresses are registered.
  const invalid = ApiError.unauthorized('Incorrect email or password');

  if (!user) {
    await bcrypt.compare(input.password, ABSENT_USER_HASH);
    throw invalid;
  }

  if (!(await bcrypt.compare(input.password, user.passwordHash))) {
    throw invalid;
  }

  const { passwordHash: _passwordHash, ...publicUser } = user;
  return { token: signToken(publicUser.id), user: publicUser };
}

export async function getUserById(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id }, select: publicUserSelect });

  if (!user) {
    throw ApiError.unauthorized('Account no longer exists');
  }

  return user;
}
