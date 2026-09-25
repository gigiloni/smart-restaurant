import { Component, signal } from '@angular/core';
import { Product } from '../../../../interfaces/product';
import { DataViewModule } from 'primeng/dataview';
import { ImageModule } from 'primeng/image';
import { ButtonModule } from 'primeng/button';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-vorspeisen',
  imports: [DataViewModule, ImageModule, ButtonModule, CurrencyPipe],
  templateUrl: './vorspeisen.html',
  styleUrl: './vorspeisen.css',
})
export class Vorspeisen {
  products = signal<Product[]>([]);

  constructor() {
    this.products.set([
      {
        id: 232,
        name: 'spagetti',
        description: 'Spaghetti al Pomodoro San Marzano',
        price: 24,
      },
      {
        id: 545,
        name: 'tagliatelle',
        description: 'Tagliatelle al Ragù della Casa',
        price: 29,
      },
      {
        id: 171,
        name: 'involtini',
        description: 'Involtini di Melanzane alla Siciliana',
        price: 26,
      },
    ]);
  }

  save(id: number): void {
    console.log(id);
  }
}
