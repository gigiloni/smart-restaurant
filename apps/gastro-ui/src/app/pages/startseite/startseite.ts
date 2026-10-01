import { Component } from '@angular/core';

@Component({
  selector: 'app-startseite',
  imports: [],
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
