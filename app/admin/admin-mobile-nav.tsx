"use client";

import Link from "next/link";
import { useState } from "react";

const links = [
  ["Dashboard", "/admin"],
  ["Registration Requests", "/admin/registrations"],
  ["Schools", "/admin/schools"],
  ["Parents", "/admin/parents"],
  ["Students", "/admin/students"],
  ["Staff", "/admin/staff"],
  ["Products", "/admin/products"],
  ["Wallets", "/admin/wallets"],
  ["Top-up Requests", "/admin/topups"],
  ["Pre-Orders", "/admin/orders"],
  ["Sales", "/admin/sales"],
  ["Reports", "/admin/reports"],
  ["Notifications", "/admin/notifications"],
  ["Audit Log", "/admin/audit"],
  ["Settings", "/admin/settings"],
] as const;

export default function AdminMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mobile-admin-nav">
      <button
        type="button"
        className="mobile-menu-button"
        aria-label="Open admin menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>☰</span>
        <span>Menu</span>
      </button>

      {open && (
        <div
          className="mobile-menu-overlay"
          onClick={() => setOpen(false)}
        >
          <div
            className="mobile-menu-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-menu-header">
              <strong>CanteenCo</strong>

              <button
                type="button"
                className="mobile-menu-close"
                aria-label="Close admin menu"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <nav className="mobile-nav">
              {links.map(([label, href]) => (
                <Link
                  href={href}
                  key={label}
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}