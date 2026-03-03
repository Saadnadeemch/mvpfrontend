import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterModule } from '@angular/router';

@Component({
  selector: 'app-pricing',
  imports: [CommonModule, RouterModule],
  templateUrl: './pricing.html',
  styleUrl: './pricing.css',
})
export class Pricing {

  
  isAnnual = false;

  basicFeatures = [
    'Download from 144p up to 1440p quality',
    'All major platforms including YouTube, Instagram and TikTok',
    'Connect your Google Drive',
    'Videos auto-upload to your Drive after download',
    'Download history for the last 30 days',
    'Standard download speed',
  ];

  proFeatures = [
    'Everything in Basic',
    '2K and 4K quality downloads',
    '50 GB personal cloud storage',
    'Connect your Google Drive',
    'Auto-upload to Drive and personal storage',
    'Priority download speed',
    'Full download history with no limits',
    'Early access to new features',
  ];

  faqs: { q: string; a: string; open: boolean }[] = [
    {
      q: 'Do I need a credit card for the free trial?',
      a: 'No. You can start your 1-month free trial without entering any payment details. You will only be charged if you choose to continue after the trial ends.',
      open: false,
    },
    {
      q: 'Can I cancel anytime?',
      a: 'Yes, you can cancel at any time. You will keep full access until the end of your current billing period and you will never be charged unexpectedly.',
      open: false,
    },
    {
      q: 'What happens to my cloud storage if I downgrade?',
      a: 'If you move from Pro to Basic, your files stay safe for 30 days. After that, anything beyond the Basic plan limit will be removed, so make sure to back up anything important before then.',
      open: false,
    },
    {
      q: 'Which platforms are supported?',
      a: 'We support YouTube, Instagram, TikTok, Twitter and X, Facebook, Vimeo, and hundreds of other platforms. If a platform hosts public videos, chances are we can download from it.',
      open: false,
    },
    {
      q: 'What is the difference between Google Drive and personal storage?',
      a: 'Google Drive connects to your own Google account so videos land right in your Drive. Personal cloud storage (Pro only) is 50 GB hosted on our own servers, completely independent of any third-party account.',
      open: false,
    },
  ];

  constructor(private router: Router) {}

  selectPlan(plan: 'basic' | 'pro'): void {
    
    this.router.navigate(['/login'], {
      queryParams: { plan, annual: this.isAnnual },
    });
  }
}
