"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  title: string;
  buttonLabel: string;
  children: ReactNode;
  openOnLoad?: boolean;
};

export default function WalletReportDialog({ title, buttonLabel, children, openOnLoad = false }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (openOnLoad && !dialog.current?.open) dialog.current?.showModal();
  }, [openOnLoad]);

  return (
    <>
      <button className="secondary" type="button" onClick={() => dialog.current?.showModal()}>
        {buttonLabel}
      </button>
      <dialog
        ref={dialog}
        aria-label={title}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
        style={{ width: "min(560px, calc(100vw - 32px))", maxHeight: "calc(100vh - 32px)", overflowY: "auto", border: "1px solid #d1d5db", borderRadius: 16, padding: 24, boxShadow: "0 20px 60px #0004" }}
      >
        <div className="page-heading" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button type="button" className="secondary" aria-label="Close" onClick={() => dialog.current?.close()}>Close</button>
        </div>
        {children}
      </dialog>
    </>
  );
}
