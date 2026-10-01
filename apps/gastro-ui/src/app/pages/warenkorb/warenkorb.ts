import {AfterViewInit, Component, inject, OnInit} from '@angular/core';
import type {CreateOrderDto} from "@smart-restaurant/contracts";
import { MessageService } from 'primeng/api';
import { OrderService } from '../../services/order-service';
import {DataView} from "primeng/dataview";
import { ProductService } from '../../services/product-service';
import {Button} from "primeng/button";
import {CurrencyPipe} from "@angular/common";
import {Image} from "primeng/image";

@Component({
  selector: 'app-warenkorb',
  imports: [
    DataView,
    Button,
    CurrencyPipe,
    Image
  ],
  templateUrl: './warenkorb.html',
  styleUrl: './warenkorb.css',
})
export class Warenkorb implements OnInit, AfterViewInit {
  protected messageService = inject(MessageService);
  protected orderService = inject(OrderService);
  protected productService = inject(ProductService);

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

      this.productService.getProductsById(this.orderItemIdList)
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
