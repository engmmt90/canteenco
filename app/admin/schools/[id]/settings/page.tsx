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

function getString(
  formData: FormData,
  name: string,
) {
  return String(
    formData.get(name) ?? "",
  ).trim();
}

function buildClassCode(
  year: string,
  section: string,
) {
  return `${year}${section}`
    .replace(/\s+/g, "")
    .toUpperCase();
}

async function assertSchoolAccess(
  schoolId: string,
) {
  const session =
    await requireAdmin();

  if (
    session.user.role ===
      "SCHOOL_ADMIN" &&
    session.user.schoolId !== schoolId
  ) {
    throw new Error("Unauthorized");
  }

  return session;
}

async function addSchoolClass(
  formData: FormData,
) {
  "use server";

  const schoolId =
    getString(
      formData,
      "schoolId",
    );

  const name =
    getString(
      formData,
      "name",
    );

  const grade =
    getString(
      formData,
      "grade",
    );

  const section =
    getString(
      formData,
      "section",
    ).toUpperCase();

  const classCode =
    buildClassCode(
      grade,
      section,
    );

  if (
    !schoolId ||
    !name ||
    !grade ||
    !section
  ) {
    throw new Error(
      "Class name, year and section are required.",
    );
  }

  await assertSchoolAccess(
    schoolId,
  );

  const existing =
    await prisma.schoolClass.findFirst({
      where: {
        schoolId,

        OR: [
          {
            classCode,
          },
          {
            name,
          },
        ],
      },
    });

  if (existing) {
    throw new Error(
      "A class with the same name or year/section already exists.",
    );
  }

  await prisma.schoolClass.create({
    data: {
      schoolId,
      name,
      grade,
      section,
      classCode,
      isActive: true,
    },
  });

  revalidatePath(
    `/admin/schools/${schoolId}/settings`,
  );
}

async function updateSchoolClass(
  formData: FormData,
) {
  "use server";

  const id =
    getString(
      formData,
      "id",
    );

  const name =
    getString(
      formData,
      "name",
    );

  const grade =
    getString(
      formData,
      "grade",
    );

  const section =
    getString(
      formData,
      "section",
    ).toUpperCase();

  const classCode =
    buildClassCode(
      grade,
      section,
    );

  if (
    !id ||
    !name ||
    !grade ||
    !section
  ) {
    throw new Error(
      "Class name, year and section are required.",
    );
  }

  const schoolClass =
    await prisma.schoolClass.findUnique({
      where: {
        id,
      },
    });

  if (!schoolClass) {
    throw new Error(
      "Class not found.",
    );
  }

  await assertSchoolAccess(
    schoolClass.schoolId,
  );

  const duplicate =
    await prisma.schoolClass.findFirst({
      where: {
        schoolId:
          schoolClass.schoolId,

        id: {
          not: id,
        },

        OR: [
          {
            classCode,
          },
          {
            name,
          },
        ],
      },
    });

  if (duplicate) {
    throw new Error(
      "A class with the same name or year/section already exists.",
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
    },
  });

  revalidatePath(
    `/admin/schools/${schoolClass.schoolId}/settings`,
  );
}

async function toggleSchoolClass(
  formData: FormData,
) {
  "use server";

  const id =
    getString(
      formData,
      "id",
    );

  if (!id) {
    throw new Error(
      "Class ID is required.",
    );
  }

  const schoolClass =
    await prisma.schoolClass.findUnique({
      where: {
        id,
      },
    });

  if (!schoolClass) {
    throw new Error(
      "Class not found.",
    );
  }

  await assertSchoolAccess(
    schoolClass.schoolId,
  );

  await prisma.schoolClass.update({
    where: {
      id,
    },

    data: {
      isActive:
        !schoolClass.isActive,
    },
  });

  revalidatePath(
    `/admin/schools/${schoolClass.schoolId}/settings`,
  );
}

