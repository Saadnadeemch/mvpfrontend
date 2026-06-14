import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Footer } from "../../components/footer/footer";
import { NavbarComponent } from "../../components/navbar/navbar";

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterModule, Footer, NavbarComponent],
  templateUrl: './pricing.html',
  styleUrl: './pricing.css',
})
export class Pricing {

  isAnnual   = false;
  savingPlan: 'basic' | 'advanced' | null = null;
  saveError: string | null = null;


  constructor(
    private router: Router,
    private auth: AuthService,
  ) {}


  async selectPlan(plan_type: 'basic' | 'advanced'): Promise<void> {
  if (this.savingPlan !== null) return;

  this.savingPlan = plan_type;
  this.saveError  = null;

  const { error } = await this.auth.savePlanSelection({
    plan_type,
    isAnnual: this.isAnnual,
  });

  this.savingPlan = null;

  if (error) {
    this.saveError = 'Something went wrong saving your plan.';
    this.router.navigate(['/']);
    return;
  }

  this.router.navigate(['/dashboard'], {
    queryParams: { plan: plan_type, annual: this.isAnnual },
  });
}


basicFeatures = [
  'Download from 144p up to 4K quality',
  'All major platforms including YouTube, Instagram and TikTok',
  'Connect your Google Drive',
  'Auto video upload to your Drive',
  'Download history for the last 30 days',
  'Standard download speed',
  'No personal storage included',
];

proFeatures = [
  'Everything in Basic',
  '2K and 4K optimized ultra-fast downloads',
  '50 GB personal cloud storage',
  'Connect Google Drive + personal storage',
  'Auto-upload to Drive and personal storage',
  'Priority download speed',
  'Unlimited download history',
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
}