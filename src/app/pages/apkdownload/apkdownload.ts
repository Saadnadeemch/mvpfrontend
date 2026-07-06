import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../components/navbar/navbar';


@Component({
  selector: 'app-apkdownload',
  imports: [NavbarComponent],
  templateUrl: './apkdownload.html',
  styleUrl: './apkdownload.css',
})
export class Apkdownload {
  isDark = signal(false);
  downloadStarted = signal(false);
 
  apkUrl = '/buckty.apk'; 
 
  toggleDark() {
    this.isDark.update(v => !v);
    document.documentElement.classList.toggle('dark', this.isDark());
  }
 
  onDownloadClick(event: Event) {
    event.preventDefault();
    if (this.downloadStarted()) return;
    this.downloadStarted.set(true);
    const a = document.createElement('a');
    a.href = this.apkUrl;
    a.download = 'buckty.apk';
    a.click();
    setTimeout(() => this.downloadStarted.set(false), 3000);
  }
}
 