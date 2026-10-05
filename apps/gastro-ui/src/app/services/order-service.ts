import { HttpClient } from "@angular/common/http";
import {inject, Injectable} from "@angular/core";
import {CreateOrderDto} from "@smart-restaurant/contracts";
import {TableService} from "./table-service";
import {MessageService} from "primeng/api";

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  protected http = inject(HttpClient);
  protected tableService = inject(TableService)
  protected messageService = inject(MessageService)

  createOrder(orderItemIdList: number[]) {
    let selectedTableId = this.tableService.selectedTable()?.id;
    if (!selectedTableId) throw "Tisch konnte nicht gefunden werden.";
    let createOrderItemList: { productId: number; }[] = [];

    for (let itemId of orderItemIdList) {
      createOrderItemList.push({
        productId: itemId,
      })
    }

    let createOrderDto: CreateOrderDto = {
      tableId: selectedTableId,
      items: createOrderItemList,
    }

    this.http.post('/orders', createOrderDto).subscribe({
      next: () => {
        this.messageService.add({
          summary: 'Bestellung wurde aufgegeben.',
          severity: 'success',
        })
      },
      error: () => {
        this.messageService.add({
          summary: 'Bestellung konnte nicht aufgegeben werden.',
          severity: 'error',
        })
      }
    })
  }
}
