"use client";

import { LogOut, Mail, Save, UserRound } from "lucide-react";

type AuthPanelProps = {
  configured: boolean;
  email: string;
  userEmail: string | null;
  status: string;
  isSaving: boolean;
  onEmailChange: (email: string) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSave: () => void;
};

export function AuthPanel({
  configured,
  email,
  userEmail,
  status,
  isSaving,
  onEmailChange,
  onSignIn,
  onSignOut,
  onSave
}: AuthPanelProps) {
  return (
    <section className="auth-panel" aria-label="Account and cabinet saving">
      <div className="auth-heading">
        <UserRound size={18} />
        <span>{userEmail ?? (configured ? "Save your cabinet" : "Demo cabinet")}</span>
      </div>

      {configured && !userEmail ? (
        <div className="auth-row">
          <label className="sr-only" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="email@example.com"
            type="email"
          />
          <button className="icon-button filled" type="button" onClick={onSignIn} title="Send sign-in link">
            <Mail size={16} />
            <span>Email link</span>
          </button>
        </div>
      ) : (
        <div className="auth-row">
          <button className="icon-button filled" type="button" onClick={onSave} disabled={isSaving} title="Save cabinet">
            <Save size={16} />
            <span>{isSaving ? "Saving" : "Save"}</span>
          </button>
          {userEmail ? (
            <button className="icon-button quiet" type="button" onClick={onSignOut} title="Sign out">
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          ) : null}
        </div>
      )}

      <p className="status-line">{status}</p>
    </section>
  );
}
