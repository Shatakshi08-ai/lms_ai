import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSWORD,
  appRequest,
  auth,
  closeTestDb,
  connectTestDb,
  createUser,
  mail,
} from './helpers.js';

describe('authentication', () => {
  let api;

  before(async () => {
    await connectTestDb();
    api = appRequest();
  });

  after(async () => {
    await closeTestDb();
  });

  it('registers with valid member data', async () => {
    const email = mail('reg-member');
    const res = await api.post('/api/v1/auth/register').send({
      name: 'New Member',
      email,
      password: PASSWORD,
      role: 'MEMBER',
      phone: '9990001111',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.accessToken);
    assert.equal(res.body.user.role, 'MEMBER');
    assert.equal(res.body.user.email, email);
  });

  it('registers with valid student data', async () => {
    const res = await api.post('/api/v1/auth/register').send({
      name: 'New Student',
      email: mail('reg-student'),
      password: PASSWORD,
      role: 'STUDENT',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'STUDENT');
  });

  it('rejects registration with missing data', async () => {
    const res = await api.post('/api/v1/auth/register').send({ name: 'Only Name' });
    assert.equal(res.status, 400);
  });

  it('rejects invalid email', async () => {
    const res = await api.post('/api/v1/auth/register').send({
      name: 'Bad Email',
      email: 'not-an-email',
      password: PASSWORD,
    });
    assert.equal(res.status, 400);
  });

  it('rejects weak password', async () => {
    const res = await api.post('/api/v1/auth/register').send({
      name: 'Weak Pw',
      email: mail('weak'),
      password: 'short',
    });
    assert.equal(res.status, 400);
  });

  it('rejects duplicate email', async () => {
    const email = mail('dup');
    await api.post('/api/v1/auth/register').send({ name: 'First', email, password: PASSWORD });
    const res = await api.post('/api/v1/auth/register').send({ name: 'Second', email, password: PASSWORD });
    assert.equal(res.status, 409);
  });

  it('logs in successfully', async () => {
    const user = await createUser({ role: 'STUDENT' });
    const res = await api.post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
    assert.equal(res.status, 200);
    assert.ok(res.body.accessToken);
    assert.equal(res.body.user.email, user.email);
  });

  it('rejects incorrect password', async () => {
    const user = await createUser({ role: 'MEMBER' });
    const res = await api.post('/api/v1/auth/login').send({ email: user.email, password: 'WrongPass1' });
    assert.equal(res.status, 401);
  });

  it('rejects non-existing user', async () => {
    const res = await api.post('/api/v1/auth/login').send({
      email: 'nobody@questlearn.test',
      password: PASSWORD,
    });
    assert.equal(res.status, 401);
  });

  it('rejects empty login fields', async () => {
    const res = await api.post('/api/v1/auth/login').send({});
    assert.equal(res.status, 400);
  });

  it('logs out', async () => {
    const user = await createUser({ role: 'STUDENT' });
    const login = await api.post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
    const res = await api.post('/api/v1/auth/logout').set(auth(login.body.accessToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it('protects /auth/me without a token', async () => {
    const res = await api.get('/api/v1/auth/me');
    assert.equal(res.status, 401);
  });

  it('rejects invalid access token', async () => {
    const res = await api.get('/api/v1/auth/me').set(auth('not-a-jwt'));
    assert.equal(res.status, 401);
  });

  it('returns the current user with a valid token', async () => {
    const user = await createUser({ role: 'ADMIN' });
    const login = await api.post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
    const res = await api.get('/api/v1/auth/me').set(auth(login.body.accessToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'ADMIN');
  });

  it('blocks patrons from admin-only APIs', async () => {
    const user = await createUser({ role: 'STUDENT' });
    const login = await api.post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
    const res = await api.get('/api/v1/ai/report').set(auth(login.body.accessToken));
    assert.equal(res.status, 403);
  });
});
