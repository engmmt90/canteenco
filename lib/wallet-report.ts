import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

import { prisma } from "@/lib/prisma";
import {
  adminSchoolScope,
} from "@/lib/admin-scope";

export type WalletReportRow = {
  walletId: string;
  parentName: string;
  email: string;
  students: string;
  status: string;
  balance: number;
};

export type WalletReportData = {
  generatedAt: Date;
  schoolId: string | null;
  schoolName: string | null;
  logoSchoolId: string | null;
  logoData: Uint8Array | null;
  logoMimeType: string | null;
  rows: WalletReportRow[];
  totalBalance: number;
};

export function formatBrisbaneDateTime(
  date: Date,
) {
  return date.toLocaleString(
    "en-AU",
    {
      timeZone:
        "Australia/Brisbane",
    },
  );
}

export async function getWalletReportData(): Promise<WalletReportData> {
  const { schoolId } =
    await adminSchoolScope();

  let schoolName:
    | string
    | null = null;

  let logoSchoolId:
    | string
    | null = null;

  let logoData:
    | Uint8Array
    | null = null;

  let logoMimeType:
    | string
    | null = null;

  if (schoolId) {
    const branding =
      await prisma.school.findUnique({
        where: {
          id: schoolId,
        },

        select: {
          id: true,
          name: true,

          settings: {
            select: {
              logoData: true,
              logoMimeType: true,
            },
          },
        },
      });

    schoolName =
      branding?.name ?? null;

    if (
      branding?.settings
        ?.logoData &&
      branding.settings
        .logoMimeType
    ) {
      logoSchoolId =
        branding.id;

      logoData =
        new Uint8Array(
          branding.settings
            .logoData,
        );

      logoMimeType =
        branding.settings
          .logoMimeType;
    }
  }

  /*
   * Super Admin reports can include more than one school.
   * In that case there is no schoolId, so use the most
   * recently updated uploaded logo as the CanteenCo brand
   * logo instead of leaving the report unbranded.
   *
   * This is also a fallback if a school does not yet have
   * its own logo.
   */
  if (!logoData) {
    const fallbackLogo =
      await prisma.schoolSettings.findFirst({
        where: {
          logoData: {
            not: null,
          },

          logoMimeType: {
            not: null,
          },
        },

        orderBy: {
          updatedAt: "desc",
        },

        select: {
          schoolId: true,
          logoData: true,
          logoMimeType: true,
        },
      });

    if (
      fallbackLogo?.logoData &&
      fallbackLogo.logoMimeType
    ) {
      logoSchoolId =
        fallbackLogo.schoolId;

      logoData =
        new Uint8Array(
          fallbackLogo.logoData,
        );

      logoMimeType =
        fallbackLogo.logoMimeType;
    }
  }

  if (!schoolId) {
    schoolName =
      "CanteenCo";
  }

  const wallets =
    await prisma.wallet.findMany({
      where: {
        parent: schoolId
          ? {
              students: {
                some: {
                  schoolId,
                  status: "ACTIVE",
                  deletedAt: null,
                },
              },
            }
          : undefined,
      },

      include: {
        parent: {
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
              },
            },

            students: {
              where: {
                status: "ACTIVE",
                deletedAt: null,
              },

              orderBy: [
                {
                  firstName: "asc",
                },
                {
                  lastName: "asc",
                },
              ],
            },
          },
        },
      },

      orderBy: [
        {
          parent: {
            user: {
              fullName: "asc",
            },
          },
        },
      ],
    });

  const rows =
    wallets.map((wallet) => ({
      walletId: wallet.id,
      parentName:
        wallet.parent.user.fullName,
      email:
        wallet.parent.user.email,
      students:
        wallet.parent.students
          .map(
            (student) =>
              `${student.firstName} ${student.lastName} (${student.displayCode})`,
          )
          .join(", ") || "-",
      status: wallet.status,
      balance: Number(wallet.balance),
    }));

  return {
    generatedAt: new Date(),
    schoolId:
      schoolId ?? null,
    schoolName,
    logoSchoolId,
    logoData,
    logoMimeType,
    rows,
    totalBalance: rows.reduce(
      (sum, row) =>
        sum + row.balance,
      0,
    ),
  };
}

