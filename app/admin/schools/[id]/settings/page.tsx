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

async function addSchoolClass(formData: FormData) {
  "use server";

  const session = await requireAdmin();

  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();
  const section = String(formData.get("section") ?? "").trim();
  const classCode = String(
    formData.get("classCode") ?? "",
  )
    .trim()
    .toUpperCase();

  const sortOrderValue = Number(
    formData.get("sortOrder") ?? 0,
  );

  if (!schoolId || !name || !grade || !classCode) {
    throw new Error("Missing required class information.");
  }

  if (
    session.user.role === "SCHOOL_ADMIN" &&
    session.user.schoolId !== schoolId
  ) {
    throw new Error("Unauthorized.");
  }

  await prisma.schoolClass.create({
    data: {
      schoolId,
      name,
      grade,
      section: section || null,
      classCode,
      sortOrder: Number.isFinite(sortOrderValue)
        ? sortOrderValue
        : 0,
      isActive: true,
    },
  });

  revalidatePath(`/admin/schools/${schoolId}/settings`);
  revalidatePath("/admin/schools");
}

async function updateSchoolClass(formData: FormData) {
  "use server";

  const session = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const schoolId = String(formData.get("schoolId") ?? "").trim();

  const name = String(formData.get("name") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();
  const section = String(formData.get("section") ?? "").trim();
  const classCode = String(
    formData.get("classCode") ?? "",
  )
    .trim()
    .toUpperCase();

  const sortOrderValue = Number(
    formData.get("sortOrder") ?? 0,
  );

  if (!id || !schoolId || !name || !grade || !classCode) {
    throw new Error("Missing required class information.");
  }

  if (
    session.user.role === "SCHOOL_ADMIN" &&
    session.user.schoolId !== schoolId
  ) {
    throw new Error("Unauthorized.");
  }

  const existingClass = await prisma.schoolClass.findUnique({
    where: {
      id,
    },
    select: {
      schoolId: true,
    },
  });

  if (!existingClass || existingClass.schoolId !== schoolId) {
    throw new Error("Class not found.");
  }

  await prisma.schoolClass.update({
    where: {
      id,
    },
    data: {
      name,
      grade,
      section: section || null,
      classCode,
      sortOrder: Number.isFinite(sortOrderValue)
        ? sortOrderValue
        : 0,
    },
  });

  revalidatePath(`/admin/schools/${schoolId}/settings`);
  revalidatePath("/admin/schools");
}

async function toggleSchoolClass(formData: FormData) {
  "use server";

  const session = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const schoolId = String(formData.get("schoolId") ?? "").trim();

  if (!id || !schoolId) {
    throw new Error("Missing class information.");
  }

  if (
    session.user.role === "SCHOOL_ADMIN" &&
    session.user.schoolId !== schoolId
  ) {
    throw new Error("Unauthorized.");
  }

  const schoolClass = await prisma.schoolClass.findUnique({
    where: {
      id,
    },
    select: {
      schoolId: true,
      isActive: true,
    },
  });

  if (!schoolClass || schoolClass.schoolId !== schoolId) {
    throw new Error("Class not found.");
  }

  await prisma.schoolClass.update({
    where: {
      id,
    },
    data: {
      isActive: !schoolClass.isActive,
    },
  });

  revalidatePath(`/admin/schools/${schoolId}/settings`);
}

async function deleteSchoolClass(formData: FormData) {
  "use server";

  const session = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const schoolId = String(formData.get("schoolId") ?? "").trim();

  if (!id || !schoolId) {
    throw new Error("Missing class information.");
  }

  if (
    session.user.role === "SCHOOL_ADMIN" &&
    session.user.schoolId !== schoolId
  ) {
    throw new Error("Unauthorized.");
  }

  const schoolClass = await prisma.schoolClass.findUnique({
    where: {
      id,
    },
    select: {
      schoolId: true,
    },
  });

  if (!schoolClass || schoolClass.schoolId !== schoolId) {
    throw new Error("Class not found.");
  }

  await prisma.schoolClass.delete({
    where: {
      id,
    },
  });

  revalidatePath(`/admin/schools/${schoolId}/settings`);
}

export default async function SchoolSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin();

  const { id } = await params;

  if (
    session.user.role === "SCHOOL_ADMIN" &&
    session.user.schoolId !== id
  ) {
    notFound();
  }

  const school = await prisma.school.findUnique({
    where: {
      id,
    },

    include: {
      settings: true,

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
    },
  });

  if (!school) {
    notFound();
  }

  const s = school.settings;

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            {school.name} Settings
          </h1>

          <p className="subtle">
            Control school operations, classes,
            pre-orders, pickup times and
            notification settings.
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
        {/* Operational Settings */}

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
                s?.timezone ?? "Australia/Brisbane"
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
                s?.preOrderCutoffTime ?? "07:00"
              }
            />
          </label>

          <label>
            <input
              type="checkbox"
              name="allowNegativeBalance"
              defaultChecked={
                s?.allowNegativeBalance ?? false
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
                s?.emailNotificationsEnabled ?? true
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
                s?.smsNotificationsEnabled ?? false
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

        {/* Classes */}

        <section className="panel">
          <h2>Classes</h2>

          <p className="subtle compact">
            Manage the classes that parents can
            select when adding a student.
          </p>

          <div className="divider" />

          <form
            action={addSchoolClass}
            className="form"
          >
            <input
              type="hidden"
              name="schoolId"
              value={school.id}
            />

            <h3>Add Class</h3>

            <label className="label">
              Class name

              <input
                className="input"
                name="name"
                placeholder="Grade 3 - A"
                required
              />
            </label>

            <div className="two-col">
              <label className="label">
                Grade

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
                name="sortOrder"
                type="number"
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

          <div className="request-list">
            {school.classes.length === 0 ? (
              <p className="subtle compact">
                No classes configured for this
                school yet.
              </p>
            ) : (
              school.classes.map((schoolClass) => (
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
                      value={schoolClass.id}
                    />

                    <input
                      type="hidden"
                      name="schoolId"
                      value={school.id}
                    />

                    <div className="two-col">
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
                    </div>

                    <div className="two-col">
                      <label className="label">
                        Grade

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
                            schoolClass.section ?? ""
                          }
                        />
                      </label>
                    </div>

                    <label className="label">
                      Sort order

                      <input
                        className="input"
                        name="sortOrder"
                        type="number"
                        defaultValue={
                          schoolClass.sortOrder
                        }
                      />
                    </label>

                    <div
                      className="actions-row"
                      style={{
                        alignItems: "center",
                      }}
                    >
                      <button
                        className="primary"
                        type="submit"
                      >
                        Save Class
                      </button>

                      <span className="subtle compact">
                        {schoolClass.isActive
                          ? "ACTIVE"
                          : "INACTIVE"}
                      </span>
                    </div>
                  </form>

                  <div className="divider" />

                  <div className="actions-row">
                    <form
                      action={toggleSchoolClass}
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={schoolClass.id}
                      />

                      <input
                        type="hidden"
                        name="schoolId"
                        value={school.id}
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
                      action={deleteSchoolClass}
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={schoolClass.id}
                      />

                      <input
                        type="hidden"
                        name="schoolId"
                        value={school.id}
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
              ))
            )}
          </div>
        </section>

        {/* Pickup Slots */}

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
              school.pickupSlots.map((slot) => (
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
                      action={togglePickupSlot}
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
                      action={deletePickupSlot}
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
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}