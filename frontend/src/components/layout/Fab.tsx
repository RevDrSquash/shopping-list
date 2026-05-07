"use client";

type FabProps = {
  label: string;
  icon?: string;
  onClick: () => void;
};

export function Fab({ label, icon = "add", onClick }: FabProps) {
  return (
    <button
      type="button"
      className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-md z-30 inline-flex min-h-14 items-center gap-sm rounded-full bg-primary px-lg py-md text-label-md text-white shadow-card transition hover:bg-primary-container"
      onClick={onClick}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
  );
}
