import {AfterViewInit, Component, inject} from '@angular/core';
import { Trefferliste } from '../../components/trefferliste/trefferliste';
import {Select} from "primeng/select";
import {FloatLabel} from "primeng/floatlabel";
import { TableService } from '../../services/table-service';
import type {Table} from "@smart-restaurant/contracts"
import {FormsModule} from "@angular/forms";
import {Router} from "@angular/router";

@Component({
  selector: 'app-startseite',
  imports: [Trefferliste, Select, FloatLabel, FormsModule],
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
