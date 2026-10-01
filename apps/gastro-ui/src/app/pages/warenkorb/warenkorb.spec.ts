import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Warenkorb } from './warenkorb';

describe('Warenkorb', () => {
  let component: Warenkorb;
  let fixture: ComponentFixture<Warenkorb>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Warenkorb],
    }).compileComponents();

    fixture = TestBed.createComponent(Warenkorb);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
