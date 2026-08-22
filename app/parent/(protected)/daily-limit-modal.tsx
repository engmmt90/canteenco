"use client";

import {
  useEffect,
  useState,
  useTransition,
} from "react";

import {
  updateStudentDailyLimit,
} from "@/app/actions/parent-students";

type DailyLimitModalProps = {
  studentId: string;
  studentName: string;
  dailyLimit: number | null;
};

export default function DailyLimitModal({
  studentId,
  studentName,
  dailyLimit,
}: DailyLimitModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] =
    useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateStudentDailyLimit(formData);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        className="secondary"
        onClick={() => setOpen(true)}
      >
        Set Daily Limit
      </button>

      {open && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              if (!isPending) {
                setOpen(false);
              }
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background:
              "rgba(0, 0, 0, 0.55)",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-limit-title"
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#ffffff",
              borderRadius: 16,
              padding: 24,
              boxShadow:
                "0 20px 60px rgba(0, 0, 0, 0.30)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent:
                  "space-between",
                gap: 16,
              }}
            >
              <div>
                <h2
                  id="daily-limit-title"
                  style={{
                    marginTop: 0,
                    marginBottom: 6,
                  }}
                >
                  Daily Spending Limit
                </h2>

                <p
                  className="subtle"
                  style={{
                    marginTop: 0,
                    marginBottom: 0,
                  }}
                >
                  {studentName}
                </p>
              </div>

              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setOpen(false)
                }
                disabled={isPending}
                aria-label="Close"
                style={{
                  minWidth: 42,
                  width: 42,
                  height: 42,
                  padding: 0,
                  fontSize: 20,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div className="divider" />

            <form
              action={handleSubmit}
              className="form"
            >
              <input
                type="hidden"
                name="studentId"
                value={studentId}
              />

              <label className="label">
                Daily spending limit

                <input
                  className="input"
                  type="number"
                  name="dailySpendLimit"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  autoFocus
                  placeholder="No limit"
                  defaultValue={
                    dailyLimit === null
                      ? ""
                      : dailyLimit.toFixed(2)
                  }
                />
              </label>

              <p className="subtle compact">
                Leave this field empty to allow
                unlimited daily spending.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 12,
                }}
              >
                <button
                  type="button"
                  className="secondary"
                  disabled={isPending}
                  onClick={() =>
                    setOpen(false)
                  }
                  style={{
                    flex: 1,
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary"
                  disabled={isPending}
                  style={{
                    flex: 1,
                  }}
                >
                  {isPending
                    ? "Saving..."
                    : "Save Limit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}