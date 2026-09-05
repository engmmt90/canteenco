import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

import { prisma } from "@/lib/prisma";
import { adminSchoolScope } from "@/lib/admin-scope";

export type SalesReportParams = {
  q?: string;
  status?: string;
  school?: string;
  range?: string;
  from?: string;
  to?: string;
};

export type SalesReportRow = {
  id: string;
  saleNumber: string;
  studentName: string;
  studentCode: string;
  schoolName: string;
  cashierName: string;
  status: string;
  total: number;
  createdAt: Date;
};

export type SalesReportData = {
  generatedAt: Date;
  range: string;
  from?: string;
  to?: string;
  q: string;
  status: string;
  schoolId: string | null;
  schoolName: string | null;
  logoSchoolId: string | null;
  logoData: Uint8Array | null;
  logoMimeType: string | null;
  rows: SalesReportRow[];
  totalSales: number;
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

function brisbaneDateParts(
  date = new Date(),
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Australia/Brisbane",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
      },
    ).formatToParts(date);

  const get = (
    type: string,
  ) =>
    parts.find(
      (part) =>
        part.type === type,
    )?.value ?? "";

  return {
    year: Number(
      get("year"),
    ),
    month: Number(
      get("month"),
    ),
    day: Number(
      get("day"),
    ),
    weekday:
      get("weekday"),
  };
}

function brisbaneStartUtc(
  year: number,
  month: number,
  day: number,
) {
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      -10,
      0,
      0,
      0,
    ),
  );
}

function brisbaneEndUtc(
  year: number,
  month: number,
  day: number,
) {
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      13,
      59,
      59,
      999,
    ),
  );
}

function parseDateInput(
  value?: string,
  end = false,
) {
  if (!value) {
    return undefined;
  }

  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number);

  if (
    !year ||
    !month ||
    !day
  ) {
    return undefined;
  }

  return end
    ? brisbaneEndUtc(
        year,
        month,
        day,
      )
    : brisbaneStartUtc(
        year,
        month,
        day,
      );
}

function getDateRange(
  params: SalesReportParams,
) {
  const range =
    params.range ||
    "today";

  const today =
    brisbaneDateParts();

  if (
    range === "today"
  ) {
    return {
      range,
      dateFrom:
        brisbaneStartUtc(
          today.year,
          today.month,
          today.day,
        ),
      dateTo:
        brisbaneEndUtc(
          today.year,
          today.month,
          today.day,
        ),
    };
  }

  if (
    range === "week"
  ) {
    const weekdayIndex: Record<
      string,
      number
    > = {
      Mon: 0,
      Tue: 1,
      Wed: 2,
      Thu: 3,
      Fri: 4,
      Sat: 5,
      Sun: 6,
    };

    const mondayOffset =
      weekdayIndex[
        today.weekday
      ] ?? 0;

    const current =
      new Date(
        Date.UTC(
          today.year,
          today.month - 1,
          today.day,
        ),
      );

    current.setUTCDate(
      current.getUTCDate() -
        mondayOffset,
    );

    return {
      range,
      dateFrom:
        brisbaneStartUtc(
          current.getUTCFullYear(),
          current.getUTCMonth() +
            1,
          current.getUTCDate(),
        ),
      dateTo:
        brisbaneEndUtc(
          today.year,
          today.month,
          today.day,
        ),
    };
  }

  if (
    range === "month"
  ) {
    return {
      range,
      dateFrom:
        brisbaneStartUtc(
          today.year,
          today.month,
          1,
        ),
      dateTo:
        brisbaneEndUtc(
          today.year,
          today.month,
          today.day,
        ),
    };
  }

  return {
    range:
      "custom",
    dateFrom:
      parseDateInput(
        params.from,
      ),
    dateTo:
      parseDateInput(
        params.to,
        true,
      ),
  };
}

export function salesParamsToQuery(
  params: SalesReportParams,
) {
  const query =
    new URLSearchParams();

  const entries = [
    [
      "range",
      params.range ||
        "today",
    ],
    ["from", params.from],
    ["to", params.to],
    ["school", params.school],
    ["status", params.status],
    ["q", params.q],
  ] as const;

  for (const [
    key,
    value,
  ] of entries) {
    if (value) {
      query.set(
        key,
        value,
      );
    }
  }

  return query.toString();
}

