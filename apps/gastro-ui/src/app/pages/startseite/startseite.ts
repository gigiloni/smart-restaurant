import { Component } from '@angular/core';
import { Trefferliste } from '../../components/trefferliste/trefferliste';

@Component({
  selector: 'app-startseite',
  imports: [Trefferliste],
  templateUrl: './startseite.html',
  styleUrl: './startseite.css',
})
export class Startseite {}
