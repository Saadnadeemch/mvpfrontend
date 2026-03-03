import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Authcallback } from './authcallback';

describe('Authcallback', () => {
  let component: Authcallback;
  let fixture: ComponentFixture<Authcallback>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Authcallback]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Authcallback);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
