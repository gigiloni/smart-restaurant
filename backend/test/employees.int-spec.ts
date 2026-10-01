import { describe, expect, it } from 'vitest';

import { employeeSchema, type Employee } from '@smart-restaurant/contracts';

import { useTestApp } from './support/context.js';
import { count, sql } from './support/database.js';
import { PASSWORD } from './support/fixtures.js';
import { api } from './support/http.js';

const t = useTestApp();

const newEmployee = (fields: Record<string, unknown>) =>
  t.http.post<Employee>('/api/employees', {
    firstname: 'Test',
    lastname: 'Person',
    role: 'BAR',
    password: PASSWORD,
    ...fields,
  });
const signIn = (email: string, password = PASSWORD) =>
  t.http.post('/api/auth/sign-in/email', { email, password });

describe('I-EMP employees', () => {
  it('01 lists staff by family name, then given name, without login details', async () => {
    await t.fixtures.employee('BAR', { firstname: 'Bruno', lastname: 'Rossi' });
    await t.fixtures.employee('BAR', { firstname: 'Anna', lastname: 'Rossi' });
    await t.fixtures.employee('BAR', { firstname: 'Carla', lastname: 'Bianchi' });

    const response = await t.http.get<Employee[]>('/api/employees');

    expect(response.status).toBe(200);
    expect(response.body.map((e) => `${e.firstname} ${e.lastname}`)).toEqual([
      'Carla Bianchi',
      'Anna Rossi',
      'Bruno Rossi',
    ]);
    for (const employee of response.body) {
      expect(Object.keys(employee).sort()).toEqual(['firstname', 'id', 'lastname', 'role']);
    }
  });

  it('02 creates an employee who can sign in; emails are unique regardless of case', async () => {
    const created = await newEmployee({ firstname: ' Ana ', lastname: 'Neu', email: 'Ana.Neu@Test.local' });

    expect(created.status).toBe(201);
    employeeSchema.parse(created.body);
    expect(created.body.firstname).toBe('Ana');
    expect((await signIn('ana.neu@test.local')).status).toBe(200);
    expect((await newEmployee({ email: 'ana.neu@test.local' })).status).toBe(409);
  });

  it('03 exposes sign-in but not public sign-up', async () => {
    expect((await signIn('ana.neu@test.local', 'wrong password!')).status).toBe(401);

    const signUp = await t.http.post('/api/auth/sign-up/email', {
      email: 'new@test.local',
      password: PASSWORD,
      name: 'New',
    });
    expect(signUp.status).toBe(404);
  });

  it('04 validates the payload', async () => {
    expect((await newEmployee({ email: 'short@test.local', password: 'short' })).status).toBe(400);
    expect((await newEmployee({ email: 'chef@test.local', role: 'CHEF' })).status).toBe(400);
  });

  it('05 adds a login to an employee who has none, once', async () => {
    const employee = await t.fixtures.employeeWithoutLogin('SERVICE');
    const url = `/api/employees/${employee.id}/account`;

    expect((await t.http.post(url, { email: 'first@test.local', password: PASSWORD })).status).toBe(201);
    expect((await signIn('first@test.local')).status).toBe(200);
    expect((await t.http.post(url, { email: 'second@test.local', password: PASSWORD })).status).toBe(409);
    expect(
      (await t.http.post('/api/employees/999999/account', { email: 'x@test.local', password: PASSWORD }))
        .status,
    ).toBe(404);
  });

  it('06 never lets the last active admin go', async () => {
    await sql(`UPDATE "Employee" SET role = 'SERVICE' WHERE role = 'ADMIN'`);
    const { employee: first } = await t.fixtures.employee('ADMIN');
    const inactive = await t.fixtures.employeeWithoutLogin('ADMIN');

    expect((await t.http.patch(`/api/employees/${first.id}`, { role: 'SERVICE' })).status).toBe(409);
    expect((await t.http.delete(`/api/employees/${first.id}`)).status).toBe(409);
    // An admin without a login does not count, and may be demoted.
    expect((await t.http.patch(`/api/employees/${inactive.id}`, { role: 'SERVICE' })).status).toBe(200);

    const { employee: second } = await t.fixtures.employee('ADMIN');
    expect((await t.http.patch(`/api/employees/${first.id}`, { role: 'SERVICE' })).status).toBe(200);
    expect((await t.http.delete(`/api/employees/${second.id}`)).status).toBe(409);
  });

  it('07 keeps employees who took orders, and deletes the login with the employee', async () => {
    const table = await t.fixtures.table();
    const { employee: waiter } = await t.fixtures.employee('SERVICE');
    await t.fixtures.order(table.id, [], { employeeId: waiter.id });
    expect((await t.http.delete(`/api/employees/${waiter.id}`)).status).toBe(409);

    const { employee, email } = await t.fixtures.employee('BAR');
    expect((await t.http.delete(`/api/employees/${employee.id}`)).status).toBe(200);
    expect(await count('user', 'email = $1', [email])).toBe(0);
    expect((await signIn(email)).status).toBe(401);
  });

  it("08 renames the employee's login too", async () => {
    const { employee, email } = await t.fixtures.employee('BAR', { firstname: 'Old', lastname: 'Name' });

    await t.http.patch(`/api/employees/${employee.id}`, { firstname: 'New' });

    const [user] = await sql<{ name: string }>('SELECT name FROM "user" WHERE email = $1', [email]);
    expect(user.name).toBe('New Name');
  });

  it('09 answers /employees/me for signed-in staff only', async () => {
    expect((await t.http.get('/api/employees/me')).status).toBe(401);

    const table = await t.fixtures.table();
    const guest = await t.fixtures.guest(table.id);
    expect((await guest.api.get('/api/employees/me')).status).toBe(401);

    const cook = await t.fixtures.staff('KITCHEN');
    const me = await cook.api.get<Employee>('/api/employees/me');
    expect(me.status).toBe(200);
    expect(me.body).toEqual(cook.employee);
  });

  it('10 returns one employee or 404', async () => {
    const { employee } = await t.fixtures.employee('SERVICE');

    expect((await t.http.get(`/api/employees/${employee.id}`)).body).toEqual(employee);
    expect((await t.http.get('/api/employees/999999')).status).toBe(404);
  });

  it('11 signs out', async () => {
    const waiter = await t.fixtures.staff('SERVICE');
    const signOut = await waiter.api.post('/api/auth/sign-out');

    expect(signOut.status).toBe(200);
    expect((await api(t.app, waiter.cookie).get('/api/employees/me')).status).toBe(401);
  });
});
