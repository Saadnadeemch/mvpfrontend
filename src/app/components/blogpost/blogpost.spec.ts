import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Blogpost } from './blogpost';

describe('Blogpost', () => {
  let component: Blogpost;
  let fixture: ComponentFixture<Blogpost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Blogpost]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Blogpost);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
