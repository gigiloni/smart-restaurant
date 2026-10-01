import {inject, Injectable, signal} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import type { Table } from '@smart-restaurant/contracts';
import { MessageService } from 'primeng/api';

@Injectable({
  providedIn: 'root',
})
export class TableService {
  protected http = inject(HttpClient);
  protected messageService = inject(MessageService);

  public tablesList = signal<Table[]>([]);
  public selectedTable = signal<Table | null>(null);

  getTables(){
    this.http.get<Table[]>('/api/tables').subscribe({
      next: tableList => {
        this.tablesList.set(tableList)
      },
      error: error => {
        this.messageService.add({
          severity: "error",
          summary: "Fehler",
          detail: "Tische konnten nicht geladen werden."
        })
      }
    })
  }
}
