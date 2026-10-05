import assert from 'node:assert/strict';
import test from 'node:test';

// Run only against a disposable migrated database; this suite creates audit data.
const base = process.env.TEST_API_URL;
const email = process.env.TEST_ADMIN_EMAIL;
const password = process.env.TEST_ADMIN_PASSWORD;
if (!base || !email || !password || process.env.BETA_INTEGRATION_ALLOW_WRITES !== 'yes') {
  throw new Error(
    'Set TEST_API_URL, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD and BETA_INTEGRATION_ALLOW_WRITES=yes for a disposable test backend.',
  );
}
const origin = process.env.TEST_FRONTEND_ORIGIN ?? new URL(base).origin;
const suffix = Date.now().toString(36);
class Client {
  cookies = new Map();
  async request(path, method = 'GET', body, expected = 200) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        Origin: origin,
        Cookie: this.cookie(),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const equals = pair.indexOf('=');
      this.cookies.set(pair.slice(0, equals), pair.slice(equals + 1));
    }
    const data = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  }
  cookie() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }
  async login(email, password) {
    await this.request('/auth/sign-in/email', 'POST', { email, password, rememberMe: false });
  }
}
async function stream(client, cursor) {
  const controller = new AbortController();
  const response = await fetch(`${base}/api/live/events?since=${cursor}`, {
    headers: { Cookie: client.cookie(), Origin: origin },
    signal: controller.signal,
  });
  assert.equal(response.status, 200);
  const received = [];
  const decoder = new TextDecoder();
  let buffer = '';
  const reader = response.body.getReader();
  const running = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const lines = block.split('\n');
          const type = lines
            .find((line) => line.startsWith('event:'))
            ?.slice(6)
            .trim();
          const data = lines
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('\n');
          if (type && data) received.push({ type, data: JSON.parse(data) });
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    }
  })();
  async function wait(predicate) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const value = received.find(predicate);
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.fail(`SSE event missing; types: ${received.map((event) => event.type).join(',')}`);
  }
  await wait((event) => event.type === 'ready');
  return {
    received,
    wait,
    close: async () => {
      controller.abort();
      await running;
    },
  };
}

