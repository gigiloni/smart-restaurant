import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import {Toast} from "primeng/toast";

@Component({
  imports: [RouterModule, Toast],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'gastro-ui';
}
