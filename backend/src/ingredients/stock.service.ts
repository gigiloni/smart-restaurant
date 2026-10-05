import { ConflictException, Injectable } from '@nestjs/common';
import { Propagation, TransactionHost, Transactional } from '@nestjs-cls/transactional';
import type { PrismaAdapter } from '../database/transaction.js';
import type { Ingredient } from '../generated/prisma/client.js';
import { OrderEventsWriter } from '../order-events/order-events.writer.js';

@Injectable()
export class StockService {
  constructor(
    private readonly host: TransactionHost<PrismaAdapter>,
    private readonly events: OrderEventsWriter,
  ) {}
  private get db() {
    return this.host.tx;
  }

  /** Parent order/session is already locked. Ingredient locks are always sorted. */
  @Transactional(Propagation.Mandatory)
  async book(items: { id: number; productId: number }[], attempt = 0): Promise<Ingredient[]> {
    const recipes = await this.db.productIngredient.findMany({
      where: { productId: { in: items.map((item) => item.productId) }, amount: { gt: 0 } },
    });
    const rows = items.flatMap((item) =>
      recipes
        .filter((recipe) => recipe.productId === item.productId)
        .map((recipe) => ({
          orderItemId: item.id,
          ingredientId: recipe.ingredientId,
          amount: recipe.amount,
          attempt,
        })),
    );
    const totals = new Map<number, number>();
    for (const row of rows)
      totals.set(row.ingredientId, (totals.get(row.ingredientId) ?? 0) + row.amount);
    const changed: Ingredient[] = [];
    for (const [id, amount] of [...totals].sort(([a], [b]) => a - b)) {
      const [ingredient] = await this.db.$queryRaw<
        Ingredient[]
      >`SELECT ingredient_id AS id, name, unit, stock FROM "Ingredient" WHERE ingredient_id = ${id} FOR UPDATE`;
      if (!ingredient || ingredient.stock < amount)
        throw new ConflictException(
          `Nicht genügend Bestand: ${ingredient?.name ?? id}. Benötigt: ${amount} ${ingredient?.unit ?? ''}, verfügbar: ${ingredient?.stock ?? 0}.`,
        );
      changed.push(
        await this.db.ingredient.update({ where: { id }, data: { stock: { decrement: amount } } }),
      );
    }
    if (rows.length) await this.db.stockBooking.createMany({ data: rows });
    return changed;
  }

  @Transactional(Propagation.Mandatory)
  async refund(items: { id: number; preparationStarted: boolean }[]): Promise<Ingredient[]> {
    const bookings = await this.db.stockBooking.findMany({
      where: {
        orderItemId: {
          in: items.filter((item) => !item.preparationStarted).map((item) => item.id),
        },
        refunded: false,
      },
    });
    const totals = new Map<number, number>();
    for (const booking of bookings)
      totals.set(booking.ingredientId, (totals.get(booking.ingredientId) ?? 0) + booking.amount);
    const changed: Ingredient[] = [];
    for (const [id, amount] of [...totals].sort(([a], [b]) => a - b)) {
      await this.db
        .$queryRaw`SELECT ingredient_id FROM "Ingredient" WHERE ingredient_id = ${id} FOR UPDATE`;
      changed.push(
        await this.db.ingredient.update({
          where: { id },
          data: { stock: { increment: amount } },
        }),
      );
    }
    if (bookings.length)
      await this.db.stockBooking.updateMany({
        where: { id: { in: bookings.map((booking) => booking.id) } },
        data: { refunded: true },
      });
    return changed;
  }

  /** Append only after every business write in the calling transaction. */
  async publish(ingredients: Ingredient[]): Promise<void> {
    for (const ingredient of ingredients)
      await this.events.inventoryUpdated(
        ingredient.id,
        ingredient as Ingredient & { unit: 'g' | 'ml' | 'Stück' },
      );
  }
}
