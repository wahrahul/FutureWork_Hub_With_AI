import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-clear-local-data-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Clear this app's local data?</h2>
    <mat-dialog-content>
      <p>This removes saved tasks, projects, mood history, meeting notes, search history, and local preferences from this device.</p>
      <p class="dialog-warning">Your Gemini key is session-only and will also be cleared when the page reloads. Other browser data is not affected.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">Cancel</button>
      <button mat-flat-button color="warn" type="button" (click)="confirmClear()"><mat-icon>delete_sweep</mat-icon>Clear app data</button>
    </mat-dialog-actions>
  `,
  styles: `
    :host { display: block; width: min(100%, 420px); }
    mat-dialog-content p { margin: 0 0 12px; color: #354452; font-size: 14px; line-height: 1.5; }
    mat-dialog-content .dialog-warning { color: #647382; font-size: 12px; }
    mat-dialog-actions { gap: 8px; }
  `,
})
export class ClearLocalDataDialog {
  private readonly dialogRef = inject(MatDialogRef<ClearLocalDataDialog, boolean>);

  confirmClear(): void {
    this.dialogRef.close(true);
  }
}
