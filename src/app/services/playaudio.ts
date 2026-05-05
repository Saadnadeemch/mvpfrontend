import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class Playaudio {

  private platformId = inject(PLATFORM_ID);

  private audioUnlocked = false;
  private completionAudio: HTMLAudioElement | null = null;

  private ensureAudio() {
    if (!isPlatformBrowser(this.platformId)) return;

    if (!this.completionAudio) {
      this.completionAudio = new Audio('complete.mp3'); 
    }
  }

  unlock() {
    this.ensureAudio();

    if (!this.completionAudio || this.audioUnlocked) return;

    this.completionAudio.play()
      .then(() => {
        this.completionAudio!.pause();
        this.completionAudio!.currentTime = 0;
        this.audioUnlocked = true;
      })
      .catch(() => {
        console.warn('Audio unlock failed (needs user interaction)');
      });
  }

  playCompletion() {
    this.ensureAudio();

    if (!this.completionAudio || !this.audioUnlocked) return;

    this.completionAudio.currentTime = 0;
    this.completionAudio.play().catch(() => {});
  }
}