export async function getSalesReportData(
  params: SalesReportParams,
): Promise<SalesReportData> {
  const {
    schoolId: forcedSchoolId,
  } =
    await adminSchoolScope();

  const schoolId =
    forcedSchoolId ||
    params.school ||
    undefined;

  const q =
    (params.q || "").trim();

  const status =
    params.status || "";

  const {
    range,
    dateFrom,
    dateTo,
  } =
    getDateRange(params);

  const where: any = {
    ...(schoolId
      ? {
          schoolId,
        }
      : {}),

    ...(status
      ? {
          status,
        }
      : {}),

    ...(dateFrom ||
    dateTo
      ? {
          createdAt: {
            ...(dateFrom
              ? {
                  gte:
                    dateFrom,
                }
              : {}),

            ...(dateTo
              ? {
                  lte:
                    dateTo,
                }
              : {}),
          },
        }
      : {}),

    ...(q
      ? {
          OR: [
            {
              saleNumber: {
                contains: q,
                mode:
                  "insensitive",
              },
            },

            {
              student: {
                OR: [
                  {
                    displayCode: {
                      contains:
                        q,
                      mode:
                        "insensitive",
                    },
                  },

                  {
                    firstName: {
                      contains:
                        q,
                      mode:
                        "insensitive",
                    },
                  },

                  {
                    lastName: {
                      contains:
                        q,
                      mode:
                        "insensitive",
                    },
                  },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const sales =
    await prisma.sale.findMany({
      where,

      include: {
        student: true,
        school: true,
        cashier: true,
      },

      orderBy: {
        createdAt: "desc",
      },

      take: 10000,
    });

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
      branding?.name ??
      null;

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

  if (!logoData) {
    const fallback =
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
      fallback?.logoData &&
      fallback.logoMimeType
    ) {
      logoSchoolId =
        fallback.schoolId;

      logoData =
        new Uint8Array(
          fallback.logoData,
        );

      logoMimeType =
        fallback.logoMimeType;
    }
  }

  if (!schoolId) {
    schoolName =
      "CanteenCo";
  }

  const rows =
    sales.map(
      (sale) => ({
        id: sale.id,
        saleNumber:
          sale.saleNumber,
        studentName:
          `${sale.student.firstName} ${sale.student.lastName}`,
        studentCode:
          sale.student
            .displayCode,
        schoolName:
          sale.school.name,
        cashierName:
          sale.cashier
            .fullName,
        status:
          sale.status,
        total:
          Number(
            sale.total,
          ),
        createdAt:
          sale.createdAt,
      }),
    );

  return {
    generatedAt:
      new Date(),
    range,
    from:
      params.from,
    to:
      params.to,
    q,
    status,
    schoolId:
      schoolId ?? null,
    schoolName,
    logoSchoolId,
    logoData,
    logoMimeType,
    rows,
    totalSales:
      rows.reduce(
        (
          sum,
          row,
        ) =>
          sum +
          row.total,
        0,
      ),
  };
}

function wrapText(
  text: string,
  maxChars: number,
) {
  const clean =
    text
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

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
      next.length <=
      maxChars
    ) {
      line = next;
      continue;
    }

    if (line) {
      lines.push(line);
    }

    line =
      word.length >
      maxChars
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

export async function buildSalesReportPdf(
  report: SalesReportData,
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
  const margin = 25;

  const columns = {
    no: 22,
    sale: 135,
    student: 115,
    school: 120,
    cashier: 100,
    status: 75,
    date: 145,
    total: 75,
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

  function periodLabel() {
    if (
      report.range ===
      "today"
    ) {
      return "Today";
    }

    if (
      report.range ===
      "week"
    ) {
      return "This Week";
    }

    if (
      report.range ===
      "month"
    ) {
      return "This Month";
    }

    return `Custom: ${report.from || "-"} to ${report.to || "-"}`;
  }

  function addPage() {
    const page =
      pdf.addPage([
        pageWidth,
        pageHeight,
      ]);

    let titleX =
      margin;

    if (logoImage) {
      const maxWidth = 105;
      const maxHeight = 38;

      const scale =
        Math.min(
          maxWidth /
            logoImage.width,
          maxHeight /
            logoImage.height,
        );

      const width =
        logoImage.width *
        scale;

      const height =
        logoImage.height *
        scale;

      page.drawImage(
        logoImage,
        {
          x: margin,
          y:
            pageHeight -
            margin -
            height +
            3,
          width,
          height,
        },
      );

      titleX =
        margin +
        width +
        14;
    }

    page.drawText(
      "Sales Report",
      {
        x: titleX,
        y:
          pageHeight -
          margin -
          3,
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
      report.schoolName ||
        "CanteenCo",
      {
        x: titleX,
        y:
          pageHeight -
          margin -
          17,
        size: 9,
        font: regular,
      },
    );

    page.drawText(
      `Period: ${periodLabel()}`,
      {
        x: titleX,
        y:
          pageHeight -
          margin -
          30,
        size: 8,
        font: regular,
      },
    );

    page.drawText(
      `Generated: ${formatBrisbaneDateTime(report.generatedAt)}`,
      {
        x: titleX,
        y:
          pageHeight -
          margin -
          42,
        size: 8,
        font: regular,
      },
    );

    page.drawText(
      `Transactions: ${report.rows.length}    Total sales: $${report.totalSales.toFixed(2)}`,
      {
        x:
          pageWidth -
          margin -
          250,
        y:
          pageHeight -
          margin -
          30,
        size: 9,
        font: bold,
      },
    );

    let y =
      pageHeight -
      margin -
      64;

    const headers = [
      ["#", columns.no],
      ["Sale", columns.sale],
      ["Student", columns.student],
      ["School", columns.school],
      ["Cashier", columns.cashier],
      ["Status", columns.status],
      ["Date", columns.date],
      ["Total", columns.total],
    ] as const;

    let x = startX;

    for (const [
      label,
      width,
    ] of headers) {
      page.drawRectangle({
        x,
        y: y - 19,
        width,
        height: 19,
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
          x: x + 3,
          y: y - 12,
          size: 7.5,
          font: bold,
        },
      );

      x += width;
    }

    y -= 19;

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

    const values: Array<
      [string, number]
    > = [
      [String(index + 1), 4],
      [row.saleNumber, 22],
      [
        `${row.studentName} (${row.studentCode})`,
        20,
      ],
      [row.schoolName, 20],
      [row.cashierName, 18],
      [row.status, 12],
      [
        formatBrisbaneDateTime(
          row.createdAt,
        ),
        24,
      ],
      [
        `$${row.total.toFixed(2)}`,
        12,
      ],
    ];

    const widths = [
      columns.no,
      columns.sale,
      columns.student,
      columns.school,
      columns.cashier,
      columns.status,
      columns.date,
      columns.total,
    ];

    const wrapped =
      values.map(
        ([text, chars]) =>
          wrapText(
            text,
            Number(chars),
          ),
      );

    const maxLines =
      Math.max(
        ...wrapped.map(
          (lines) =>
            lines.length,
        ),
        1,
      );

    const rowHeight =
      Math.max(
        22,
        8 +
          maxLines * 9,
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

    let x = startX;

    wrapped.forEach(
      (
        lines,
        cellIndex,
      ) => {
        page.drawRectangle({
          x,
          y:
            y -
            rowHeight,
          width:
            widths[
              cellIndex
            ],
          height:
            rowHeight,
          borderColor: rgb(
            0.84,
            0.85,
            0.88,
          ),
          borderWidth: 0.4,
        });

        lines.forEach(
          (
            line,
            lineIndex,
          ) => {
            page.drawText(
              line,
              {
                x: x + 3,
                y:
                  y -
                  11 -
                  lineIndex *
                    9,
                size: 7,
                font:
                  regular,
              },
            );
          },
        );

        x +=
          widths[
            cellIndex
          ];
      },
    );

    y -= rowHeight;
  }

  return Buffer.from(
    await pdf.save(),
  );
}