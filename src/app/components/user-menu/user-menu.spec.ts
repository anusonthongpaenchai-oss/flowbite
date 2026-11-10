import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UserMenu } from './user-menu';

describe('UserMenu', () => {
  let component: UserMenu;
  let fixture: ComponentFixture<UserMenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserMenu],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(UserMenu);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
