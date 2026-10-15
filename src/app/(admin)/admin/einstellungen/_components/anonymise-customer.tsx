"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { anonymiseCustomerAction } from "../actions";

/**
 * Two-step confirmation UI for the FADP erasure action.
 *
 * The server action requires formData.confirm === "yes"; we set that
 * hidden field only after the admin confirms a native dialog. This
 * keeps the destructive branch out of accidental double-clicks and
 * stray POSTs.
 */
export function AnonymiseCustomerForm() {
  const [email, setEmail] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLFormElement;
    const confirmField = target.elements.namedItem(
      "confirm",
    ) as HTMLInputElement | null;
    if (!confirmField) return;

    const emailValue = email.trim();
    if (!emailValue) {
      e.preventDefault();
      return;
    }

    const ok = window.confirm(
      `Konto von ${emailValue} wirklich anonymisieren?\n\n` +
        `Diese Aktion ist nicht umkehrbar. Bestellungen bleiben erhalten.`,
    );
    if (!ok) {
      e.preventDefault();
      return;
    }
    confirmField.value = "yes";
    // Form proceeds to submit.
  }

  return (
    <form action={anonymiseCustomerAction} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="confirm" value="" />
      <div className="space-y-2">
        <Label htmlFor="anonymise-email">Kunden-E-Mail</Label>
        <Input
          id="anonymise-email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="kundin@example.ch"
          required
          autoComplete="off"
          className="font-mono text-sm max-w-md"
        />
      </div>
      <Button type="submit" variant="destructive" disabled={!email.trim()}>
        Anonymisieren
      </Button>
    </form>
  );
}
