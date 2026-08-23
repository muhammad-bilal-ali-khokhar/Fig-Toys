"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClassicHelp } from "@/components/help/layouts/classic-help";
import { NewHelp } from "@/components/help/layouts/new-help";
import { HELP_SECTIONS, type HelpSectionId } from "@/lib/constants";
import { useDashboardLayout } from "@/lib/dashboard-layout-context";

export default function HelpPage() {
  const { layout } = useDashboardLayout();
  const searchParams = useSearchParams();
  const requested = searchParams.get("section");
  const valid = HELP_SECTIONS.some((s) => s.id === requested);
  const [section, setSection] = useState<HelpSectionId>(valid ? (requested as HelpSectionId) : "getting-started");

  return layout === "new" ? (
    <NewHelp section={section} onSectionChange={setSection} />
  ) : (
    <ClassicHelp section={section} onSectionChange={setSection} />
  );
}