function wrapText(
  text: string,
  maxChars: number,
) {
  const clean =
    text.replace(/\s+/g, " ").trim();

  if (!clean) {
    return [""];
  }

  const words =
    clean.split(" ");

  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next =
      line
        ? `${line} ${word}`
        : word;

    if (
      next.length <= maxChars
    ) {
      line = next;
      continue;
    }

    if (line) {
      lines.push(line);
    }

    line =
      word.length > maxChars
        ? word.slice(
            0,
            maxChars,
          )
        : word;
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

export async function buildWalletReportPdf(
  report: WalletReportData,
) {
  const pdf =
    await PDFDocument.create();

  const regular =
    await pdf.embedFont(
      StandardFonts.Helvetica,
    );

  const bold =
    await pdf.embedFont(
      StandardFonts.HelveticaBold,
    );

  let logoImage:
    | Awaited<
        ReturnType<
          typeof pdf.embedPng
        >
      >
    | null = null;

  if (
    report.logoData &&
    report.logoMimeType
  ) {
    if (
      report.logoMimeType ===
      "image/png"
    ) {
      logoImage =
        await pdf.embedPng(
          report.logoData,
        );
    } else if (
      report.logoMimeType ===
      "image/jpeg"
    ) {
      logoImage =
        await pdf.embedJpg(
          report.logoData,
        );
    }
  }

  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 28;

  const columns = {
    no: 26,
    parent: 150,
    email: 170,
    students: 260,
    status: 80,
    balance: 85,
  };

  const tableWidth =
    Object.values(
      columns,
    ).reduce(
      (sum, width) =>
        sum + width,
      0,
    );

  const startX =
    (pageWidth -
      tableWidth) /
    2;

  const rowMinHeight = 25;
  const lineHeight = 10;
  const fontSize = 8;

  function addPage() {
    const page =
      pdf.addPage([
        pageWidth,
        pageHeight,
      ]);

    let titleX =
      margin;

    if (logoImage) {
      const maxLogoWidth =
        105;
      const maxLogoHeight =
        42;

      const scale =
        Math.min(
          maxLogoWidth /
            logoImage.width,
          maxLogoHeight /
            logoImage.height,
        );

      const logoWidth =
        logoImage.width *
        scale;

      const logoHeight =
        logoImage.height *
        scale;

      page.drawImage(
        logoImage,
        {
          x: margin,
          y:
            pageHeight -
            margin -
            logoHeight +
            3,
          width:
            logoWidth,
          height:
            logoHeight,
        },
      );

      titleX =
        margin +
        logoWidth +
        14;
    }

    page.drawText(
      "Wallet Balance Report",
      {
        x: titleX,
        y:
          pageHeight -
          margin -
          4,
        size: 17,
        font: bold,
        color: rgb(
          0.08,
          0.12,
          0.2,
        ),
      },
    );

    if (
      report.schoolName
    ) {
      page.drawText(
        report.schoolName,
        {
          x: titleX,
          y:
            pageHeight -
            margin -
            18,
          size: 9,
          font: regular,
          color: rgb(
            0.35,
            0.35,
            0.35,
          ),
        },
      );
    }

    page.drawText(
      `Generated: ${formatBrisbaneDateTime(report.generatedAt)}`,
      {
        x: titleX,
        y:
          pageHeight -
          margin -
          31,
        size: 8,
        font: regular,
        color: rgb(
          0.35,
          0.35,
          0.35,
        ),
      },
    );

    page.drawText(
      `Wallets: ${report.rows.length}    Total balance: $${report.totalBalance.toFixed(2)}`,
      {
        x:
          pageWidth -
          margin -
          245,
        y:
          pageHeight -
          margin -
          24,
        size: 9,
        font: bold,
      },
    );

    let y =
      pageHeight -
      margin -
      62;

    const headers = [
      ["#", columns.no],
      [
        "Parent",
        columns.parent,
      ],
      [
        "Email",
        columns.email,
      ],
      [
        "Students",
        columns.students,
      ],
      [
        "Status",
        columns.status,
      ],
      [
        "Balance",
        columns.balance,
      ],
    ] as const;

    let x = startX;

    for (const [
      label,
      width,
    ] of headers) {
      page.drawRectangle({
        x,
        y: y - 20,
        width,
        height: 20,
        color: rgb(
          0.93,
          0.94,
          0.96,
        ),
        borderColor: rgb(
          0.78,
          0.8,
          0.84,
        ),
        borderWidth: 0.5,
      });

      page.drawText(
        label,
        {
          x: x + 4,
          y: y - 13,
          size: 8,
          font: bold,
        },
      );

      x += width;
    }

    y -= 20;

    return {
      page,
      y,
    };
  }

  let {
    page,
    y,
  } = addPage();

  for (
    let index = 0;
    index <
    report.rows.length;
    index++
  ) {
    const row =
      report.rows[index];

    const parentLines =
      wrapText(
        row.parentName,
        28,
      );

    const emailLines =
      wrapText(
        row.email,
        31,
      );

    const studentLines =
      wrapText(
        row.students,
        48,
      );

    const maxLines =
      Math.max(
        parentLines.length,
        emailLines.length,
        studentLines.length,
        1,
      );

    const rowHeight =
      Math.max(
        rowMinHeight,
        9 +
          maxLines *
            lineHeight,
      );

    if (
      y -
        rowHeight <
      margin + 25
    ) {
      ({
        page,
        y,
      } = addPage());
    }

    const cells = [
      {
        width: columns.no,
        lines: [
          String(
            index + 1,
          ),
        ],
      },
      {
        width:
          columns.parent,
        lines:
          parentLines,
      },
      {
        width:
          columns.email,
        lines:
          emailLines,
      },
      {
        width:
          columns.students,
        lines:
          studentLines,
      },
      {
        width:
          columns.status,
        lines: [
          row.status,
        ],
      },
      {
        width:
          columns.balance,
        lines: [
          `$${row.balance.toFixed(2)}`,
        ],
      },
    ];

    let x = startX;

    for (const cell of cells) {
      page.drawRectangle({
        x,
        y:
          y -
          rowHeight,
        width:
          cell.width,
        height:
          rowHeight,
        borderColor: rgb(
          0.84,
          0.85,
          0.88,
        ),
        borderWidth: 0.4,
      });

      cell.lines.forEach(
        (
          line,
          lineIndex,
        ) => {
          page.drawText(
            line,
            {
              x: x + 4,
              y:
                y -
                12 -
                lineIndex *
                  lineHeight,
              size:
                fontSize,
              font:
                regular,
            },
          );
        },
      );

      x +=
        cell.width;
    }

    y -= rowHeight;
  }

  if (
    y < margin + 35
  ) {
    ({
      page,
      y,
    } = addPage());
  }

  page.drawText(
    `TOTAL BALANCE: $${report.totalBalance.toFixed(2)}`,
    {
      x:
        pageWidth -
        margin -
        185,
      y: y - 20,
      size: 11,
      font: bold,
    },
  );

  return Buffer.from(
    await pdf.save(),
  );
}