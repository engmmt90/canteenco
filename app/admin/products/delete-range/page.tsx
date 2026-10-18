import Link from "next/link";

import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

import { deleteProductsInSortRange } from "./actions";

type Props = {
  searchParams?: Promise<{
    done?: string;
  }>;
};

const MIN_SORT = 80;
const MAX_SORT = 370;

export default async function DeleteProductRangePage({
  searchParams,
}: Props) {
  const session = await requireAdmin();

  if (session.user.role !== "SUPER_ADMIN") {
    return (
      <main className="content">
        <h1>Delete Product Range</h1>
        <p>Super Admin only.</p>
        <Link href="/admin/products">Back to products</Link>
      </main>
    );
  }

  const params = await searchParams;

  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
      sortOrder: {
        gte: MIN_SORT,
        lte: MAX_SORT,
      },
    },
    orderBy: [
      { sortOrder: "asc" },
      { name: "asc" },
    ],
    select: {
      id: true,
      name: true,
      sku: true,
      sortOrder: true,
      price: true,
    },
  });

  return (
    <main className="content" style={{ maxWidth: 900 }}>
      <Link href="/admin/products">← Back to products</Link>

      <h1 style={{ marginTop: 20 }}>
        Delete Products — Sort Order 80 to 370
      </h1>

      {params?.done === "1" ? (
        <div
          style={{
            padding: 14,
            border: "1px solid #16a34a",
            borderRadius: 10,
            marginBottom: 18,
          }}
        >
          Products in the range were removed from active product lists.
        </div>
      ) : null}

      <p>
        This will remove every active product whose sort order is from
        <strong> 80 </strong> through <strong>370</strong>, inclusive.
      </p>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2>
          Products to remove ({products.length})
        </h2>

        {products.length === 0 ? (
          <p className="subtle">No products found in this range.</p>
        ) : (
          <div className="request-list" style={{ marginTop: 12 }}>
            {products.map((product) => (
              <div className="list-row" key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <div className="subtle compact">
                    {product.sku} · Sort order: {product.sortOrder}
                  </div>
                </div>

                <strong>
                  {"$"}{Number(product.price).toFixed(2)}
                </strong>
              </div>
            ))}
          </div>
        )}
      </div>

      {products.length > 0 ? (
        <div
          style={{
            marginTop: 20,
            border: "2px solid #dc2626",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Confirm deletion</h2>

          <p>
            Type <strong>DELETE 80-370</strong> exactly.
          </p>

          <form action={deleteProductsInSortRange}>
            <input
              className="input"
              name="confirmation"
              required
              autoComplete="off"
              placeholder="DELETE 80-370"
            />

            <button
              className="primary"
              type="submit"
              style={{ marginTop: 12 }}
            >
              Delete products 80–370
            </button>
          </form>
        </div>
      ) : null}
    </main>
  );
}
