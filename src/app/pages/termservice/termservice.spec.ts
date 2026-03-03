import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Termservice } from './termservice';

describe('Termservice', () => {
  let component: Termservice;
  let fixture: ComponentFixture<Termservice>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Termservice]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Termservice);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
