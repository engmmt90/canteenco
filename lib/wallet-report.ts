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
    schoolId: schoolId ?? null,
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

    page.drawText(
      "CanteenCo Wallet Balance Report",
      {
        x: margin,
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

    page.drawText(
      `Generated: ${formatBrisbaneDateTime(report.generatedAt)}`,
      {
        x: margin,
        y:
          pageHeight -
          margin -
          24,
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
      52;

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
