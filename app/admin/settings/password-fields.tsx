"use client";

import {
  useState,
} from "react";

type PasswordInputProps = {
  label: string;
  name: string;
  autoComplete:
    | "current-password"
    | "new-password";
  minLength?: number;
};

function PasswordInput({
  label,
  name,
  autoComplete,
  minLength,
}: PasswordInputProps) {
  const [
    visible,
    setVisible,
  ] = useState(false);

  return (
    <label className="label">
      {label}

      <div
        style={{
          position: "relative",
          width: "100%",
        }}
      >
        <input
          className="input"
          type={
            visible
              ? "text"
              : "password"
          }
          name={name}
          autoComplete={
            autoComplete
          }
          minLength={
            minLength
          }
          required
          style={{
            width: "100%",
            paddingRight: 46,
          }}
        />

        <button
          type="button"
          aria-label={
            visible
              ? `Hide ${label}`
              : `Show ${label}`
          }
          onClick={() =>
            setVisible(
              (value) =>
                !value,
            )
          }
          style={{
            position:
              "absolute",
            right: 8,
            top: "50%",
            transform:
              "translateY(-50%)",
            width: 34,
            height: 34,
            display: "grid",
            placeItems:
              "center",
            padding: 0,
            border: 0,
            borderRadius: 8,
            background:
              "transparent",
            cursor:
              "pointer",
          }}
        >
          {visible ? (
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
              <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9.5 5 10 8a11.8 11.8 0 0 1-2.2 4.2" />
              <path d="M6.6 6.6C4.1 8 2.5 10.3 2 12c.8 3 4.5 8 10 8a10 10 0 0 0 3-.5" />
            </svg>
          ) : (
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle
                cx="12"
                cy="12"
                r="3"
              />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}

export default function PasswordFields() {
  return (
    <>
      <PasswordInput
        label="Current Password"
        name="currentPassword"
        autoComplete="current-password"
      />

      <PasswordInput
        label="New Password"
        name="newPassword"
        autoComplete="new-password"
        minLength={8}
      />

      <PasswordInput
        label="Confirm New Password"
        name="confirmPassword"
        autoComplete="new-password"
        minLength={8}
      />
    </>
  );
}