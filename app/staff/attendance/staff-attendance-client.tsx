"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  clockInStaff,
  clockOutStaff,
  lookupStaffByNfc,
} from "@/app/actions/staff-attendance";

type LookupSuccess = Extract<
  Awaited<
    ReturnType<
      typeof lookupStaffByNfc
    >
  >,
  { ok: true }
>;

export default function StaffAttendanceClient() {
  const [nfc, setNfc] =
    useState("");

  /*
   * Keep the NFC value after a
   * successful lookup.
   *
   * This is what will be sent back
   * to the server for Clock In /
   * Clock Out instead of staff.id.
   */
  const [
    verifiedNfc,
    setVerifiedNfc,
  ] = useState("");

  const [lookup, setLookup] =
    useState<LookupSuccess | null>(
      null,
    );

  const [
    selectedSchoolId,
    setSelectedSchoolId,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [busy, setBusy] =
    useState(false);

  const nfcRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  function focusNfc() {
    window.setTimeout(() => {
      nfcRef.current?.focus();
      nfcRef.current?.select();
    }, 50);
  }

  function resetForNextCard() {
    setNfc("");
    setVerifiedNfc("");
    setLookup(null);
    setSelectedSchoolId("");
    focusNfc();
  }

  useEffect(() => {
    focusNfc();
  }, []);

  async function scanCard() {
    const card =
      nfc.trim();

    if (
      !card ||
      busy
    ) {
      focusNfc();
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const result =
        await lookupStaffByNfc(
          card,
        );

      if (!result.ok) {
        setLookup(null);
        setVerifiedNfc("");
        setMessage(
          result.error,
        );
        setNfc("");
        focusNfc();

        return;
      }

      /*
       * Keep the exact NFC value
       * that was successfully
       * verified by the server.
       */
      setVerifiedNfc(
        card,
      );

      setLookup(
        result,
      );

      if (
        result.openAttendance
      ) {
        setSelectedSchoolId(
          result
            .openAttendance
            .schoolId,
        );
      } else {
        setSelectedSchoolId(
          result.schools[0]
            ?.id ?? "",
        );
      }

      /*
       * Clear the visible NFC field.
       * The verified value remains in
       * verifiedNfc until the action.
       */
      setNfc("");
    } finally {
      setBusy(false);
    }
  }

  async function clockIn() {
    if (
      !lookup ||
      !selectedSchoolId ||
      !verifiedNfc ||
      busy
    ) {
      return;
    }

    setBusy(true);
    setMessage("");

    /*
     * Copy the verified card before
     * clearing it.
     *
     * We treat each verified NFC scan
     * as single-use.
     */
    const card =
      verifiedNfc;

    setVerifiedNfc("");

    try {
      const result =
        await clockInStaff({
          nfcCardNumber:
            card,

          schoolId:
            selectedSchoolId,
        });

      if (!result.ok) {
        setMessage(
          result.error,
        );

        window.setTimeout(
          resetForNextCard,
          1800,
        );

        return;
      }

      setMessage(
        `✓ ${result.fullName} clocked in at ${result.schoolName} at ${new Date(
          result.timestamp,
        ).toLocaleTimeString(
          [],
          {
            hour:
              "2-digit",
            minute:
              "2-digit",
          },
        )}.`,
      );

      window.setTimeout(
        resetForNextCard,
        1800,
      );
    } finally {
      setBusy(false);
    }
  }

  async function clockOut() {
    if (
      !lookup ||
      !verifiedNfc ||
      busy
    ) {
      return;
    }

    setBusy(true);
    setMessage("");

    /*
     * Again, the server receives the
     * NFC value and derives staff.id
     * itself.
     */
    const card =
      verifiedNfc;

    setVerifiedNfc("");

    try {
      const result =
        await clockOutStaff(
          card,
        );

      if (!result.ok) {
        setMessage(
          result.error,
        );

        window.setTimeout(
          resetForNextCard,
          1800,
        );

        return;
      }

      setMessage(
        `✓ ${result.fullName} clocked out from ${result.schoolName} at ${new Date(
          result.timestamp,
        ).toLocaleTimeString(
          [],
          {
            hour:
              "2-digit",
            minute:
              "2-digit",
          },
        )}.`,
      );

      window.setTimeout(
        resetForNextCard,
        1800,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 16,
      }}
    >
      <section className="panel form">
        <label className="label">
          Staff NFC Card

          <input
            ref={nfcRef}
            className="input"
            value={nfc}
            onChange={(
              event,
            ) => {
              setNfc(
                event.target
                  .value,
              );

              setMessage(
                "",
              );
            }}
            onKeyDown={(
              event,
            ) => {
              if (
                event.key ===
                "Enter"
              ) {
                event.preventDefault();

                void scanCard();
              }
            }}
            placeholder="Tap staff NFC card"
            autoComplete="off"
          />
        </label>

        <button
          type="button"
          className="primary"
          onClick={() =>
            void scanCard()
          }
          disabled={
            busy ||
            !nfc.trim()
          }
        >
          {busy
            ? "Checking…"
            : "Read Card"}
        </button>
      </section>

      {lookup && (
        <section className="panel">
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              gap: 12,

              flexWrap:
                "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  marginTop:
                    0,

                  marginBottom:
                    4,
                }}
              >
                {
                  lookup
                    .staff
                    .fullName
                }
              </h2>

              <p className="subtle compact">
                {
                  lookup
                    .staff
                    .role
                }

                {lookup.staff
                  .baseSchoolName
                  ? ` · Base: ${lookup.staff.baseSchoolName}`
                  : ""}
              </p>
            </div>

            <button
              type="button"
              className="secondary"
              onClick={
                resetForNextCard
              }
            >
              Scan Another Card
            </button>
          </div>

          {lookup.openAttendance ? (
            <>
              <div className="divider" />

              <p>
                Currently clocked in at{" "}
                <strong>
                  {
                    lookup
                      .openAttendance
                      .schoolName
                  }
                </strong>
                .
              </p>

              <p className="subtle compact">
                Since{" "}
                {new Date(
                  lookup
                    .openAttendance
                    .clockInAt,
                ).toLocaleString()}
              </p>

              <button
                type="button"
                className="primary"
                style={{
                  width:
                    "100%",
                }}
                disabled={
                  busy ||
                  !verifiedNfc
                }
                onClick={() =>
                  void clockOut()
                }
              >
                {busy
                  ? "Processing…"
                  : "Clock Out"}
              </button>
            </>
          ) : (
            <>
              <div className="divider" />

              <label className="label">
                Working at

                <select
                  className="input"
                  value={
                    selectedSchoolId
                  }
                  onChange={(
                    event,
                  ) =>
                    setSelectedSchoolId(
                      event
                        .target
                        .value,
                    )
                  }
                >
                  {lookup.schools.map(
                    (
                      school,
                    ) => (
                      <option
                        key={
                          school.id
                        }
                        value={
                          school.id
                        }
                      >
                        {
                          school.name
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <button
                type="button"
                className="primary"
                style={{
                  width:
                    "100%",
                }}
                disabled={
                  busy ||
                  !selectedSchoolId ||
                  !verifiedNfc
                }
                onClick={() =>
                  void clockIn()
                }
              >
                {busy
                  ? "Processing…"
                  : "Clock In"}
              </button>
            </>
          )}
        </section>
      )}

      {message && (
        <p
          className={
            message.startsWith(
              "✓",
            )
              ? "success"
              : "alert"
          }
        >
          {message}
        </p>
      )}
    </div>
  );
}