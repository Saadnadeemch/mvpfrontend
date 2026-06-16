import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Apkdownload } from './apkdownload';

describe('Apkdownload', () => {
  let component: Apkdownload;
  let fixture: ComponentFixture<Apkdownload>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Apkdownload]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Apkdownload);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
