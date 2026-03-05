import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { RouterModule, RouterOutlet, Router } from '@angular/router';
import { AuthService } from './services/auth';
import { Footer } from "./components/footer/footer";
import { NavbarComponent } from "./components/navbar/navbar";
import { ThemeService } from './services/themeService';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, RouterModule, Footer, NavbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App  { 
 
}