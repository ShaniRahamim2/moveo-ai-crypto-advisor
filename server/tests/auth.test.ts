import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { prismaMock, resetPrismaMock } from './helpers/prismaMock.js';

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }));

const { createApp } = await import('../src/app.js');
const app = createApp();

const existingUser = {
  id: 'user_1',
  name: 'Existing User',
  email: 'existing@example.com',
  onboardingCompleted: false,
};

beforeEach(() => {
  resetPrismaMock();
});

describe('POST /api/auth/register', () => {
  it('creates an account and returns a token', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ ...existingUser, email: 'new@example.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: 'new@example.com', password: 'correct-horse' });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('new@example.com');
  });

  it('stores a bcrypt hash rather than the password', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(existingUser);

    await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: 'new@example.com', password: 'correct-horse' });

    const { passwordHash } = prismaMock.user.create.mock.calls[0]![0].data;
    expect(passwordHash).not.toBe('correct-horse');
    expect(passwordHash).toMatch(/^\$2[aby]\$/);
    await expect(bcrypt.compare('correct-horse', passwordHash)).resolves.toBe(true);
  });

  it('never returns the password hash', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(existingUser);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: 'new@example.com', password: 'correct-horse' });

    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('rejects a duplicate email with 409', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: existingUser.id });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Someone', email: 'existing@example.com', password: 'correct-horse' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('rejects invalid input with 400 and field details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'email',
      'name',
      'password',
    ]);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('normalizes email casing and surrounding whitespace', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(existingUser);

    await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: '  MixedCase@Example.COM ', password: 'correct-horse' });

    expect(prismaMock.user.create.mock.calls[0]![0].data.email).toBe('mixedcase@example.com');
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token for correct credentials', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...existingUser,
      passwordHash: await bcrypt.hash('correct-horse', 10),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'existing@example.com', password: 'correct-horse' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.id).toBe('user_1');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('rejects a wrong password with 401', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...existingUser,
      passwordHash: await bcrypt.hash('correct-horse', 10),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'existing@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('gives the same error for an unknown email as for a wrong password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...existingUser,
      passwordHash: await bcrypt.hash('correct-horse', 10),
    });
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'existing@example.com', password: 'wrong-password' });

    prismaMock.user.findUnique.mockResolvedValue(null);
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' });

    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(unknownEmail.body.error.message).toBe(wrongPassword.body.error.message);
  });
});

describe('GET /api/auth/me', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt');

    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(existingUser);

    const registered = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: 'new@example.com', password: 'correct-horse' });

    prismaMock.user.findUnique.mockResolvedValue(existingUser);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registered.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(existingUser);
  });
});
