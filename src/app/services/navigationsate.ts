import { Injectable, signal } from '@angular/core';
import { VideoInfo } from './download';

@Injectable({
  providedIn: 'root'
})
export class NavigationStateService {
  private _videoInfo = signal<VideoInfo | null>(null);

  setVideoInfo(info: VideoInfo | null) {
    this._videoInfo.set(info);
  }

  getVideoInfo(): VideoInfo | null {
    return this._videoInfo();
  }

  clear() {
    this._videoInfo.set(null);
  }
}