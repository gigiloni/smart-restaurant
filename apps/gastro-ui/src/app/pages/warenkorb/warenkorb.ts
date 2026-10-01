import {AfterViewInit, Component, inject, OnInit} from '@angular/core';
import type {CreateOrderDto} from "@smart-restaurant/contracts";
import { MessageService } from 'primeng/api';
import { OrderService } from '../../services/order-service';

@Component({
  selector: 'app-warenkorb',
  imports: [],
  templateUrl: './warenkorb.html',
  styleUrl: './warenkorb.css',
})
export class Warenkorb implements OnInit, AfterViewInit {
  protected messageService = inject(MessageService);
  protected orderService = inject(OrderService);

  private warenkorb: CreateOrderDto | undefined;
  private orderItemIdList: number[] = [];
  private itemsInWarenkorb = false;

  constructor() {
    sessionStorage.setItem('warenkorb', '[1,5,10]');
  }

  ngOnInit() {
    let warenkorbString = sessionStorage.getItem("warenkorb");
    let orderItemsIdList;
    if (warenkorbString) orderItemsIdList = JSON.parse(warenkorbString);
    if (orderItemsIdList && orderItemsIdList instanceof Array && orderItemsIdList.length > 0) {
      this.orderItemIdList = orderItemsIdList;
      this.itemsInWarenkorb = true;
    } else {
      this.itemsInWarenkorb = false;
    }


  }

  ngAfterViewInit() {
    if (!this.itemsInWarenkorb) {
      this.messageService.add({
        summary: 'Warenkorb leer',
        detail: 'Bitte erst Artikel dem Warenkorb hinzufügen.',
        severity: 'warning'
      })
    }
  }

  createOrder() {
    this.orderService.createOrder(this.orderItemIdList)
  }

}