test(
  'Beta: real auth, guest visits, role scopes, SSE and stock transactions',
  { timeout: 90000 },
  async (t) => {
    const anon = new Client(),
      admin = new Client();
    await admin.login(email, password);
    const roleClients = {};
    let ingredient, drinkIngredient, food, drink, table1, table2, guest1, guest2, order, service;
    const streams = [];
    t.after(async () => {
      for (const source of streams) await source.close();
    });
    await t.test('public menu stays public; private APIs and CSRF stay protected', async () => {
      await anon.request('/products');
      await anon.request('/tables');
      await anon.request('/viewer');
      for (const path of [
        '/orders',
        '/employees',
        '/ingredients',
        '/table-sessions',
        '/live/snapshot',
      ])
        await anon.request(path, 'GET', undefined, 401);
      const response = await fetch(`${base}/api/ingredients`, {
        method: 'POST',
        headers: {
          Cookie: admin.cookie(),
          Origin: 'https://foreign.example',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Forbidden' }),
      });
      assert.equal(response.status, 403);
      await admin.request('/employees/1', 'PATCH', { role: 'SERVICE' }, 409);
    });
    await t.test(
      'admin creates all role accounts and catalog; other roles cannot administer',
      async () => {
        for (const role of ['SERVICE', 'KITCHEN', 'BAR']) {
          const employee = await admin.request(
            '/employees',
            'POST',
            {
              firstname: 'Beta',
              lastname: role,
              role,
              email: `${role.toLowerCase()}-${suffix}@example.test`,
              password: 'BetaRoleTestOnly-2026!',
            },
            201,
          );
          if (role === 'SERVICE') service = employee;
          const client = new Client();
          await client.login(
            `${role.toLowerCase()}-${suffix}@example.test`,
            'BetaRoleTestOnly-2026!',
          );
          roleClients[role] = client;
          await client.request('/employees/me');
          await client.request('/ingredients', 'GET', undefined, 403);
          await client.request(
            '/products',
            'POST',
            { name: 'Denied', price: 1, type: 'FOOD' },
            403,
          );
        }
        ingredient = await admin.request(
          '/ingredients',
          'POST',
          { name: `Beta flour ${suffix}`, unit: 'g', stock: 100 },
          201,
        );
        await admin.request(`/ingredients/${ingredient.id}`, 'PATCH', {}, 400);
        await admin.request(`/ingredients/${ingredient.id}`, 'PATCH', { expectedStock: 100 }, 400);
        drinkIngredient = await admin.request(
          '/ingredients',
          'POST',
          { name: `Beta water ${suffix}`, unit: 'ml', stock: 500 },
          201,
        );
        food = await admin.request(
          '/products',
          'POST',
          {
            name: `Beta dish ${suffix}`,
            type: 'FOOD',
            price: 12,
            ingredients: [{ ingredientId: ingredient.id, amount: 10 }],
          },
          201,
        );
        drink = await admin.request(
          '/products',
          'POST',
          {
            name: `Beta drink ${suffix}`,
            type: 'DRINK',
            price: 3,
            ingredients: [{ ingredientId: drinkIngredient.id, amount: 50 }],
          },
          201,
        );
        const publicProduct = await anon.request(`/products/${food.id}`);
        assert.equal('stock' in publicProduct.ingredients[0].ingredient, false);
        table1 = await admin.request('/tables', 'POST', { tableNumber: 10001, seats: 2 }, 201);
        table2 = await admin.request('/tables', 'POST', { tableNumber: 10002, seats: 2 }, 201);
      },
    );
    await t.test(
      'one QR entry establishes a reloadable cookie restricted to the visit',
      async () => {
        guest1 = new Client();
        guest2 = new Client();
        for (const [guest, table] of [
          [guest1, table1],
          [guest2, table2],
        ]) {
          const qr = await admin.request(`/tables/${table.id}/qr-code`);
          await guest.request('/viewer/guest', 'POST', { tableId: table.id, token: qr.token }, 201);
          const viewer = await guest.request('/viewer');
          assert.equal(viewer.kind, 'guest');
          assert.equal(viewer.tableId, table.id);
        }
        const invalid = new Client();
        await invalid.request(
          '/viewer/guest',
          'POST',
          { tableId: table1.id, token: 'not-a-valid-qr-token' },
          403,
        );
        await guest1.request(
          '/orders',
          'POST',
          { tableId: table2.id, items: [{ productId: food.id }] },
          409,
        );
        const freshPage = new Client();
        freshPage.cookies = new Map(guest1.cookies);
        assert.equal((await freshPage.request('/viewer')).tableId, table1.id);
        await freshPage.request('/live/snapshot');
      },
    );
    await t.test(
      'mixed order books stock; stations and guests see only permitted data over REST and SSE',
      async () => {
        for (const client of [admin, guest1, guest2, roleClients.KITCHEN, roleClients.BAR]) {
          const snapshot = await client.request('/live/snapshot');
          streams.push(await stream(client, snapshot.cursor));
        }
        order = await guest1.request(
          '/orders',
          'POST',
          { tableId: table1.id, items: [{ productId: food.id }, { productId: drink.id }] },
          201,
        );
        assert.equal((await admin.request(`/ingredients/${ingredient.id}`)).stock, 90);
        assert.equal((await admin.request(`/ingredients/${drinkIngredient.id}`)).stock, 450);
        await streams[0].wait(
          (event) =>
            event.type === 'inventory.updated' && event.data.data.ingredientId === ingredient.id,
        );
        const customerEvent = await streams[1].wait(
          (event) => event.type === 'order.created' && event.data.data.order.id === order.id,
        );
        assert.equal(customerEvent.data.data.order.employee, null);
        for (const [role, source] of [
          ['KITCHEN', streams[3]],
          ['BAR', streams[4]],
        ]) {
          const event = await source.wait(
            (event) => event.type === 'order.created' && event.data.data.order.id === order.id,
          );
          assert.equal(event.data.data.order.orderItems.length, 1);
          assert.equal(
            event.data.data.order.orderItems[0].product.type,
            role === 'BAR' ? 'DRINK' : 'FOOD',
          );
          const scoped = await roleClients[role].request(`/orders/${order.id}`);
          assert.equal(scoped.orderItems.length, 1);
        }
        assert.equal(
          streams[2].received.some(
            (event) => event.type === 'order.created' && event.data.data.order.id === order.id,
          ),
          false,
        );
        for (const source of streams.slice(1))
          assert.equal(
            source.received.some((event) => event.type === 'inventory.updated'),
            false,
          );
        await guest2.request(`/orders/${order.id}`, 'GET', undefined, 404);
        await guest1.request('/ingredients', 'GET', undefined, 401);
        await roleClients.KITCHEN.request(
          `/orders/${order.id}/items/${order.orderItems[1].id}`,
          'GET',
          undefined,
          404,
        );
      },
    );
    await t.test(
      'workflow permissions, actual remake consumption, retries and stale stock edits',
      async () => {
        const dish = order.orderItems.find((item) => item.productId === food.id),
          beverage = order.orderItems.find((item) => item.productId === drink.id);
        await roleClients.BAR.request(
          `/orders/${order.id}/items/${dish.id}`,
          'PATCH',
          { status: 'IN_PROGRESS' },
          403,
        );
        await roleClients.SERVICE.request(
          `/orders/${order.id}/items/${dish.id}`,
          'PATCH',
          { status: 'IN_PROGRESS' },
          403,
        );
        await roleClients.KITCHEN.request(
          `/orders/${order.id}/items/${dish.id}`,
          'PATCH',
          { status: 'SERVED' },
          403,
        );
        await roleClients.KITCHEN.request(`/orders/${order.id}/items/${dish.id}`, 'PATCH', {
          status: 'IN_PROGRESS',
        });
        await roleClients.KITCHEN.request(`/orders/${order.id}/items/${dish.id}`, 'PATCH', {
          status: 'READY',
        });
        await roleClients.SERVICE.request(`/orders/${order.id}/items/${dish.id}`, 'PATCH', {
          status: 'REMAKE',
        });
        assert.equal((await admin.request(`/ingredients/${ingredient.id}`)).stock, 90);
        await roleClients.KITCHEN.request(`/orders/${order.id}/items/${dish.id}`, 'PATCH', {
          status: 'IN_PROGRESS',
        });
        await roleClients.KITCHEN.request(`/orders/${order.id}/items/${dish.id}`, 'PATCH', {
          status: 'IN_PROGRESS',
        });
        assert.equal((await admin.request(`/ingredients/${ingredient.id}`)).stock, 80);
        await admin.request(
          `/ingredients/${ingredient.id}`,
          'PATCH',
          { stock: 110, expectedStock: 90 },
          409,
        );
        await admin.request(`/ingredients/${ingredient.id}`, 'PATCH', { unit: 'ml' }, 409);
        await roleClients.BAR.request(`/orders/${order.id}/items/${beverage.id}`, 'PATCH', {
          status: 'READY',
        });
        await roleClients.KITCHEN.request(`/orders/${order.id}/items/${dish.id}`, 'PATCH', {
          status: 'READY',
        });
        await roleClients.SERVICE.request(`/orders/${order.id}/items/${dish.id}`, 'PATCH', {
          status: 'SERVED',
        });
        await roleClients.SERVICE.request(`/orders/${order.id}/items/${beverage.id}`, 'PATCH', {
          status: 'SERVED',
        });
        const snapshot = await guest1.request('/live/snapshot');
        const replay = await stream(guest1, snapshot.cursor);
        streams.push(replay);
        await admin.request(`/orders/${order.id}`, 'PATCH', { employeeId: service.id });
        await replay.wait(
          (event) => event.type === 'order.updated' && event.data.data.order.id === order.id,
        );
      },
    );
    await t.test(
      'paid orders survive refresh; clearing the whole visit revokes access',
      async () => {
        await roleClients.SERVICE.request(`/orders/${order.id}/close`, 'POST', {});
        await roleClients.SERVICE.request(`/orders/${order.id}/close`, 'POST', {});
        assert.equal((await guest1.request(`/orders/${order.id}`)).status, 'CLOSED');
        assert.equal(
          (await guest1.request('/live/snapshot')).orders.find((entry) => entry.id === order.id)
            .status,
          'CLOSED',
        );
        await roleClients.KITCHEN.request(`/orders/${order.id}`, 'GET', undefined, 404);
        await roleClients.SERVICE.request(
          `/table-sessions/${order.tableSessionId}/close`,
          'POST',
          {},
        );
        await streams[1].wait(
          (event) =>
            event.type === 'session.closed' && event.data.data.session.id === order.tableSessionId,
        );
        assert.equal(await guest1.request('/viewer'), null);
        await guest1.request('/live/snapshot', 'GET', undefined, 401);
      },
    );
    await t.test(
      'refund uses booked quantities after recipe edits, and never refunds begun preparation',
      async () => {
        const untouched = await guest2.request(
          '/orders',
          'POST',
          { tableId: table2.id, items: [{ productId: food.id }] },
          201,
        );
        await admin.request(`/products/${food.id}`, 'PATCH', {
          ingredients: [{ ingredientId: ingredient.id, amount: 30 }],
        });
        await admin.request(`/orders/${untouched.id}`, 'DELETE');
        assert.equal((await admin.request(`/ingredients/${ingredient.id}`)).stock, 80);
        const prepared = await guest2.request(
          '/orders',
          'POST',
          { tableId: table2.id, items: [{ productId: food.id }] },
          201,
        );
        await roleClients.KITCHEN.request(
          `/orders/${prepared.id}/items/${prepared.orderItems[0].id}`,
          'PATCH',
          { status: 'IN_PROGRESS' },
        );
        await roleClients.KITCHEN.request(
          `/orders/${prepared.id}/items/${prepared.orderItems[0].id}`,
          'PATCH',
          { status: 'OPEN' },
        );
        await admin.request(`/orders/${prepared.id}`, 'DELETE');
        assert.equal((await admin.request(`/ingredients/${ingredient.id}`)).stock, 50);
      },
    );
    await t.test(
      'insufficient mixed order rolls back completely; concurrent orders cannot oversell',
      async () => {
        await admin.request(`/ingredients/${ingredient.id}`, 'PATCH', { stock: 30 });
        await admin.request(`/ingredients/${drinkIngredient.id}`, 'PATCH', { stock: 0 });
        const before = await guest2.request('/orders');
        await guest2.request(
          '/orders',
          'POST',
          { tableId: table2.id, items: [{ productId: food.id }, { productId: drink.id }] },
          409,
        );
        assert.equal((await guest2.request('/orders')).length, before.length);
        assert.equal((await admin.request(`/ingredients/${ingredient.id}`)).stock, 30);
        const qr = await admin.request(`/tables/${table1.id}/qr-code`);
        await guest1.request('/viewer/guest', 'POST', { tableId: table1.id, token: qr.token }, 201);
        const results = await Promise.all(
          [guest1, guest2].map(async (client) => {
            const viewer = await client.request('/viewer');
            const response = await fetch(`${base}/api/orders`, {
              method: 'POST',
              headers: {
                Cookie: client.cookie(),
                Origin: origin,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ tableId: viewer.tableId, items: [{ productId: food.id }] }),
            });
            await response.json();
            return response.status;
          }),
        );
        assert.deepEqual(results.sort(), [201, 409]);
        assert.equal((await admin.request(`/ingredients/${ingredient.id}`)).stock, 0);
      },
    );
    await t.test('password change keeps current login and logout revokes the session', async () => {
      await roleClients.BAR.request('/auth/change-password', 'POST', {
        currentPassword: 'BetaRoleTestOnly-2026!',
        newPassword: 'BetaChangedOnly-2026!',
        revokeOtherSessions: true,
      });
      await roleClients.BAR.request('/viewer');
      await roleClients.BAR.request('/auth/sign-out', 'POST', {});
      assert.equal(await roleClients.BAR.request('/viewer'), null);
      await roleClients.BAR.request('/employees/me', 'GET', undefined, 401);
    });
  },
);
