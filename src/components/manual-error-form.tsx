"use client";

import { useEffect, useRef } from "react";
import { createManualIncident } from "@/app/actions/errors";
import { buttonPrimary, inputClass, labelClass, textareaClass } from "@/components/ui";

export function ManualErrorForm() {
  const routeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (routeRef.current) {
      routeRef.current.value = window.location.pathname + window.location.search;
    }
  }, []);

  return (
    <form action={createManualIncident} className="space-y-4 p-5">
      <input type="hidden" name="route" ref={routeRef} />
      <div>
        <label className={labelClass} htmlFor="title">Short title</label>
        <input id="title" name="title" required maxLength={160} className={inputClass} placeholder="What went wrong?" />
      </div>
      <div>
        <label className={labelClass} htmlFor="description">What happened?</label>
        <textarea id="description" name="description" required rows={6} maxLength={6000} className={textareaClass} placeholder="Include what you expected, what happened, and any steps to reproduce." />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="severity">Severity</label>
          <select id="severity" name="severity" defaultValue="warning" className={inputClass}>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="error">error</option>
            <option value="critical">critical</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="route">Detected route</label>
          <input id="route" readOnly className={inputClass} placeholder="Filled automatically" />
        </div>
      </div>
      <button type="submit" className={buttonPrimary}>Save incident</button>
    </form>
  );
}
