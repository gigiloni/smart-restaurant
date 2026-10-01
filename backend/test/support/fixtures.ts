import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import type {
  Employee,
  EmployeeRole,
  Ingredient,
  Order,
  Product,
  ProductType,
  Table,
  TableSession,
} from '@smart-restaurant/contracts';

import { sql } from './database.js';
import { api, cookiesOf, type Api } from './http.js';

export const PASSWORD = 'correct horse battery staple';

/**
 * Builds test data through the API, as a client would. Keys that must be
 * unique come from a counter: random ones collide sooner or later and make the
 * suite flaky.
 */
export class Fixtures {
  private next = 1;
  private readonly anonymous: Api;

  constructor(private readonly app: NestFastifyApplication) {
    this.anonymous = api(app);
  }

  private unique(): number {
    return this.next++;
  }

  async table(seats = 4): Promise<Table> {
    return this.created(
      await this.anonymous.post<Table>('/api/tables', { tableNumber: 100 + this.unique(), seats }),
    );
  }

  async ingredient(name = `Ingredient ${this.unique()}`): Promise<Ingredient> {
    return this.created(await this.anonymous.post<Ingredient>('/api/ingredients', { name }));
  }

  async product(type: ProductType = 'FOOD', extra: Record<string, unknown> = {}): Promise<Product> {
    return this.created(
      await this.anonymous.post<Product>('/api/products', {
        name: `Product ${String(this.unique()).padStart(4, '0')}`,
        price: 9.5,
        type,
        ...extra,
      }),
    );
  }

  /** An employee with an email/password login. */
  async employee(role: EmployeeRole, names: { firstname?: string; lastname?: string } = {}) {
    const email = `employee${this.unique()}@test.local`;
    const employee = this.created(
      await this.anonymous.post<Employee>('/api/employees', {
        firstname: names.firstname ?? 'Test',
        lastname: names.lastname ?? role,
        role,
        email,
        password: PASSWORD,
      }),
    );

    return { employee, email };
  }

  /**
   * An employee row without a login. The API always creates both, so this is
   * written directly, like the sample data and the bootstrap script do.
   */
  async employeeWithoutLogin(role: EmployeeRole): Promise<Employee> {
    const [row] = await sql<Employee>(
      `INSERT INTO "Employee" (firstname, lastname, role) VALUES ('No', 'Login', $1)
       RETURNING employee_id AS id, firstname, lastname, role::text AS role`,
      [role],
    );

    return row;
  }

  /** Session cookie of a successful sign-in. */
  async signIn(email: string, password = PASSWORD): Promise<string> {
    const response = await this.anonymous.post('/api/auth/sign-in/email', { email, password });

    if (response.status !== 200) {
      throw new Error(`Sign-in failed with ${response.status}: ${JSON.stringify(response.body)}`);
    }

    return cookiesOf(response);
  }

  /** A signed-in employee and an API client acting as them. */
  async staff(role: EmployeeRole) {
    const { employee, email } = await this.employee(role);
    const cookie = await this.signIn(email);

    return { employee, cookie, api: api(this.app, cookie) };
  }

  /** A guest who scanned the table's QR code, and an API client acting as them. */
  async guest(tableId: number) {
    const qr = await this.anonymous.get<{ token: string }>(`/api/tables/${tableId}/qr-code`);
    const response = await this.anonymous.post<TableSession>('/api/viewer/guest', {
      tableId,
      token: qr.body.token,
    });

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Guest entry failed with ${response.status}`);
    }

    const cookie = cookiesOf(response);

    return { session: response.body, cookie, response, api: api(this.app, cookie) };
  }

  async seat(tableId: number): Promise<TableSession> {
    const response = await this.anonymous.post<TableSession>('/api/table-sessions', { tableId });

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Seating failed with ${response.status}`);
    }

    return response.body;
  }

  async order(
    tableId: number,
    productIds: number[] = [],
    extra: Record<string, unknown> = {},
  ): Promise<Order> {
    return this.created(
      await this.anonymous.post<Order>('/api/orders', {
        tableId,
        items: productIds.map((productId) => ({ productId })),
        ...extra,
      }),
    );
  }

  /** Walks every item of the order to SERVED. */
  async serveAll(order: Order): Promise<void> {
    for (const item of order.orderItems) {
      for (const status of ['IN_PROGRESS', 'READY', 'SERVED']) {
        const response = await this.anonymous.patch(
          `/api/orders/${order.id}/items/${item.id}`,
          { status },
        );

        if (response.status !== 200) {
          throw new Error(`Moving item ${item.id} to ${status} failed with ${response.status}`);
        }
      }
    }
  }

  /** Serves everything on the order and takes payment. */
  async pay(order: Order): Promise<Order> {
    await this.serveAll(order);
    const response = await this.anonymous.post<Order>(`/api/orders/${order.id}/close`);

    if (response.status !== 200) {
      throw new Error(`Closing order ${order.id} failed with ${response.status}`);
    }

    return response.body;
  }

  private created<T>(response: { status: number; body: T }): T {
    if (response.status !== 201) {
      throw new Error(`Fixture request failed with ${response.status}: ${JSON.stringify(response.body)}`);
    }

    return response.body;
  }
}
