import { Component, signal } from '@angular/core';
import { DataViewModule } from 'primeng/dataview';
import { Product } from '../../../../interfaces/product';

@Component({
  selector: 'app-getraenke',
  imports: [DataViewModule],
  templateUrl: './getraenke.html',
  styleUrl: './getraenke.css',
})
export class Getraenke {
  produkte = signal<Product[]>([]);

  constructor() {
    this.produkte.set([
      { id: 1, name: 'spagetti', description: 'Spaghetti al Pomodoro San Marzano', price: 24 },
      { id: 2, name: 'tagliatelle', description: 'Tagliatelle al Ragù della Casa', price: 29 },
      { id: 3, name: 'involtini', description: 'Involtini di Melanzane alla Siciliana', price: 26 },
    ]);
  }
}
