"use client";

type FabProps = {
  label: string;
  icon?: string;
  onClick: () => void;
};

export function Fab({ label, icon = "add", onClick }: FabProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-30">
      <div className="mx-auto flex w-full max-w-page-default justify-end px-container-padding">
        <button
          type="button"
          className="pointer-events-auto inline-flex min-h-14 items-center gap-sm rounded-full bg-primary px-lg py-md text-label-md text-white shadow-card transition hover:bg-primary-container"
          onClick={onClick}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {icon}
          </span>
          {label}
        </button>
      </div>
    </div>
  );
}
