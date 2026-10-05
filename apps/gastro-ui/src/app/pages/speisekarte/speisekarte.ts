import { Component } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { Vorspeisen } from '../../components/speisekarte/kategorie/vorspeisen/vorspeisen';
import { Hauptgaenge } from '../../components/speisekarte/kategorie/hauptgaenge/hauptgaenge';
import { Getraenke } from '../../components/speisekarte/kategorie/getraenke/getraenke';

@Component({
  selector: 'app-speisekarte',
  imports: [TabsModule, Vorspeisen, Hauptgaenge, Getraenke],
  templateUrl: './speisekarte.html',
  styleUrl: './speisekarte.css',
})
export class Speisekarte {}
