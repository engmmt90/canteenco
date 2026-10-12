import Link from "next/link";

import { parentLogin } from "@/app/actions/auth";

type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ParentLoginPage({
  searchParams,
}: PageProps) {
  const { error } = await searchParams;

  return (
    <main className="shell">
      <section className="card">
        <h1 className="brand">
          CanteenGo
        </h1>

        <p className="subtle">
          Parent Portal — manage your family
          wallet, children and pre-orders.
        </p>

        {error ===
        "invalid_credentials" ? (
          <p
            className="alert"
            role="alert"
          >
            Invalid email or password, or
            your account is not active yet.
          </p>
        ) : null}

        <form
          className="form"
          action={parentLogin}
        >
          <label className="label">
            Email

            <input
              className="input"
              type="email"
              name="email"
              autoComplete="email"
              required
            />
          </label>

          <label className="label">
            Password

            <input
              className="input"
              type="password"
              name="password"
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: -4,
            }}
          >
            <Link
              href="/parent/forgot-password"
              style={{
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Forgot password?
            </Link>
          </div>

          <button
            className="primary"
            type="submit"
          >
            Parent Login
          </button>
        </form>

        <div className="divider" />

        <div
          className="stack"
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          <Link
            className="secondary"
            href="/parent/register"
          >
            Create Parent Account
          </Link>

          <Link
            className="secondary"
            href="/parent/contact"
          >
            Contact Us
          </Link>

          <div
            style={{
              textAlign: "center",
              marginTop: 8,
            }}
          >
            <p
              style={{
                margin: 0,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              CanteenGo mobile apps are coming soon.
            </p>
            <p
              className="subtle"
              style={{
                margin: "4px 0 0",
                fontSize: 13,
              }}
            >
              In the meantime, please continue using the website.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              width: "100%",
              marginTop: 6,
            }}
          >
            <div
              aria-label="CanteenGo Parent on Google Play — coming soon"
              aria-disabled="true"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                minHeight: 56,
                padding: "8px 14px",
                borderRadius: 12,
                background: "#000000",
                color: "#ffffff",
                boxSizing: "border-box",
                opacity: 0.65,
                cursor: "default",
                userSelect: "none",
              }}
            >
              <svg
                width="28"
                height="32"
                viewBox="0 0 24 27"
                aria-hidden="true"
              >
                <path
                  d="M1.5 1.8 14.8 13.5 1.5 25.2Z"
                  fill="#34A853"
                />
                <path
                  d="M14.8 13.5 18.5 10.3 22.8 12.7c1.1.6 1.1 1.6 0 2.2l-4.3 2.4Z"
                  fill="#FBBC04"
                />
                <path
                  d="m1.5 1.8 17 8.5-3.7 3.2Z"
                  fill="#4285F4"
                />
                <path
                  d="m1.5 25.2 17-7.9-3.7-3.8Z"
                  fill="#EA4335"
                />
              </svg>

              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  lineHeight: 1,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 500,
                  }}
                >
                  GET IT ON
                </span>

                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    marginTop: 2,
                  }}
                >
                  Google Play
                </span>
              </span>
            </div>

            <div
              aria-label="CanteenGo Parent on the App Store — coming soon"
              aria-disabled="true"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                minHeight: 56,
                padding: "8px 14px",
                borderRadius: 12,
                background: "#000000",
                color: "#ffffff",
                boxSizing: "border-box",
                opacity: 0.65,
                cursor: "default",
                userSelect: "none",
              }}
            >
              <svg
                width="28"
                height="34"
                viewBox="0 0 24 30"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M19.5 15.9c0-3.4 2.8-5 2.9-5.1-1.6-2.3-4-2.6-4.9-2.6-2.1-.2-4.1 1.2-5.1 1.2-1 0-2.6-1.2-4.3-1.1-2.2 0-4.3 1.3-5.5 3.3-2.4 4.1-.6 10.1 1.7 13.4 1.1 1.6 2.5 3.4 4.3 3.3 1.7-.1 2.4-1.1 4.5-1.1 2.1 0 2.7 1.1 4.5 1.1 1.9 0 3.1-1.7 4.2-3.3 1.3-1.9 1.9-3.8 1.9-3.9-.1 0-4.2-1.6-4.2-5.2ZM16.1 6c.9-1.1 1.6-2.7 1.4-4.2-1.3.1-2.9.9-3.8 2-.8.9-1.6 2.5-1.4 4 1.5.1 2.9-.7 3.8-1.8Z" />
              </svg>

              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  lineHeight: 1,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 500,
                  }}
                >
                  Download on the
                </span>

                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    marginTop: 2,
                  }}
                >
                  App Store
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
