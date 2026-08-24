import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

import {
  addPickupSlot,
  deletePickupSlot,
  saveSchoolSettings,
  togglePickupSlot,
} from "@/app/actions/school-settings";

function getString(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function getNumber(
  formData: FormData,
  name: string,
  fallback = 0,
) {
  const value = Number(formData.get(name) ?? fallback);

  return Number.isFinite(value) ? value : fallback;
}

async function assertSchoolAccess(schoolId: string) {
  const session = await requireAdmin();

  if (
    session.user.role === "SCHOOL_ADMIN" &&
    session.user.schoolId !== schoolId
  ) {
    throw new Error("Unauthorized");
  }

  return session;
}

/* -------------------------------------------------------------------------- */
/*                                ADD CLASS                                   */
/* -------------------------------------------------------------------------- */

async function addSchoolClass(formData: FormData) {
  "use server";

  const schoolId = getString(formData, "schoolId");
  const name = getString(formData, "name");
  const grade = getString(formData, "grade");
  const section = getString(formData, "section");
  const classCode = getString(formData, "classCode").toUpperCase();
  const sortOrder = getNumber(formData, "sortOrder", 0);

  if (
    !schoolId ||
    !name ||
    !grade ||
    !section ||
    !classCode
  ) {
    throw new Error(
      "Class name, year, section and class code are required.",
    );
  }

  await assertSchoolAccess(schoolId);

  const existing = await prisma.schoolClass.findFirst({
    where: {
      schoolId,
      OR: [
        {
          classCode: {
            equals: classCode,
          },
        },
        {
          name: {
            equals: name,
          },
        },
      ],
    },
  });

  if (existing) {
    throw new Error(
      "A class with the same name or class code already exists.",
    );
  }

  await prisma.schoolClass.create({
    data: {
      schoolId,
      name,
      grade,
      section,
      classCode,
      sortOrder,
      isActive: true,
    },
  });

  revalidatePath(
    `/admin/schools/${schoolId}/settings`,
  );
}

/* -------------------------------------------------------------------------- */
/*                              UPDATE CLASS                                  */
/* -------------------------------------------------------------------------- */

async function updateSchoolClass(formData: FormData) {
  "use server";

  const id = getString(formData, "id");
  const name = getString(formData, "name");
  const grade = getString(formData, "grade");
  const section = getString(formData, "section");
  const classCode = getString(
    formData,
    "classCode",
  ).toUpperCase();

  const sortOrder = getNumber(
    formData,
    "sortOrder",
    0,
  );

  if (
    !id ||
    !name ||
    !grade ||
    !section ||
    !classCode
  ) {
    throw new Error(
      "Class name, year, section and class code are required.",
    );
  }

  const schoolClass =
    await prisma.schoolClass.findUnique({
      where: {
        id,
      },
    });

  if (!schoolClass) {
    throw new Error("Class not found.");
  }

  await assertSchoolAccess(
    schoolClass.schoolId,
  );

  const duplicate =
    await prisma.schoolClass.findFirst({
      where: {
        schoolId: schoolClass.schoolId,
        id: {
          not: id,
        },
        OR: [
          {
            classCode: {
              equals: classCode,
            },
          },
          {
            name: {
              equals: name,
            },
          },
        ],
      },
    });

  if (duplicate) {
    throw new Error(
      "A class with the same name or class code already exists.",
    );
  }

  await prisma.schoolClass.update({
    where: {
      id,
    },
    data: {
      name,
      grade,
      section,
      classCode,
      sortOrder,
    },
  });

  revalidatePath(
    `/admin/schools/${schoolClass.schoolId}/settings`,
  );
}

/* -------------------------------------------------------------------------- */
/*                             TOGGLE CLASS                                   */
/* -------------------------------------------------------------------------- */

async function toggleSchoolClass(
  formData: FormData,
) {
  "use server";

  const id = getString(formData, "id");

  if (!id) {
    throw new Error("Class ID is required.");
  }

  const schoolClass =
    await prisma.schoolClass.findUnique({
      where: {
        id,
      },
    });

  if (!schoolClass) {
    throw new Error("Class not found.");
  }

  await assertSchoolAccess(
    schoolClass.schoolId,
  );

  await prisma.schoolClass.update({
    where: {
      id,
    },
    data: {
      isActive: !schoolClass.isActive,
    },
  });

  revalidatePath(
    `/admin/schools/${schoolClass.schoolId}/settings`,
  );
}

/* -------------------------------------------------------------------------- */
/*                             DELETE CLASS                                   */
/* -------------------------------------------------------------------------- */

async function deleteSchoolClass(
  formData: FormData,
) {
  "use server";

  const id = getString(formData, "id");

  if (!id) {
    throw new Error("Class ID is required.");
  }

  const schoolClass =
    await prisma.schoolClass.findUnique({
      where: {
        id,
      },
    });

  if (!schoolClass) {
    throw new Error("Class not found.");
  }

  await assertSchoolAccess(
    schoolClass.schoolId,
  );

  await prisma.schoolClass.delete({
    where: {
      id,
    },
  });

  revalidatePath(
    `/admin/schools/${schoolClass.schoolId}/settings`,
  );
}

/* -------------------------------------------------------------------------- */
/*                                  PAGE                                      */
/* -------------------------------------------------------------------------- */

export default async function SchoolSettingsPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const session = await requireAdmin();

  const { id } = await params;

  if (
    session.user.role === "SCHOOL_ADMIN" &&
    session.user.schoolId !== id
  ) {
    notFound();
  }

  const school =
    await prisma.school.findUnique({
      where: {
        id,
      },

      include: {
        settings: true,

        classes: {
          orderBy: [
            {
              sortOrder: "asc",
            },
            {
              grade: "asc",
            },
            {
              classCode: "asc",
            },
          ],
        },

        pickupSlots: {
          orderBy: [
            {
              sortOrder: "asc",
            },
            {
              startTime: "asc",
            },
          ],
        },
      },
    });

  if (!school) {
    notFound();
  }

  const s = school.settings;

  return (
    <main className="content">
      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                             */}
      {/* ------------------------------------------------------------------ */}

      <div className="page-heading">
        <div>
          <h1 className="brand">
            {school.name} Settings
          </h1>

          <p className="subtle">
            Control pre-orders, classes, pickup
            times, overdraft policy and
            notification channels.
          </p>
        </div>

        <Link
          className="secondary"
          href="/admin/schools"
        >
          Schools
        </Link>
      </div>

      <div className="wallet-layout">
        {/* ---------------------------------------------------------------- */}
        {/* OPERATIONAL SETTINGS                                             */}
        {/* ---------------------------------------------------------------- */}

        <form
          action={saveSchoolSettings}
          className="panel form"
        >
          <h2>Operational Settings</h2>

          <input
            type="hidden"
            name="schoolId"
            value={school.id}
          />

          <label className="label">
            Timezone

            <input
              className="input"
              name="timezone"
              defaultValue={
                s?.timezone ??
                "Australia/Brisbane"
              }
            />
          </label>

          <label className="label">
            Currency

            <input
              className="input"
              name="currency"
              defaultValue={
                s?.currency ?? "AUD"
              }
            />
          </label>

          <label>
            <input
              type="checkbox"
              name="preOrderEnabled"
              defaultChecked={
                s?.preOrderEnabled ?? true
              }
            />{" "}
            Pre-orders enabled
          </label>

          <label className="label">
            Pre-order cutoff time

            <input
              className="input"
              type="time"
              name="preOrderCutoffTime"
              defaultValue={
                s?.preOrderCutoffTime ??
                "07:00"
              }
            />
          </label>

          <label>
            <input
              type="checkbox"
              name="allowNegativeBalance"
              defaultChecked={
                s?.allowNegativeBalance ??
                false
              }
            />{" "}
            Allow negative-balance sales with
            admin approval
          </label>

          <label className="label">
            Minimum allowed balance

            <input
              className="input"
              type="number"
              step=".01"
              min="-1000"
              max="0"
              name="minimumAllowedBalance"
              defaultValue={
                s?.minimumAllowedBalance?.toString() ??
                "0"
              }
            />
          </label>

          <label>
            <input
              type="checkbox"
              name="emailNotificationsEnabled"
              defaultChecked={
                s?.emailNotificationsEnabled ??
                true
              }
            />{" "}
            Email notifications enabled for this
            school
          </label>

          <label>
            <input
              type="checkbox"
              name="smsNotificationsEnabled"
              defaultChecked={
                s?.smsNotificationsEnabled ??
                false
              }
            />{" "}
            SMS notifications enabled for this
            school
          </label>

          <button
            className="primary"
            type="submit"
          >
            Save Settings
          </button>
        </form>

        {/* ---------------------------------------------------------------- */}
        {/* CLASSES                                                          */}
        {/* ---------------------------------------------------------------- */}

        <section className="panel">
          <details>
            <summary
              style={{
                cursor: "pointer",
                fontSize: 20,
                fontWeight: 700,
                padding: "4px 0",
              }}
            >
              Classes
            </summary>

            <div
              style={{
                marginTop: 18,
              }}
            >
              <p className="subtle">
                Manage the classes that parents
                can select when adding a student.
              </p>

              <div className="divider" />

              {/* ADD CLASS */}

              <form
                action={addSchoolClass}
                className="form"
              >
                <h3>Add Class</h3>

                <input
                  type="hidden"
                  name="schoolId"
                  value={school.id}
                />

                <label className="label">
                  Class name

                  <input
                    className="input"
                    name="name"
                    placeholder="Year 3 - A"
                    required
                  />
                </label>

                <div className="two-col">
                  <label className="label">
                    Year

                    <input
                      className="input"
                      name="grade"
                      placeholder="3"
                      required
                    />
                  </label>

                  <label className="label">
                    Section

                    <input
                      className="input"
                      name="section"
                      placeholder="A"
                      required
                    />
                  </label>
                </div>

                <label className="label">
                  Class code

                  <input
                    className="input"
                    name="classCode"
                    placeholder="3A"
                    required
                  />
                </label>

                <label className="label">
                  Sort order

                  <input
                    className="input"
                    type="number"
                    name="sortOrder"
                    defaultValue="0"
                  />
                </label>

                <button
                  className="primary"
                  type="submit"
                >
                  Add Class
                </button>
              </form>

              <div className="divider" />

              {/* EXISTING CLASSES */}

              {school.classes.length === 0 ? (
                <p className="subtle">
                  No classes configured for this
                  school yet.
                </p>
              ) : (
                <div className="request-list">
                  {school.classes.map(
                    (schoolClass) => (
                      <div
                        className="panel"
                        key={schoolClass.id}
                      >
                        <form
                          action={updateSchoolClass}
                          className="form"
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={
                              schoolClass.id
                            }
                          />

                          <h3>
                            {schoolClass.name}
                          </h3>

                          <div className="subtle compact">
                            Class code:{" "}
                            {
                              schoolClass.classCode
                            }{" "}
                            ·{" "}
                            {schoolClass.isActive
                              ? "ACTIVE"
                              : "INACTIVE"}
                          </div>

                          <label className="label">
                            Class name

                            <input
                              className="input"
                              name="name"
                              defaultValue={
                                schoolClass.name
                              }
                              required
                            />
                          </label>

                          <div className="two-col">
                            <label className="label">
                              Year

                              <input
                                className="input"
                                name="grade"
                                defaultValue={
                                  schoolClass.grade
                                }
                                required
                              />
                            </label>

                            <label className="label">
                              Section

                              <input
                                className="input"
                                name="section"
                                defaultValue={
                                  schoolClass.section ??
                                  ""
                                }
                                required
                              />
                            </label>
                          </div>

                          <label className="label">
                            Class code

                            <input
                              className="input"
                              name="classCode"
                              defaultValue={
                                schoolClass.classCode
                              }
                              required
                            />
                          </label>

                          <label className="label">
                            Sort order

                            <input
                              className="input"
                              type="number"
                              name="sortOrder"
                              defaultValue={
                                schoolClass.sortOrder
                              }
                            />
                          </label>

                          <button
                            className="primary"
                            type="submit"
                          >
                            Save Class
                          </button>
                        </form>

                        <div
                          className="divider"
                        />

                        <div className="actions-row">
                          <form
                            action={
                              toggleSchoolClass
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                schoolClass.id
                              }
                            />

                            <button
                              className="secondary"
                              type="submit"
                            >
                              {schoolClass.isActive
                                ? "Disable"
                                : "Enable"}
                            </button>
                          </form>

                          <form
                            action={
                              deleteSchoolClass
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                schoolClass.id
                              }
                            />

                            <button
                              className="danger"
                              type="submit"
                            >
                              Remove
                            </button>
                          </form>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </details>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* PICKUP SLOTS                                                     */}
        {/* ---------------------------------------------------------------- */}

        <section className="panel">
          <h2>Pickup Slots</h2>

          <form
            action={addPickupSlot}
            className="form"
          >
            <input
              type="hidden"
              name="schoolId"
              value={school.id}
            />

            <input
              className="input"
              name="label"
              placeholder="9:00–9:15"
              required
            />

            <div className="two-col">
              <label className="label">
                Start

                <input
                  className="input"
                  type="time"
                  name="startTime"
                  required
                />
              </label>

              <label className="label">
                End

                <input
                  className="input"
                  type="time"
                  name="endTime"
                  required
                />
              </label>
            </div>

            <input
              className="input"
              name="sortOrder"
              type="number"
              defaultValue="0"
              placeholder="Sort order"
            />

            <button
              className="primary"
              type="submit"
            >
              Add Pickup Slot
            </button>
          </form>

          <div className="divider" />

          <div className="request-list">
            {school.pickupSlots.length === 0 ? (
              <p className="subtle compact">
                No pickup slots configured.
              </p>
            ) : (
              school.pickupSlots.map(
                (slot) => (
                  <div
                    className="list-row"
                    key={slot.id}
                  >
                    <div>
                      <strong>
                        {slot.label}
                      </strong>

                      <div className="subtle compact">
                        {slot.startTime}–
                        {slot.endTime} ·{" "}
                        {slot.isActive
                          ? "ACTIVE"
                          : "INACTIVE"}
                      </div>
                    </div>

                    <div className="actions-row">
                      <form
                        action={
                          togglePickupSlot
                        }
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={slot.id}
                        />

                        <button
                          className="secondary"
                          type="submit"
                        >
                          {slot.isActive
                            ? "Disable"
                            : "Enable"}
                        </button>
                      </form>

                      <form
                        action={
                          deletePickupSlot
                        }
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={slot.id}
                        />

                        <button
                          className="danger"
                          type="submit"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </div>
                ),
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}