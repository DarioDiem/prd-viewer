import type { SectionKey, SectionSummary } from "../types/prd";

type SectionRailProps = {
  sections: SectionSummary[];
  activeSection: SectionKey;
  onSelect: (section: SectionKey) => void;
};

export function SectionRail({ sections, activeSection, onSelect }: SectionRailProps) {
  return (
    <nav className="section-rail" aria-label="PRD section navigation">
      {sections.map((section) => (
        <button
          key={section.key}
          type="button"
          className={section.key === activeSection ? "is-active" : ""}
          aria-current={section.key === activeSection ? "page" : undefined}
          onClick={() => onSelect(section.key)}
        >
          <span>{section.label}</span>
          <strong>{section.count}</strong>
        </button>
      ))}
    </nav>
  );
}
