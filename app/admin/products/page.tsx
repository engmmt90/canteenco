import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { saveProduct } from "@/app/actions/admin-management";

export default async function Page() {
  await requireAdmin();

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <main className="content">
      <div className="page-heading">
        <h1 className="brand">Products</h1>
        <Link className="secondary" href="/admin">
          Dashboard
        </Link>
      </div>

      <form action={saveProduct} className="panel form">
        <h2>Add Product</h2>

        <input
          className="input"
          name="sku"
          placeholder="SKU"
          required
        />

        <input
          className="input"
          name="name"
          placeholder="Product name"
          required
        />

        <input
          className="input"
          name="category"
          placeholder="Category"
        />

        <input
          className="input"
          name="price"
          type="number"
          min="0"
          step=".01"
          placeholder="Price"
          required
        />

        <input
          className="input"
          name="sortOrder"
          type="number"
          defaultValue="0"
        />

        <input
          className="input"
          name="imageUrl"
          type="url"
          placeholder="Product image URL"
        />

        <textarea
          className="input"
          name="description"
          placeholder="Description"
        />

        <label>
          <input
            type="checkbox"
            name="isActive"
            defaultChecked
          />{" "}
          Active
        </label>

        <button className="primary" type="submit">
          Add Product
        </button>
      </form>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="request-list">
          {products.map((product) => (
            <div className="list-row" key={product.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    style={{
                      width: 56,
                      height: 56,
                      objectFit: "cover",
                      borderRadius: 10,
                    }}
                  />
                ) : null}

                <div>
                  <strong>{product.name}</strong>
                  <div className="subtle compact">
                    {product.sku} ·{" "}
                    {product.category || "Uncategorised"}
                  </div>
                </div>
              </div>

              <div>
                <strong>
                  ${Number(product.price).toFixed(2)}
                </strong>{" "}
                <span className="badge">
                  {product.isActive ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}