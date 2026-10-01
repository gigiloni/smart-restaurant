import { AfterViewInit, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Table } from '@smart-restaurant/contracts';
import { TableService } from '../../services/table-service';
import { Select } from 'primeng/select';
import { FloatLabel } from 'primeng/floatlabel';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-startseite',
  imports: [
    Select,
    FloatLabel,
    FormsModule,
  ],
  templateUrl: './startseite.html',
  styleUrl: './startseite.css',
})
export class Startseite implements AfterViewInit {
  protected tableService = inject(TableService);
  protected selectedTable: Table | null = null;
  protected router = inject(Router);

  ngAfterViewInit() {
    this.tableService.getTables()
  }

  selectTable() {
    this.tableService.selectedTable.set(this.selectedTable);

    this.router.navigateByUrl("menu");
  }
}
