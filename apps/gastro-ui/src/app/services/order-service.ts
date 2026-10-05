import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CreateOrderDto, Order } from '@smart-restaurant/contracts';
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  createOrder(dto: CreateOrderDto) {
    return this.http.post<Order>('/api/orders', dto);
  }
}