async function deleteSchoolClass(
  formData: FormData,
) {
  "use server";

  const id =
    getString(
      formData,
      "id",
    );

  if (!id) {
    throw new Error(
      "Class ID is required.",
    );
  }

  const schoolClass =
    await prisma.schoolClass.findUnique({
      where: {
        id,
      },
    });

  if (!schoolClass) {
    throw new Error(
      "Class not found.",
    );
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

export default async function SchoolSettingsPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const session =
    await requireAdmin();

  const { id } =
    await params;

  if (
    session.user.role ===
      "SCHOOL_ADMIN" &&
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

  const s =
    school.settings;

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            {school.name} Settings
          </h1>

          <p className="subtle">
            Control pre-orders,
            classes, pickup times,
            overdraft policy and
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
        <form
          action={
            saveSchoolSettings
          }
          className="panel form"
        >
          <h2>
            Operational Settings
          </h2>

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
                s?.currency ??
                "AUD"
              }
            />
          </label>

          <label>
            <input
              type="checkbox"
              name="preOrderEnabled"
              defaultChecked={
                s?.preOrderEnabled ??
                true
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
            Allow negative-balance
            sales with admin approval
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
                s
                  ?.minimumAllowedBalance
                  ?.toString() ??
                "0"
              }
            />
          </label>

          <label>
            <input
              type="checkbox"
              name="emailNotificationsEnabled"
              defaultChecked={
                s
                  ?.emailNotificationsEnabled ??
                true
              }
            />{" "}
            Email notifications enabled
            for this school
          </label>

          <label>
            <input
              type="checkbox"
              name="smsNotificationsEnabled"
              defaultChecked={
                s
                  ?.smsNotificationsEnabled ??
                false
              }
            />{" "}
            SMS notifications enabled
            for this school
          </label>

          <button
            className="primary"
            type="submit"
          >
            Save Settings
          </button>
        </form>

        <section className="panel">
          <details>
            <summary
              style={{
                cursor: "pointer",
                fontSize: 20,
                fontWeight: 700,
                padding: "6px 0",
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
                Manage the classes
                parents can select when
                adding a student.
              </p>

              <div className="divider" />

              <form
                action={
                  addSchoolClass
                }
                className="form"
              >
                <h3>
                  Add Class
                </h3>

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

                <p className="subtle compact">
                  Class code will be generated
                  automatically from Year +
                  Section.
                </p>

                <button
                  className="primary"
                  type="submit"
                >
                  Add Class
                </button>
              </form>

              <div className="divider" />

              {school.classes.length ===
              0 ? (
                <p className="subtle">
                  No classes configured
                  for this school yet.
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                  }}
                >
                  {school.classes.map(
                    (schoolClass) => (
                      <details
                        key={
                          schoolClass.id
                        }
                        className="panel"
                        style={{
                          padding: 0,
                          overflow:
                            "hidden",
                        }}
                      >
                        <summary
                          style={{
                            cursor:
                              "pointer",

                            listStyle:
                              "none",

                            display:
                              "flex",

                            alignItems:
                              "center",

                            justifyContent:
                              "space-between",

                            gap: 16,

                            padding:
                              "14px 16px",
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",

                              alignItems:
                                "center",

                              gap: 20,

                              flexWrap:
                                "wrap",
                            }}
                          >
                            <strong>
                              {
                                schoolClass.name
                              }
                            </strong>

                            <span className="subtle compact">
                              Year{" "}
                              {
                                schoolClass.grade
                              }
                            </span>

                            <span className="subtle compact">
                              Section{" "}
                              {
                                schoolClass.section
                              }
                            </span>

                            <span className="subtle compact">
                              Code{" "}
                              {
                                schoolClass.classCode
                              }
                            </span>

                            <span
                              style={{
                                fontSize: 13,
                                fontWeight:
                                  700,
                                color:
                                  schoolClass.isActive
                                    ? "#15803d"
                                    : "#b91c1c",
                              }}
                            >
                              {schoolClass.isActive
                                ? "ACTIVE"
                                : "INACTIVE"}
                            </span>
                          </div>

                          <span
                            className="secondary"
                            style={{
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            Edit
                          </span>
                        </summary>

                        <div
                          style={{
                            padding:
                              "0 16px 16px",
                          }}
                        >
                          <div className="divider" />

                          <form
                            action={
                              updateSchoolClass
                            }
                            className="form"
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={
                                schoolClass.id
                              }
                            />

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

                            <p className="subtle compact">
                              Current class code:{" "}
                              <strong>
                                {
                                  schoolClass.classCode
                                }
                              </strong>
                              . It will update
                              automatically if Year
                              or Section changes.
                            </p>

                            <button
                              className="primary"
                              type="submit"
                            >
                              Save Changes
                            </button>
                          </form>

                          <div
                            style={{
                              height: 10,
                            }}
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
                      </details>
                    ),
                  )}
                </div>
              )}
            </div>
          </details>
        </section>

        <section className="panel">
          <h2>
            Pickup Slots
          </h2>

          <form
            action={
              addPickupSlot
            }
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
            {school.pickupSlots
              .length === 0 ? (
              <p className="subtle compact">
                No pickup slots
                configured.
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
                          value={
                            slot.id
                          }
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
                          value={
                            slot.id
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
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}