import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  PrismaClient,
  UserRole,
  UserStatus,
} from "../generated/prisma/client";

if (process.env.ALLOW_DEMO_SEED !== "true") {
  throw new Error(
    "Demo seed blocked. Set ALLOW_DEMO_SEED=true only for development/test databases.",
  );
}

if (process.env.NODE_ENV === "production") {
  throw new Error(
    "Demo seed must never run with NODE_ENV=production.",
  );
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is required to seed the database.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function main() {
  const school = await prisma.school.upsert({
    where: {
      code: "DEMO",
    },

    update: {
      name: "CanteenCo Demo School",
      isActive: true,

      settings: {
        upsert: {
          create: {
            timezone: "Australia/Brisbane",
            currency: "AUD",
            preOrderEnabled: true,
            preOrderCutoffTime: "07:00",

            // Allow cashier to request admin approval
            // when a sale would make the balance negative.
            allowNegativeBalance: true,

            // Maximum permitted negative balance.
            minimumAllowedBalance: -10,

            emailNotificationsEnabled: true,
            smsNotificationsEnabled: false,
          },

          update: {
            timezone: "Australia/Brisbane",
            currency: "AUD",
            preOrderEnabled: true,
            preOrderCutoffTime: "07:00",

            // IMPORTANT:
            // Existing DEMO school settings are updated too.
            allowNegativeBalance: true,

            // Allow balance down to -$10.00.
            minimumAllowedBalance: -10,

            emailNotificationsEnabled: true,
            smsNotificationsEnabled: false,
          },
        },
      },
    },

    create: {
      code: "DEMO",
      name: "CanteenCo Demo School",

      settings: {
        create: {
          timezone: "Australia/Brisbane",
          currency: "AUD",
          preOrderEnabled: true,
          preOrderCutoffTime: "07:00",

          allowNegativeBalance: true,
          minimumAllowedBalance: -10,

          emailNotificationsEnabled: true,
          smsNotificationsEnabled: false,
        },
      },

      pickupSlots: {
        create: [
          {
            label: "9:00–9:15",
            startTime: "09:00",
            endTime: "09:15",
            sortOrder: 1,
          },
          {
            label: "9:15–9:30",
            startTime: "09:15",
            endTime: "09:30",
            sortOrder: 2,
          },
          {
            label: "9:30–9:45",
            startTime: "09:30",
            endTime: "09:45",
            sortOrder: 3,
          },
        ],
      },
    },
  });

  /*
   * CanteenCo Menu
   *
   * Main Meals:
   * Normal: $10
   * Combo:  $13
   */

  const products = [
    // --------------------------------------------------
    // MAIN MEALS - NORMAL
    // --------------------------------------------------

    {
      sku: "MAIN-BEEF-BURGER",
      name: "Beef Burger",
      description: "Beef burger - normal meal",
      category: "Main Meals",
      price: 10.0,
      sortOrder: 1,
    },

    {
      sku: "MAIN-CHICKEN-BURGER",
      name: "Chicken Burger",
      description: "Chicken burger - normal meal",
      category: "Main Meals",
      price: 10.0,
      sortOrder: 2,
    },

    {
      sku: "MAIN-BEEF-KEBAB",
      name: "Beef Kebab",
      description: "Beef kebab - normal meal",
      category: "Main Meals",
      price: 10.0,
      sortOrder: 3,
    },

    {
      sku: "MAIN-CHICKEN-KEBAB",
      name: "Chicken Kebab",
      description: "Chicken kebab - normal meal",
      category: "Main Meals",
      price: 10.0,
      sortOrder: 4,
    },

    {
      sku: "MAIN-FALAFEL-ROLL",
      name: "Falafel Roll",
      description: "Falafel roll - normal meal",
      category: "Main Meals",
      price: 10.0,
      sortOrder: 5,
    },

    {
      sku: "MAIN-CHICKEN-TENDER-ROLL",
      name: "Chicken Tender Roll",
      description: "Chicken tender roll - normal meal",
      category: "Main Meals",
      price: 10.0,
      sortOrder: 6,
    },

    // --------------------------------------------------
    // MAIN MEALS - COMBO
    // --------------------------------------------------

    {
      sku: "COMBO-BEEF-BURGER",
      name: "Beef Burger Combo",
      description:
        "Beef burger combo with chips and a drink",
      category: "Main Meals - Combo",
      price: 13.0,
      sortOrder: 11,
    },

    {
      sku: "COMBO-CHICKEN-BURGER",
      name: "Chicken Burger Combo",
      description:
        "Chicken burger combo with chips and a drink",
      category: "Main Meals - Combo",
      price: 13.0,
      sortOrder: 12,
    },

    {
      sku: "COMBO-BEEF-KEBAB",
      name: "Beef Kebab Combo",
      description:
        "Beef kebab combo with chips and a drink",
      category: "Main Meals - Combo",
      price: 13.0,
      sortOrder: 13,
    },

    {
      sku: "COMBO-CHICKEN-KEBAB",
      name: "Chicken Kebab Combo",
      description:
        "Chicken kebab combo with chips and a drink",
      category: "Main Meals - Combo",
      price: 13.0,
      sortOrder: 14,
    },

    {
      sku: "COMBO-FALAFEL-ROLL",
      name: "Falafel Roll Combo",
      description:
        "Falafel roll combo with chips and a drink",
      category: "Main Meals - Combo",
      price: 13.0,
      sortOrder: 15,
    },

    {
      sku: "COMBO-CHICKEN-TENDER-ROLL",
      name: "Chicken Tender Roll Combo",
      description:
        "Chicken tender roll combo with chips and a drink",
      category: "Main Meals - Combo",
      price: 13.0,
      sortOrder: 16,
    },

    // --------------------------------------------------
    // SNACKS
    // --------------------------------------------------

    {
      sku: "SNACK-TENDERS-CHIPS",
      name: "Tenders with Chips",
      category: "Snacks",
      price: 5.0,
      sortOrder: 20,
    },

    {
      sku: "SNACK-SMALL-CHIPS",
      name: "Small Chips",
      category: "Snacks",
      price: 3.0,
      sortOrder: 21,
    },

    {
      sku: "SNACK-LARGE-CHIPS",
      name: "Large Chips",
      category: "Snacks",
      price: 8.0,
      sortOrder: 22,
    },

    {
      sku: "SNACK-PASTRY",
      name: "Pastry",
      category: "Snacks",
      price: 3.0,
      sortOrder: 23,
    },

    {
      sku: "SNACK-VEGE-SAMOSA",
      name: "Vege Samosa",
      category: "Snacks",
      price: 3.0,
      sortOrder: 24,
    },

    // --------------------------------------------------
    // DESSERT
    // --------------------------------------------------

    {
      sku: "DESSERT-CHEESE-KUNAFA",
      name: "Cheese Kunafa",
      category: "Dessert",
      price: 10.0,
      sortOrder: 30,
    },

    {
      sku: "DESSERT-ICE-CREAM",
      name: "Ice Cream",
      description:
        "Chocolate, vanilla and strawberry",
      category: "Dessert",
      price: 3.0,
      sortOrder: 31,
    },

    {
      sku: "DESSERT-MIXED-FRUIT",
      name: "Mixed Fruit Bowl with Juice",
      category: "Dessert",
      price: 3.0,
      sortOrder: 32,
    },

    {
      sku: "DESSERT-CREAM-SPRINKLES",
      name: "Cream Cup with Sprinkles",
      category: "Dessert",
      price: 2.0,
      sortOrder: 33,
    },

    // --------------------------------------------------
    // CHAI
    // --------------------------------------------------

    {
      sku: "CHAI-CARDAMOM",
      name: "Cardamom Chai",
      category: "Chai",
      price: 3.0,
      sortOrder: 40,
    },

    {
      sku: "CHAI-MASALA",
      name: "Masala Chai",
      category: "Chai",
      price: 3.0,
      sortOrder: 41,
    },

    {
      sku: "CHAI-KADAK",
      name: "Kadak Chai",
      category: "Chai",
      price: 3.0,
      sortOrder: 42,
    },

    // --------------------------------------------------
    // COFFEE
    // --------------------------------------------------

    {
      sku: "COFFEE-LATTE",
      name: "Latte",
      category: "Coffee",
      price: 5.0,
      sortOrder: 50,
    },

    {
      sku: "COFFEE-LONG-BLACK",
      name: "Long Black",
      category: "Coffee",
      price: 4.0,
      sortOrder: 51,
    },

    {
      sku: "COFFEE-CAPPUCCINO",
      name: "Cappuccino",
      category: "Coffee",
      price: 5.0,
      sortOrder: 52,
    },

    {
      sku: "COFFEE-FLAT-WHITE",
      name: "Flat White",
      category: "Coffee",
      price: 5.0,
      sortOrder: 53,
    },

    {
      sku: "COFFEE-ESPRESSO",
      name: "Espresso",
      category: "Coffee",
      price: 3.0,
      sortOrder: 54,
    },

    // --------------------------------------------------
    // MILK SHAKE
    // --------------------------------------------------

    {
      sku: "SHAKE-STRAWBERRY",
      name: "Strawberry Milk Shake",
      category: "Milk Shake",
      price: 6.0,
      sortOrder: 60,
    },

    {
      sku: "SHAKE-VANILLA",
      name: "Vanilla Milk Shake",
      category: "Milk Shake",
      price: 6.0,
      sortOrder: 61,
    },

    {
      sku: "SHAKE-CHOCOLATE",
      name: "Chocolate Milk Shake",
      category: "Milk Shake",
      price: 6.0,
      sortOrder: 62,
    },

    {
      sku: "SHAKE-MANGO",
      name: "Mango Milk Shake",
      category: "Milk Shake",
      price: 6.0,
      sortOrder: 63,
    },

    // --------------------------------------------------
    // DRINKS
    // --------------------------------------------------

    {
      sku: "DRINK-ANY",
      name: "Any Drink",
      category: "Drinks",
      price: 3.0,
      sortOrder: 70,
    },

    {
      sku: "DRINK-WATER",
      name: "Water",
      category: "Drinks",
      price: 2.0,
      sortOrder: 71,
    },

    {
      sku: "DRINK-ICY-POLE",
      name: "Icy Pole",
      category: "Drinks",
      price: 1.0,
      sortOrder: 72,
    },

    {
      sku: "DRINK-SLUSHY",
      name: "Slushy",
      category: "Drinks",
      price: 2.0,
      sortOrder: 73,
    },
  ];

  // --------------------------------------------------
  // PRODUCTS
  // --------------------------------------------------

  for (const product of products) {
    await prisma.product.upsert({
      where: {
        sku: product.sku,
      },

      update: {
        name: product.name,
        description:
          product.description ?? null,
        category: product.category,
        price: product.price,
        isActive: true,
        sortOrder: product.sortOrder,
        deletedAt: null,
      },

      create: {
        sku: product.sku,
        name: product.name,
        description:
          product.description ?? null,
        category: product.category,
        price: product.price,
        isActive: true,
        sortOrder: product.sortOrder,
      },
    });
  }

  console.log(
    `Seeded ${products.length} products.`,
  );

  // --------------------------------------------------
  // SUPER ADMIN
  // --------------------------------------------------

  const superAdminEmail =
    process.env.SEED_SUPER_ADMIN_EMAIL
      ?.trim()
      .toLowerCase();

  const superAdminPassword =
    process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (
    superAdminEmail &&
    superAdminPassword
  ) {
    const passwordHash =
      await bcrypt.hash(
        superAdminPassword,
        12,
      );

    await prisma.user.upsert({
      where: {
        email: superAdminEmail,
      },

      update: {
        fullName:
          "CanteenCo Super Admin",
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },

      create: {
        fullName:
          "CanteenCo Super Admin",
        email: superAdminEmail,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
  }

  // --------------------------------------------------
  // CASHIER
  // --------------------------------------------------

  const cashierEmail =
    process.env.SEED_CASHIER_EMAIL
      ?.trim()
      .toLowerCase();

  const cashierPassword =
    process.env.SEED_CASHIER_PASSWORD;

  if (
    cashierEmail &&
    cashierPassword
  ) {
    const passwordHash =
      await bcrypt.hash(
        cashierPassword,
        12,
      );

    await prisma.user.upsert({
      where: {
        email: cashierEmail,
      },

      update: {
        fullName: "Demo Cashier",
        passwordHash,
        role: UserRole.CASHIER,
        status: UserStatus.ACTIVE,
        schoolId: school.id,
      },

      create: {
        fullName: "Demo Cashier",
        email: cashierEmail,
        passwordHash,
        role: UserRole.CASHIER,
        status: UserStatus.ACTIVE,
        schoolId: school.id,
      },
    });
  }

  console.log(
    "Development seed complete.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });