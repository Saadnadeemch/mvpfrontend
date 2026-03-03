import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BasicDashboard } from './basic-dashboard';

describe('BasicDashboard', () => {
  let component: BasicDashboard;
  let fixture: ComponentFixture<BasicDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BasicDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BasicDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
