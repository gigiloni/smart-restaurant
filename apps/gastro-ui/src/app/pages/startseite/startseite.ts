import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Select } from 'primeng/select';
import { TableService } from '../../services/table-service';
@Component({
  selector: 'app-startseite',
  imports: [RouterLink, FormsModule, Select],
  templateUrl: './startseite.html',
  styleUrl: './startseite.css',
})
export class Startseite {
  protected readonly tables = inject(TableService);
  protected readonly tableOptions = computed(() =>
    this.tables.tablesList().map((table) => ({
      id: table.id,
      label: `Tisch ${table.tableNumber}`,
    })),
  );
  private readonly router = inject(Router);
  constructor() {
    this.tables.getTables();
  }
  continue(): void {
    if (this.tables.selectedTable()) void this.router.navigateByUrl('/speisekarte');
  }
}
