import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TableService } from '../../services/table-service';
@Component({
  selector: 'app-startseite',
  imports: [RouterLink],
  templateUrl: './startseite.html',
  styleUrl: './startseite.css',
})
export class Startseite {
  protected readonly tables = inject(TableService);
  private readonly router = inject(Router);
  constructor() {
    this.tables.getTables();
  }
  selectTable(event: Event): void {
    this.tables.select(Number((event.target as HTMLSelectElement).value));
  }
  continue(): void {
    if (this.tables.selectedTable()) void this.router.navigateByUrl('/speisekarte');
  }
}
