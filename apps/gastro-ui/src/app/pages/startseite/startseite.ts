import {AfterViewInit, Component, inject} from '@angular/core';
import {TableService} from "../../services/table-service";
import { Table } from '@smart-restaurant/contracts';
import { Router } from '@angular/router';
import {FloatLabel} from "primeng/floatlabel";
import {Select} from "primeng/select";
import {FormsModule} from "@angular/forms";

@Component({
  selector: 'app-startseite',
  imports: [FloatLabel, Select, FormsModule,],
  templateUrl: './startseite.html',
  styleUrl: './startseite.css',
  standalone: true
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

    this.router.navigateByUrl("speisekarte");
  }
}
