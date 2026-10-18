import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

export type GeminiSettingsDialogResult =
  | { action: 'save'; apiKey: string }
  | { action: 'clear' };

@Component({
  selector: 'app-gemini-settings-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Gemini settings</h2>
    <mat-dialog-content>
      <p class="dialog-copy">Connect Gemini for mood reflection, task prioritization, meeting summaries, and knowledge search.</p>
      <mat-form-field appearance="outline" class="dialog-field">
        <mat-label>Gemini API key</mat-label>
        <input matInput type="password" name="geminiKey" autocomplete="off" [(ngModel)]="apiKey" />
        <mat-icon matSuffix>key</mat-icon>
      </mat-form-field>
      <p class="dialog-privacy">Gemini 3.8 Flash is listed as free of charge on Google's Free tier, subject to account and rate limits. Free-tier prompts may be used to improve Google products. Avoid confidential or personal information.</p>
      <p class="dialog-privacy">The key stays in memory for this tab. Requests are sent directly to Google; never paste a key on a shared device.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (data.configured) {
        <button mat-button type="button" color="warn" (click)="clearKey()">Remove key</button>
      }
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" type="button" [disabled]="!apiKey.trim()" (click)="saveKey()">
        {{ data.configured ? 'Replace key' : 'Connect Gemini' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host { display: block; width: min(100%, 432px); }
    .dialog-copy { margin: 0 0 20px; color: #526170; font-size: 14px; line-height: 1.5; }
    .dialog-field { width: 100%; }
    .dialog-privacy { margin: 0 0 8px; color: #526170; font-size: 12px; line-height: 1.5; }
    mat-dialog-actions { gap: 8px; flex-wrap: wrap; }
  `,
})
export class GeminiSettingsDialog {
  readonly data = inject<{ configured: boolean }>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<GeminiSettingsDialog, GeminiSettingsDialogResult>);
  apiKey = '';

  saveKey(): void {
    const apiKey = this.apiKey.trim();
    if (apiKey) this.dialogRef.close({ action: 'save', apiKey });
  }

  clearKey(): void {
    this.dialogRef.close({ action: 'clear' });
  }
}
