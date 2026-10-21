"use client";

import Link from "next/link";
import { useState } from "react";

import { logout } from "@/app/actions/auth";

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
              <strong>CanteenGo</strong>

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

            <div
              style={{
                borderTop: "1px solid #374151",
                marginTop: "14px",
                paddingTop: "14px",
              }}
            >
              <form action={logout}>
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    border: 0,
                    borderRadius: "9px",
                    padding: "12px",
                    background: "transparent",
                    color: "#fca5a5",
                    font: "inherit",
                    fontWeight: 700,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}